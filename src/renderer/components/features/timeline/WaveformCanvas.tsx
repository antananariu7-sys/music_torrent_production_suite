import { memo, useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { getTilesForTrack, TILE_WIDTH } from './waveformTileCache'
import { drawWaveform, downsampleArray } from './waveformDrawing'

interface WaveformCanvasProps {
  songId: string
  peaks: number[]
  peaksLow?: number[]
  peaksMid?: number[]
  peaksHigh?: number[]
  frequencyColorMode?: boolean
  width: number
  height?: number
  color?: string
  isSelected?: boolean
  /** When true, render entire peaks array in a single pass (no tiling). Used by mix-prep view. */
  fullTrack?: boolean
}

/**
 * Renders audio waveform peaks onto a canvas using pre-rendered tile bitmaps.
 * Tiles are cached in an LRU OffscreenCanvas cache — scroll/selection changes
 * only trigger cheap drawImage blits, not full waveform redraws.
 */
export const WaveformCanvas = memo(
  function WaveformCanvas({
    songId,
    peaks,
    peaksLow,
    peaksMid,
    peaksHigh,
    frequencyColorMode = false,
    width,
    height = 80,
    color = '#3b82f6',
    isSelected = false,
    fullTrack = false,
  }: WaveformCanvasProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || peaks.length === 0 || width <= 0) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1

      // Size canvas at device DPR for crisp rendering
      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)

      if (fullTrack) {
        // Full-track mode: downsample peaks to pixel width, render in single pass
        const targetBars = Math.floor(width)
        const ds = downsampleArray(peaks, targetBars)
        const dsLow = peaksLow
          ? downsampleArray(peaksLow, targetBars)
          : undefined
        const dsMid = peaksMid
          ? downsampleArray(peaksMid, targetBars)
          : undefined
        const dsHigh = peaksHigh
          ? downsampleArray(peaksHigh, targetBars)
          : undefined

        ctx.scale(dpr, dpr)
        drawWaveform(
          ctx,
          ds,
          width,
          height,
          color,
          frequencyColorMode,
          dsLow,
          dsMid,
          dsHigh
        )
        ctx.setTransform(1, 0, 0, 1, 0, 0) // reset transform
      } else {
        // Tiled mode: use pre-rendered tile bitmaps
        const tiles = getTilesForTrack(
          songId,
          peaks,
          width,
          height,
          color,
          frequencyColorMode,
          dpr,
          peaksLow,
          peaksMid,
          peaksHigh
        )

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (const tile of tiles) {
          const x = Math.round(tile.index * TILE_WIDTH * dpr)
          const tileW = Math.min(Math.ceil(TILE_WIDTH * dpr), canvas.width - x)
          ctx.drawImage(
            tile.bitmap,
            0,
            0,
            tileW,
            canvas.height,
            x,
            0,
            tileW,
            canvas.height
          )
        }
      }
    }, [
      songId,
      peaks,
      peaksLow,
      peaksMid,
      peaksHigh,
      frequencyColorMode,
      width,
      height,
      color,
      fullTrack,
    ])

    return (
      <Box
        borderWidth={isSelected ? '2px' : '0px'}
        borderColor={isSelected ? 'blue.500' : 'transparent'}
        borderRadius="sm"
        overflow="hidden"
        cursor="pointer"
        transition="border-color 0.15s"
      >
        <canvas
          ref={canvasRef}
          style={{
            width: `${width}px`,
            height: `${height}px`,
            display: 'block',
          }}
        />
      </Box>
    )
  },
  (prev, next) =>
    prev.songId === next.songId &&
    prev.peaks === next.peaks &&
    prev.peaksLow === next.peaksLow &&
    prev.peaksMid === next.peaksMid &&
    prev.peaksHigh === next.peaksHigh &&
    prev.frequencyColorMode === next.frequencyColorMode &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.color === next.color &&
    prev.isSelected === next.isSelected &&
    prev.fullTrack === next.fullTrack
)
