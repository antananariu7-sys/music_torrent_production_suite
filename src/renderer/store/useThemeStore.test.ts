// Jest globals are available without import
import { useThemeStore } from './useThemeStore'

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useThemeStore.setState({ mode: 'dark' })
  })

  it('should initialize with dark mode as default', () => {
    const { mode } = useThemeStore.getState()
    expect(mode).toBe('dark')
  })

  it('should set mode to light', () => {
    const { setMode } = useThemeStore.getState()
    setMode('light')
    const { mode } = useThemeStore.getState()
    expect(mode).toBe('light')
  })

  it('should set mode to dark', () => {
    const { setMode } = useThemeStore.getState()
    setMode('light')
    setMode('dark')
    const { mode } = useThemeStore.getState()
    expect(mode).toBe('dark')
  })

  it('should toggle mode from dark to light', () => {
    const { toggleMode } = useThemeStore.getState()
    toggleMode()
    const { mode } = useThemeStore.getState()
    expect(mode).toBe('light')
  })

  it('should toggle mode from light to dark', () => {
    const { setMode, toggleMode } = useThemeStore.getState()
    setMode('light')
    toggleMode()
    const { mode } = useThemeStore.getState()
    expect(mode).toBe('dark')
  })

  it('should toggle mode multiple times correctly', () => {
    const { toggleMode } = useThemeStore.getState()

    toggleMode()
    expect(useThemeStore.getState().mode).toBe('light')

    toggleMode()
    expect(useThemeStore.getState().mode).toBe('dark')

    toggleMode()
    expect(useThemeStore.getState().mode).toBe('light')
  })
})
