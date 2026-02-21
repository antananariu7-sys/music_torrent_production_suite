import { memo, useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'
import { getTilesForTrack, TILE_WIDTH } from './waveformTileCache'

interface WaveformCanvasProps {
  songId: string
  peaks: number[]
  peaksLow?: number[]
  peaksMid?: number[]
  peaksHigh?: number[]
  frequencyColorMode?: boolean
  waveformStyle?: 'bars' | 'smooth'
  width: number
  height?: number
  color?: string
  isSelected?: boolean
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
    waveformStyle = 'smooth',
    width,
    height = 80,
    color = '#3b82f6',
    isSelected = false,
  }: WaveformCanvasProps): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas || peaks.length === 0 || width <= 0) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Size canvas to CSS pixels (DPR=1 for tiles — saves memory)
      canvas.width = width
      canvas.height = height

      // Get pre-rendered tiles (cached or freshly rendered)
      const tiles = getTilesForTrack(
        songId,
        peaks,
        width,
        height,
        color,
        waveformStyle,
        frequencyColorMode,
        peaksLow,
        peaksMid,
        peaksHigh
      )

      // Blit tiles onto visible canvas
      ctx.clearRect(0, 0, width, height)
      for (const tile of tiles) {
        const x = tile.index * TILE_WIDTH
        const tileW = Math.min(TILE_WIDTH, width - x)
        ctx.drawImage(tile.bitmap, 0, 0, tileW, height, x, 0, tileW, height)
      }
    }, [
      songId,
      peaks,
      peaksLow,
      peaksMid,
      peaksHigh,
      frequencyColorMode,
      waveformStyle,
      width,
      height,
      color,
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
    prev.waveformStyle === next.waveformStyle &&
    prev.width === next.width &&
    prev.height === next.height &&
    prev.color === next.color &&
    prev.isSelected === next.isSelected
)
