/**
 * OffscreenCanvas tile cache for waveform rendering.
 *
 * Tiles are 4096 CSS-px wide strips pre-rendered on OffscreenCanvas,
 * then composited onto the visible canvas via drawImage(bitmap).
 * LRU eviction caps memory at MAX_TILES bitmaps.
 */

import { downsampleArray, drawWaveform } from './waveformDrawing'

/** Tile width in CSS pixels (stays under Chrome's 32768px canvas limit) */
export const TILE_WIDTH = 4096

/** Max tiles kept in memory across all tracks */
const MAX_TILES = 50

export interface WaveformTile {
  index: number
  bitmap: ImageBitmap
  cacheKey: string
}

/**
 * Build a cache key that uniquely identifies a tile's visual output.
 * Any change in these params means the tile must be re-rendered.
 */
export function makeCacheKey(
  songId: string,
  tileIndex: number,
  tileWidth: number,
  height: number,
  color: string,
  frequencyColorMode: boolean,
  peaksLength: number,
  dpr: number
): string {
  return `${songId}:${tileIndex}:${tileWidth}:${height}:${color}:${frequencyColorMode}:${peaksLength}:${dpr}`
}

/** LRU tile cache — shared across all WaveformCanvas instances */
class TileCache {
  private cache = new Map<string, WaveformTile>()
  private accessOrder: string[] = []

  get(key: string): WaveformTile | undefined {
    const tile = this.cache.get(key)
    if (tile) {
      // Move to end (most recently used)
      const idx = this.accessOrder.indexOf(key)
      if (idx !== -1) this.accessOrder.splice(idx, 1)
      this.accessOrder.push(key)
    }
    return tile
  }

  set(key: string, tile: WaveformTile): void {
    // Evict LRU if at capacity
    while (this.cache.size >= MAX_TILES && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!
      const evicted = this.cache.get(oldest)
      if (evicted) {
        evicted.bitmap.close()
        this.cache.delete(oldest)
      }
    }
    this.cache.set(key, tile)
    this.accessOrder.push(key)
  }

  /** Invalidate all tiles for a given songId prefix */
  invalidate(songId: string): void {
    const prefix = `${songId}:`
    for (const [key, tile] of this.cache) {
      if (key.startsWith(prefix)) {
        tile.bitmap.close()
        this.cache.delete(key)
        const idx = this.accessOrder.indexOf(key)
        if (idx !== -1) this.accessOrder.splice(idx, 1)
      }
    }
  }

  clear(): void {
    for (const tile of this.cache.values()) {
      tile.bitmap.close()
    }
    this.cache.clear()
    this.accessOrder.length = 0
  }

  get size(): number {
    return this.cache.size
  }
}

/** Singleton tile cache */
export const tileCache = new TileCache()

/**
 * Render a single tile on an OffscreenCanvas and return its ImageBitmap.
 *
 * @param peaks - Full peaks array for the entire track
 * @param tileIndex - Which tile (0-based) to render
 * @param tileWidth - Width of this tile in CSS pixels (last tile may be shorter)
 * @param totalWidth - Total track width in CSS pixels
 * @param height - Tile height in CSS pixels
 * @param color - Waveform color
 * @param frequencyColorMode - Whether to use frequency band coloring
 * @param peaksLow/Mid/High - Optional frequency band peaks
 */
export function renderTile(
  peaks: number[],
  tileIndex: number,
  tileWidth: number,
  totalWidth: number,
  height: number,
  color: string,
  frequencyColorMode: boolean,
  dpr: number,
  peaksLow?: number[],
  peaksMid?: number[],
  peaksHigh?: number[]
): ImageBitmap {
  // Determine which slice of peaks belongs to this tile
  const tileStart = tileIndex * TILE_WIDTH
  const peaksPerPixel = peaks.length / totalWidth
  const startPeak = Math.floor(tileStart * peaksPerPixel)
  const endPeak = Math.min(
    peaks.length,
    Math.ceil((tileStart + tileWidth) * peaksPerPixel)
  )

  const tilePeaks = peaks.slice(startPeak, endPeak)
  const tilePeaksLow = peaksLow?.slice(startPeak, endPeak)
  const tilePeaksMid = peaksMid?.slice(startPeak, endPeak)
  const tilePeaksHigh = peaksHigh?.slice(startPeak, endPeak)

  // LOD downsample: ~1 peak per 2 CSS pixels
  const targetCount = Math.min(
    tilePeaks.length,
    Math.max(100, Math.ceil(tileWidth / 2))
  )
  const lodPeaks = downsampleArray(tilePeaks, targetCount)
  const lodLow = tilePeaksLow
    ? downsampleArray(tilePeaksLow, targetCount)
    : undefined
  const lodMid = tilePeaksMid
    ? downsampleArray(tilePeaksMid, targetCount)
    : undefined
  const lodHigh = tilePeaksHigh
    ? downsampleArray(tilePeaksHigh, targetCount)
    : undefined

  // Render on OffscreenCanvas at device DPR for crisp output
  // OffscreenCanvas requires positive integer dimensions
  const canvasW = Math.ceil(tileWidth * dpr)
  const canvasH = Math.ceil(height * dpr)
  if (canvasW <= 0 || canvasH <= 0) {
    // Return a 1x1 transparent bitmap as fallback
    const tiny = new OffscreenCanvas(1, 1)
    return tiny.transferToImageBitmap()
  }
  const offscreen = new OffscreenCanvas(canvasW, canvasH)
  const ctx = offscreen.getContext('2d')!
  ctx.scale(dpr, dpr)
  drawWaveform(
    ctx,
    lodPeaks,
    tileWidth,
    height,
    color,
    frequencyColorMode,
    lodLow,
    lodMid,
    lodHigh
  )

  // Transfer to ImageBitmap (no copy — bitmap owns the pixel data)
  return offscreen.transferToImageBitmap()
}

/**
 * Get or render all tiles for a track, using the LRU cache.
 * Returns an array of tiles covering the full track width.
 */
export function getTilesForTrack(
  songId: string,
  peaks: number[],
  totalWidth: number,
  height: number,
  color: string,
  frequencyColorMode: boolean,
  dpr: number,
  peaksLow?: number[],
  peaksMid?: number[],
  peaksHigh?: number[]
): WaveformTile[] {
  const roundedWidth = Math.ceil(totalWidth)
  if (roundedWidth <= 0) return []
  const tileCount = Math.ceil(roundedWidth / TILE_WIDTH)
  const tiles: WaveformTile[] = []

  for (let i = 0; i < tileCount; i++) {
    const tileWidth = Math.min(TILE_WIDTH, roundedWidth - i * TILE_WIDTH)
    if (tileWidth <= 0) continue
    const key = makeCacheKey(
      songId,
      i,
      tileWidth,
      height,
      color,
      frequencyColorMode,
      peaks.length,
      dpr
    )

    let tile = tileCache.get(key)
    if (!tile) {
      const bitmap = renderTile(
        peaks,
        i,
        tileWidth,
        totalWidth,
        height,
        color,
        frequencyColorMode,
        dpr,
        peaksLow,
        peaksMid,
        peaksHigh
      )
      tile = { index: i, bitmap, cacheKey: key }
      tileCache.set(key, tile)
    }

    tiles.push(tile)
  }

  return tiles
}
