// Jest globals are available without import
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Welcome from './index'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
import type { AppInfo } from '../../../shared/types/app.types'

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

const mockAppInfo: AppInfo = {
  name: 'test-app',
  version: '2.0.0',
  platform: 'win32',
  arch: 'x64',
}

describe('Welcome', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  describe('Header Section', () => {
    it('should render the settings button', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-button-settings')).toBeInTheDocument()
    })

    it('should navigate to settings when settings button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      const settingsButton = screen.getByTestId('welcome-button-settings')
      await user.click(settingsButton)

      expect(mockNavigate).toHaveBeenCalledWith('/settings')
    })
  })

  describe('Hero Section', () => {
    it('should render the version text', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-text-version')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-text-version')).toHaveTextContent(
        '// PRODUCTION SUITE V2.0'
      )
    })

    it('should render the main heading', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-heading-main')).toBeInTheDocument()
    })

    it('should render the description text', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-text-description')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-text-description')).toHaveTextContent(
        'Integrated torrent search, download management, and mixing capabilities'
      )
    })

    it('should render the online status badge', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-badge-online')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-badge-online')).toHaveTextContent(
        '● ONLINE'
      )
    })

    it('should render the modules loaded badge', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-badge-modules')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-badge-modules')).toHaveTextContent(
        '3 MODULES LOADED'
      )
    })

    it('should render the audio spectrum section', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-section-spectrum')).toBeInTheDocument()
    })
  })

  describe('Feature Cards', () => {
    it('should render the Torrent Search card', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('welcome-card-torrent-search')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('welcome-heading-torrent-search')
      ).toHaveTextContent('Torrent Search')
      expect(
        screen.getByTestId('welcome-text-torrent-search')
      ).toHaveTextContent('Automated RuTracker search')
      expect(
        screen.getByTestId('welcome-button-torrent-search')
      ).toBeInTheDocument()
      expect(screen.getByTestId('welcome-button-torrent-search')).toBeDisabled()
    })

    it('should render the Download Manager card', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('welcome-card-download-manager')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('welcome-heading-download-manager')
      ).toHaveTextContent('Download Manager')
      expect(
        screen.getByTestId('welcome-text-download-manager')
      ).toHaveTextContent('WebTorrent-based downloads')
      expect(
        screen.getByTestId('welcome-button-download-manager')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('welcome-button-download-manager')
      ).toBeDisabled()
    })

    it('should render the Music Mixer card', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-card-mixer')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-heading-mixer')).toHaveTextContent(
        'Music Mixer'
      )
      expect(screen.getByTestId('welcome-text-mixer')).toHaveTextContent(
        'Professional audio mixing'
      )
      expect(screen.getByTestId('welcome-button-mixer')).toBeInTheDocument()
      expect(screen.getByTestId('welcome-button-mixer')).toBeDisabled()
    })

    it('should have all feature buttons disabled (coming soon)', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('welcome-button-torrent-search')
      ).toHaveTextContent('Coming Soon')
      expect(
        screen.getByTestId('welcome-button-download-manager')
      ).toHaveTextContent('Coming Soon')
      expect(screen.getByTestId('welcome-button-mixer')).toHaveTextContent(
        'Coming Soon'
      )
    })
  })

  describe('Footer Section', () => {
    it('should not render footer when appInfo is null', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.queryByTestId('welcome-footer-info')
      ).not.toBeInTheDocument()
    })

    it('should render footer when appInfo is provided', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-footer-info')).toBeInTheDocument()
    })

    it('should display correct version information', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-text-app-version')).toHaveTextContent(
        'VERSION 2.0.0'
      )
    })

    it('should display correct platform information', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-text-platform')).toHaveTextContent(
        'WIN32 / X64'
      )
    })

    it('should display copyright text', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('welcome-text-copyright')).toHaveTextContent(
        '© 2026 Music Production Suite. Built with Electron + React.'
      )
    })
  })

  describe('Layout', () => {
    it('should render without errors', () => {
      const { container } = render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(container).toBeInTheDocument()
    })

    it('should render all main sections', () => {
      render(
        <TestWrapper>
          <Welcome appInfo={mockAppInfo} />
        </TestWrapper>
      )

      // Header
      expect(screen.getByTestId('welcome-button-settings')).toBeInTheDocument()
      // Hero
      expect(screen.getByTestId('welcome-heading-main')).toBeInTheDocument()
      // Feature cards
      expect(
        screen.getByTestId('welcome-card-torrent-search')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('welcome-card-download-manager')
      ).toBeInTheDocument()
      expect(screen.getByTestId('welcome-card-mixer')).toBeInTheDocument()
      // Footer
      expect(screen.getByTestId('welcome-footer-info')).toBeInTheDocument()
    })
  })
})
