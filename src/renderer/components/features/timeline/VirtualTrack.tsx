import { memo, useRef, useState, useEffect } from 'react'

interface VirtualTrackProps {
  left: number
  width: number
  height: number
  children: React.ReactNode
}

/**
 * Wrapper that only mounts children when the track intersects the scroll viewport.
 * Uses IntersectionObserver with 500px horizontal buffer to pre-mount tracks
 * just before they scroll into view.
 */
export const VirtualTrack = memo(function VirtualTrack({
  left,
  width,
  height,
  children,
}: VirtualTrackProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Find the scrollable ancestor (overflowX: auto container)
    const root = el.closest('[data-timeline-scroll]') as HTMLElement | null

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root, rootMargin: '0px 500px 0px 500px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: 0,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      {isVisible ? children : null}
    </div>
  )
})
