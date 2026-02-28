import { useRef, useEffect, memo } from 'react'
import type {
  TrackSection,
  SectionType,
} from '@shared/types/sectionDetection.types'

/** Section type → fill color (all at 15% opacity in canvas) */
const SECTION_COLORS: Record<SectionType, string> = {
  intro: 'rgba(99, 102, 241, 0.15)', // indigo
  buildup: 'rgba(245, 158, 11, 0.15)', // amber
  drop: 'rgba(239, 68, 68, 0.15)', // red
  breakdown: 'rgba(139, 92, 246, 0.15)', // violet
  outro: 'rgba(6, 182, 212, 0.15)', // cyan
  custom: 'rgba(107, 114, 128, 0.15)', // gray
}

/** Section type → label text color (for readable labels) */
const LABEL_COLORS: Record<SectionType, string> = {
  intro: 'rgba(99, 102, 241, 0.7)',
  buildup: 'rgba(245, 158, 11, 0.7)',
  drop: 'rgba(239, 68, 68, 0.7)',
  breakdown: 'rgba(139, 92, 246, 0.7)',
  outro: 'rgba(6, 182, 212, 0.7)',
  custom: 'rgba(107, 114, 128, 0.7)',
}

/** Section type → display label */
const SECTION_LABELS: Record<SectionType, string> = {
  intro: 'Intro',
  buildup: 'Build',
  drop: 'Drop',
  breakdown: 'Break',
  outro: 'Outro',
  custom: '',
}

/** Minimum band width in pixels to show a label */
const MIN_LABEL_WIDTH = 40

interface SectionBandsProps {
  sections: TrackSection[]
  duration: number
  width: number
  height: number
}

/**
 * Canvas overlay rendering colored section bands behind the waveform.
 * Positioned absolutely, pointer-events disabled.
 */
export const SectionBands = memo(function SectionBands({
  sections,
  duration,
  width,
  height,
}: SectionBandsProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (
      !canvas ||
      sections.length === 0 ||
      duration <= 0 ||
      width <= 0 ||
      height <= 0
    )
      return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    for (const section of sections) {
      const x = (section.startTime / duration) * width
      const w = ((section.endTime - section.startTime) / duration) * width

      // Draw section band
      ctx.fillStyle = SECTION_COLORS[section.type]
      ctx.fillRect(x, 0, w, height)

      // Draw section boundary line (left edge, skip first)
      if (section.startTime > 0) {
        ctx.strokeStyle = LABEL_COLORS[section.type]
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw label if band is wide enough
      const label = section.label ?? SECTION_LABELS[section.type]
      if (label && w >= MIN_LABEL_WIDTH) {
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillStyle = LABEL_COLORS[section.type]
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, x + w / 2, 4, w - 8)
      }
    }
  }, [sections, duration, width, height])

  if (sections.length === 0 || duration <= 0 || width <= 0 || height <= 0) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    />
  )
})
