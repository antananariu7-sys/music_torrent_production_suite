import { Box, HStack, IconButton } from '@chakra-ui/react'
import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { AppInfo } from '@shared/types/app.types'
import Layout from './Layout'
import { FrequencyBars } from './FrequencyBars'
import { Footer } from './Footer'

interface PageLayoutProps {
  /**
   * Page content to render
   */
  children: ReactNode
  /**
   * Application information for footer
   */
  appInfo: AppInfo | null
  /**
   * Maximum width of the content container
   */
  maxW?: 'container.md' | 'container.lg' | 'container.xl' | '1400px'
  /**
   * Whether to show copyright text in footer
   */
  showCopyright?: boolean
  /**
   * Whether to show the frequency bars background effect
   */
  showFrequencyBars?: boolean
  /**
   * Custom styles to inject (for page-specific animations/styles)
   */
  customStyles?: string
}

export function PageLayout({
  children,
  appInfo,
  maxW = 'container.xl',
  showCopyright = false,
  showFrequencyBars = true,
  customStyles,
}: PageLayoutProps): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

  // Determine if we're on the home page
  const isHomePage = location.pathname === '/'

  return (
    <>
      {customStyles && <style>{customStyles}</style>}

      {/* Frequency visualization at bottom - only if enabled */}
      {showFrequencyBars && (
        <Box
          position="fixed"
          bottom="0"
          left="0"
          right="0"
          height="120px"
          overflow="hidden"
          opacity="0.15"
          pointerEvents="none"
          zIndex="0"
        >
          <FrequencyBars />
        </Box>
      )}

      <Layout maxW={maxW}>
        {/* Header with Navigation Button */}
        <HStack justify="flex-end" mb={8}>
          {isHomePage ? (
            <IconButton
              data-testid="page-button-settings"
              aria-label="Open settings"
              onClick={() => navigate('/settings')}
              variant="ghost"
              size="lg"
              colorPalette="brand"
              fontSize="2xl"
              className="settings-icon"
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              ⚙️
            </IconButton>
          ) : (
            <IconButton
              data-testid="page-button-back"
              aria-label="Back to home"
              onClick={() => navigate('/')}
              variant="ghost"
              size="lg"
              colorPalette="brand"
              fontSize="2xl"
              className="back-icon"
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              ←
            </IconButton>
          )}
        </HStack>

        {/* Page Content */}
        {children}

        {/* Footer */}
        <Footer appInfo={appInfo} showCopyright={showCopyright} />
      </Layout>
    </>
  )
}
