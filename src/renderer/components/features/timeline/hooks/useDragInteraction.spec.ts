/**
 * @jest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  beforeAll,
} from '@jest/globals'
import { renderHook } from '@testing-library/react'
import { useDragInteraction } from './useDragInteraction'

// Polyfill PointerEvent for jsdom (not natively available)
beforeAll(() => {
  if (typeof globalThis.PointerEvent === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).PointerEvent = class PointerEvent extends MouseEvent {
      readonly pointerId: number
      constructor(
        type: string,
        init: PointerEventInit & { pointerId?: number } = {}
      ) {
        super(type, init)
        this.pointerId = init.pointerId ?? 0
      }
    }
  }
})

// Mock setPointerCapture/releasePointerCapture (not implemented in jsdom)
function mockPointerCapture(el: HTMLElement): void {
  el.setPointerCapture = jest.fn()
  el.releasePointerCapture = jest.fn()
}

function createPointerEvent(
  type: string,
  opts: { clientX?: number; pointerId?: number } = {}
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    pointerId: opts.pointerId ?? 1,
    bubbles: true,
  })
}

describe('useDragInteraction', () => {
  let onDragStart: jest.Mock
  let onDragMove: jest.Mock
  let onDragEnd: jest.Mock

  beforeEach(() => {
    onDragStart = jest.fn()
    onDragMove = jest.fn()
    onDragEnd = jest.fn()
    document.body.style.userSelect = ''
  })

  function setup(threshold?: number) {
    return renderHook(() =>
      useDragInteraction({
        onDragStart,
        onDragMove,
        onDragEnd,
        threshold,
      })
    )
  }

  it('should return a stable onPointerDown handler', () => {
    const { result, rerender } = setup()
    const first = result.current.onPointerDown
    rerender()
    expect(result.current.onPointerDown).toBe(first)
  })

  it('should not trigger drag for sub-threshold movement', () => {
    const { result } = setup(5)
    const el = document.createElement('div')
    mockPointerCapture(el)

    // Simulate pointer down
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      pointerId: 1,
    })
    Object.defineProperty(downEvent, 'currentTarget', { value: el })
    result.current.onPointerDown(downEvent as unknown as React.PointerEvent)

    // Move 2px (below 5px threshold)
    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 102 }))
    expect(onDragMove).not.toHaveBeenCalled()
    expect(onDragStart).not.toHaveBeenCalled()

    // Release
    el.dispatchEvent(createPointerEvent('pointerup', { clientX: 102 }))
    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('should trigger drag after exceeding threshold', () => {
    const { result } = setup(3)
    const el = document.createElement('div')
    mockPointerCapture(el)

    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      pointerId: 1,
    })
    Object.defineProperty(downEvent, 'currentTarget', { value: el })
    result.current.onPointerDown(downEvent as unknown as React.PointerEvent)

    // Move 5px (above 3px threshold)
    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 105 }))
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragMove).toHaveBeenCalledWith(5, expect.any(PointerEvent))

    // Continue moving
    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 110 }))
    expect(onDragMove).toHaveBeenCalledWith(10, expect.any(PointerEvent))
    expect(onDragStart).toHaveBeenCalledTimes(1) // only called once
  })

  it('should call onDragEnd with final deltaX on pointer up', () => {
    const { result } = setup(3)
    const el = document.createElement('div')
    mockPointerCapture(el)

    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      pointerId: 1,
    })
    Object.defineProperty(downEvent, 'currentTarget', { value: el })
    result.current.onPointerDown(downEvent as unknown as React.PointerEvent)

    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 120 }))
    el.dispatchEvent(createPointerEvent('pointerup', { clientX: 125 }))

    expect(onDragEnd).toHaveBeenCalledWith(25, expect.any(PointerEvent))
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('should prevent text selection during drag', () => {
    const { result } = setup(3)
    const el = document.createElement('div')
    mockPointerCapture(el)

    document.body.style.userSelect = 'auto'
    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      pointerId: 1,
    })
    Object.defineProperty(downEvent, 'currentTarget', { value: el })
    result.current.onPointerDown(downEvent as unknown as React.PointerEvent)

    expect(document.body.style.userSelect).toBe('none')

    el.dispatchEvent(createPointerEvent('pointerup', { clientX: 100 }))
    expect(document.body.style.userSelect).toBe('auto')
  })

  it('should use default threshold of 3 when not specified', () => {
    const { result } = setup() // no threshold
    const el = document.createElement('div')
    mockPointerCapture(el)

    const downEvent = createPointerEvent('pointerdown', {
      clientX: 100,
      pointerId: 1,
    })
    Object.defineProperty(downEvent, 'currentTarget', { value: el })
    result.current.onPointerDown(downEvent as unknown as React.PointerEvent)

    // Move 2px — should not trigger (below default 3)
    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 102 }))
    expect(onDragMove).not.toHaveBeenCalled()

    // Move 3px — should trigger
    el.dispatchEvent(createPointerEvent('pointermove', { clientX: 103 }))
    expect(onDragMove).toHaveBeenCalledWith(3, expect.any(PointerEvent))
  })
})
