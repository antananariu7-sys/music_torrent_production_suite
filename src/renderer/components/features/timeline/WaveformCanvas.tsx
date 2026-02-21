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

      const dpr = window.devicePixelRatio || 1

      // Size canvas at device DPR for crisp rendering
      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)

      // Get pre-rendered tiles (cached or freshly rendered, at matching DPR)
      const tiles = getTilesForTrack(
        songId,
        peaks,
        width,
        height,
        color,
        waveformStyle,
        frequencyColorMode,
        dpr,
        peaksLow,
        peaksMid,
        peaksHigh
      )

      // Blit tiles onto visible canvas (1:1 pixel mapping — no scaling)
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
