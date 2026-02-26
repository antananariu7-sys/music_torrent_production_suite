import { useEffect, type RefObject, type MutableRefObject } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { MIN_ZOOM, MAX_ZOOM } from '../TimelineLayout'

interface UseTimelineZoomOptions {
  containerRef: RefObject<HTMLDivElement | null>
  isScrollSyncing: MutableRefObject<boolean>
  zoomRef: MutableRefObject<{ zoomLevel: number; totalWidth: number }>
}

export function useTimelineZoom({
  containerRef,
  isScrollSyncing,
  zoomRef,
}: UseTimelineZoomOptions) {
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)
  const setScrollPosition = useTimelineStore((s) => s.setScrollPosition)

  // Ctrl+scroll zoom with stable cursor point
  // Attached once via useEffect with { passive: false } so preventDefault() works.
  // Reads zoomLevel/totalWidth from ref to avoid re-attaching on every zoom tick.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()

      const { zoomLevel: currentZoom, totalWidth: currentTotalWidth } =
        zoomRef.current

      const rect = el.getBoundingClientRect()
      const cursorXInViewport = e.clientX - rect.left
      const cursorXInTimeline = cursorXInViewport + el.scrollLeft

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom * zoomFactor)
      )

      const cursorFraction =
        currentTotalWidth > 0 ? cursorXInTimeline / currentTotalWidth : 0
      const newTotalWidth = currentTotalWidth * (newZoom / currentZoom)
      const newScrollLeft = cursorFraction * newTotalWidth - cursorXInViewport

      setZoomLevel(newZoom)

      requestAnimationFrame(() => {
        isScrollSyncing.current = true
        el.scrollLeft = Math.max(0, newScrollLeft)
        setScrollPosition(Math.max(0, newScrollLeft))
        requestAnimationFrame(() => {
          isScrollSyncing.current = false
        })
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [setZoomLevel, setScrollPosition])
}
