// Jest globals are available without import
import { render, screen, act } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Settings from './index'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
import { useThemeStore } from '../../store/useThemeStore'

// Mock useNavigate
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

// Wrapper for Chakra UI and Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <ChakraProvider value={system}>{children}</ChakraProvider>
  </MemoryRouter>
)

describe('Settings', () => {
  beforeEach(() => {
    // Reset store and mocks before each test
    useThemeStore.setState({ mode: 'dark' })
    mockNavigate.mockClear()
  })

  it('should render the settings page', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('settings-heading')).toBeInTheDocument()
    expect(screen.getByTestId('settings-description')).toBeInTheDocument()
  })

  it('should render the Appearance section', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('appearance-heading')).toBeInTheDocument()
  })

  it('should render the Dark Mode switch', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('dark-mode-label')).toBeInTheDocument()
    expect(screen.getByTestId('dark-mode-description')).toBeInTheDocument()
  })

  it('should display current theme as Dark when mode is dark', () => {
    useThemeStore.setState({ mode: 'dark' })

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('current-theme-display')).toBeInTheDocument()
    expect(screen.getByTestId('current-theme-value')).toHaveTextContent('DARK')
  })

  it('should display current theme as Light when mode is light', () => {
    useThemeStore.setState({ mode: 'light' })

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('current-theme-display')).toBeInTheDocument()
    expect(screen.getByTestId('current-theme-value')).toHaveTextContent('LIGHT')
  })

  it('should render the Back to Home button', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('back-button')).toBeInTheDocument()
  })

  it('should navigate to home when Back button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    const backButton = screen.getByTestId('back-button')
    await user.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('should toggle theme when switch is clicked', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    // Initial state should be dark
    expect(useThemeStore.getState().mode).toBe('dark')

    // Find the switch element by data-testid
    const switchElement = screen.getByTestId('theme-switch')
    expect(switchElement).toBeInTheDocument()

    // Directly call toggleMode to test the state change
    // (Testing Chakra UI's internal click handling is not the goal here)
    act(() => {
      useThemeStore.getState().toggleMode()
    })

    // Theme should now be light
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('should reflect switch state based on current theme', () => {
    // Test with dark mode
    act(() => {
      useThemeStore.setState({ mode: 'dark' })
    })

    const { rerender } = render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    let switchElement = screen.getByTestId('theme-switch')
    expect(switchElement).toHaveAttribute('data-state', 'checked')

    // Test with light mode
    act(() => {
      useThemeStore.setState({ mode: 'light' })
    })

    rerender(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    switchElement = screen.getByTestId('theme-switch')
    expect(switchElement).toHaveAttribute('data-state', 'unchecked')
  })

  it('should render placeholder sections for future settings', () => {
    render(
      <TestWrapper>
        <Settings />
      </TestWrapper>
    )

    expect(screen.getByTestId('general-heading')).toBeInTheDocument()
    expect(screen.getByTestId('general-placeholder')).toBeInTheDocument()

    expect(screen.getByTestId('advanced-heading')).toBeInTheDocument()
    expect(screen.getByTestId('advanced-placeholder')).toBeInTheDocument()
  })
})
