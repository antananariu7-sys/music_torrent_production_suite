// Jest globals are available without import
import { render } from '@testing-library/react'
import { Waveform } from './Waveform'

describe('Waveform', () => {
  describe('Rendering', () => {
    it('should render without errors', () => {
      const { container } = render(<Waveform />)
      expect(container).toBeInTheDocument()
    })

    it('should render an SVG element', () => {
      const { container } = render(<Waveform />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should render 40 bars', () => {
      const { container } = render(<Waveform />)
      const rects = container.querySelectorAll('rect')
      expect(rects).toHaveLength(40)
    })

    it('should have correct SVG dimensions', () => {
      const { container } = render(<Waveform />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '100%')
      expect(svg).toHaveAttribute('height', '60')
      expect(svg).toHaveAttribute('viewBox', '0 0 400 60')
    })
  })

  describe('Color Prop', () => {
    it('should use currentColor as default color', () => {
      const { container } = render(<Waveform />)
      const rect = container.querySelector('rect')
      expect(rect).toHaveAttribute('fill', 'currentColor')
    })

    it('should apply custom color', () => {
      const { container } = render(<Waveform color="#FF0000" />)
      const rect = container.querySelector('rect')
      expect(rect).toHaveAttribute('fill', '#FF0000')
    })

    it('should apply color to all bars', () => {
      const customColor = 'rgb(255, 0, 0)'
      const { container } = render(<Waveform color={customColor} />)
      const rects = container.querySelectorAll('rect')

      rects.forEach((rect) => {
        expect(rect).toHaveAttribute('fill', customColor)
      })
    })
  })

  describe('Animation Prop', () => {
    it('should not have animation styles when animate is false', () => {
      const { container } = render(<Waveform animate={false} />)
      const rect = container.querySelector('rect')
      expect(rect?.style.animation).toBeFalsy()
    })

    it('should not render style tag when animate is false', () => {
      const { container } = render(<Waveform animate={false} />)
      const style = container.querySelector('style')
      expect(style).not.toBeInTheDocument()
    })

    it('should have animation styles when animate is true', () => {
      const { container } = render(<Waveform animate={true} />)
      const rect = container.querySelector('rect')
      expect(rect?.style.animation).toBeTruthy()
      expect(rect?.style.animation).toContain('wave-pulse')
    })

    it('should render style tag with keyframes when animate is true', () => {
      const { container } = render(<Waveform animate={true} />)
      const style = container.querySelector('style')
      expect(style).toBeInTheDocument()
      expect(style?.textContent).toContain('@keyframes wave-pulse')
    })

    it('should apply different animation delays to bars', () => {
      const { container } = render(<Waveform animate={true} />)
      const rects = container.querySelectorAll('rect')

      const delays = Array.from(rects).map(
        (rect) => (rect as unknown as HTMLElement).style.animationDelay
      )

      // Check that delays are different and in ascending order
      expect(delays[0]).toBe('0s')
      expect(delays[1]).not.toBe(delays[0])
      expect(delays[5]).not.toBe(delays[0])
    })

    it('should have transform origin set when animated', () => {
      const { container } = render(<Waveform animate={true} />)
      const rect = container.querySelector('rect') as unknown as HTMLElement
      expect(rect?.style.transformOrigin).toBe('center')
    })
  })

  describe('Bar Properties', () => {
    it('should have rounded corners (rx attribute)', () => {
      const { container } = render(<Waveform />)
      const rect = container.querySelector('rect')
      expect(rect).toHaveAttribute('rx', '3')
    })

    it('should have fixed width for each bar', () => {
      const { container } = render(<Waveform />)
      const rect = container.querySelector('rect')
      expect(rect).toHaveAttribute('width', '6')
    })

    it('should position bars horizontally with 10px spacing', () => {
      const { container } = render(<Waveform />)
      const rects = container.querySelectorAll('rect')

      expect(rects[0]).toHaveAttribute('x', '0')
      expect(rects[1]).toHaveAttribute('x', '10')
      expect(rects[2]).toHaveAttribute('x', '20')
    })
  })

  describe('Default Props', () => {
    it('should work with no props provided', () => {
      const { container } = render(<Waveform />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('should work with only color prop', () => {
      const { container } = render(<Waveform color="blue" />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should work with only animate prop', () => {
      const { container } = render(<Waveform animate={true} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('should work with both props', () => {
      const { container } = render(<Waveform color="red" animate={true} />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })
  })
})
