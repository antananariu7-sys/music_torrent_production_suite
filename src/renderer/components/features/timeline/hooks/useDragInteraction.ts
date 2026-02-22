import { useRef, useCallback } from 'react'

interface UseDragInteractionOptions {
  onDragStart?: (e: PointerEvent) => void
  onDragMove: (deltaX: number, e: PointerEvent) => void
  onDragEnd: (deltaX: number, e: PointerEvent) => void
  /** Minimum px of movement before drag activates (default: 3) */
  threshold?: number
}

interface UseDragInteractionReturn {
  onPointerDown: (e: React.PointerEvent) => void
}

/**
 * Shared hook for pointer-capture drag behavior.
 *
 * Uses Pointer API with setPointerCapture for reliable tracking.
 * Activates drag only after movement exceeds the threshold, allowing
 * sub-threshold clicks to pass through to parent handlers.
 */
export function useDragInteraction(
  options: UseDragInteractionOptions
): UseDragInteractionReturn {
  // Store latest options in a ref so closures always see current values
  const optionsRef = useRef(options)
  optionsRef.current = options

  const stateRef = useRef<{
    startX: number
    isDragging: boolean
    pointerId: number
    target: HTMLElement
  } | null>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    stateRef.current = {
      startX: e.clientX,
      isDragging: false,
      pointerId: e.pointerId,
      target,
    }

    // Prevent text selection during potential drag
    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    const handleMove = (ev: PointerEvent): void => {
      const state = stateRef.current
      if (!state) return
      const deltaX = ev.clientX - state.startX
      const threshold = optionsRef.current.threshold ?? 3

      if (!state.isDragging && Math.abs(deltaX) >= threshold) {
        state.isDragging = true
        optionsRef.current.onDragStart?.(ev)
      }
      if (state.isDragging) {
        optionsRef.current.onDragMove(deltaX, ev)
      }
    }

    const handleUp = (ev: PointerEvent): void => {
      const state = stateRef.current
      if (!state) return

      if (state.isDragging) {
        const deltaX = ev.clientX - state.startX
        optionsRef.current.onDragEnd(deltaX, ev)
      }

      target.releasePointerCapture(state.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
      document.body.style.userSelect = prevUserSelect
      stateRef.current = null
    }

    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }, [])

  return { onPointerDown }
}
