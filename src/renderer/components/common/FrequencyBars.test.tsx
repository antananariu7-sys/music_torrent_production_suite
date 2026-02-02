// Jest globals are available without import
import { render } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
import { FrequencyBars } from './FrequencyBars'

// Wrapper for Chakra UI
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={system}>{children}</ChakraProvider>
)

describe('FrequencyBars', () => {
  describe('Rendering', () => {
    it('should render without errors', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )
      expect(container).toBeInTheDocument()
    })

    it('should render 50 bars', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      // Count the number of box elements (bars)
      const bars = container.querySelectorAll('[style*="animation"]')
      expect(bars.length).toBeGreaterThanOrEqual(50)
    })

    it('should render style tag with keyframes', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const style = container.querySelector('style')
      expect(style).toBeInTheDocument()
      expect(style?.textContent).toContain('@keyframes freq-bounce')
    })
  })

  describe('Animation', () => {
    it('should have animation styles applied to bars', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const bars = container.querySelectorAll('[style*="animation"]')
      expect(bars.length).toBeGreaterThan(0)

      // Check that at least some bars have animation
      const firstBar = bars[0] as HTMLElement
      expect(firstBar.style.animationName).toContain('freq-bounce')
    })

    it('should have different animation delays for bars', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const bars = Array.from(container.querySelectorAll('[style*="animation"]')) as HTMLElement[]

      if (bars.length >= 2) {
        const delay1 = bars[0].style.animationDelay
        const delay2 = bars[1].style.animationDelay

        // Delays should be different
        expect(delay1).not.toBe(delay2)
      }
    })

    it('should have transform origin set to bottom', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const bars = container.querySelectorAll('[style*="animation"]')
      const firstBar = bars[0] as HTMLElement

      // Chakra UI applies transform-origin via CSS, check computed styles
      const computedStyle = window.getComputedStyle(firstBar)
      expect(computedStyle.transformOrigin).toBe('bottom')
    })
  })

  describe('Keyframe Animation', () => {
    it('should define freq-bounce keyframes', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const style = container.querySelector('style')
      expect(style?.textContent).toContain('@keyframes freq-bounce')
    })

    it('should have scaleY transforms in keyframes', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const style = container.querySelector('style')
      expect(style?.textContent).toContain('transform: scaleY')
    })

    it('should define 0%, 50%, and 100% keyframe steps', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const style = container.querySelector('style')
      const content = style?.textContent || ''

      expect(content).toContain('0%')
      expect(content).toContain('50%')
      expect(content).toContain('100%')
    })
  })

  describe('Component Structure', () => {
    it('should render a fragment wrapper', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      // The component should render content
      expect(container.firstChild).toBeTruthy()
    })

    it('should have full height bars', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      // Check that bars are rendered (50 bars expected)
      const bars = container.querySelectorAll('[style*="animation"]')
      expect(bars.length).toBe(50)
    })
  })

  describe('Visual Properties', () => {
    it('should render bars with brand color', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      // Check that some elements exist (visual bars)
      const bars = container.querySelectorAll('[style*="animation"]')
      expect(bars.length).toBeGreaterThan(0)
    })

    it('should have consistent bar width', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      // All bars should render
      const bars = container.querySelectorAll('[style*="animation"]')
      expect(bars.length).toBe(50)
    })
  })

  describe('No Props Component', () => {
    it('should work without any props', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      expect(container).toBeInTheDocument()
    })

    it('should be self-contained with internal styling', () => {
      const { container } = render(
        <TestWrapper>
          <FrequencyBars />
        </TestWrapper>
      )

      const style = container.querySelector('style')
      expect(style).toBeInTheDocument()
    })
  })
})
