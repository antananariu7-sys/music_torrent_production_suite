import { useState } from 'react'
import { Box, Heading, VStack, Text } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'
import { useAuthStore } from '@/store/useAuthStore'
import { PageLayout } from '@/components/common'
import { settingsStyles } from './Settings.styles'
import { GeneralSettings } from './components/GeneralSettings'
import { SearchSettings } from './components/SearchSettings'
import { WebTorrentSettings } from './components/WebTorrentSettings'
import { RuTrackerAuthCard } from './components/RuTrackerAuthCard'
import { DebugSettings } from './components/DebugSettings'
import { AdvancedSettings } from './components/AdvancedSettings'

interface SettingsProps {
  appInfo: AppInfo | null
}

/**
 * Settings Page
 *
 * Main settings container with organized sections:
 * - Appearance (theme)
 * - Search (auto-scan)
 * - Downloads (WebTorrent)
 * - Authentication (RuTracker)
 * - Debug (auth state)
 * - Advanced (placeholder)
 */
function Settings({ appInfo }: SettingsProps) {
  const { login, logout } = useAuthStore()
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  const handleLogin = async (
    username: string,
    password: string,
    remember: boolean
  ) => {
    console.log('[Settings] 🔐 Login attempt:', { username, remember })
    setIsAuthLoading(true)
    try {
      const result = await window.api.auth.login({
        username,
        password,
        remember,
      })
      console.log('[Settings] Login result:', result)

      if (result.success) {
        login(username)
        console.log('[Settings] ✅ Store updated, user logged in:', username)
      } else {
        console.error('[Settings] ❌ Login failed:', result.error)
        throw new Error(result.error || 'Login failed')
      }
    } catch (error) {
      console.error('[Settings] Login exception:', error)
      throw error
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    console.log('[Settings] 🚪 Logout attempt')
    setIsAuthLoading(true)
    try {
      await window.api.auth.logout()
      logout()
      console.log('[Settings] ✅ Logout successful, store cleared')
    } catch (error) {
      console.error('[Settings] Logout exception:', error)
      throw error
    } finally {
      setIsAuthLoading(false)
    }
  }

  return (
    <PageLayout
      appInfo={appInfo}
      maxW="container.md"
      customStyles={settingsStyles}
      showFrequencyBars={false}
    >
      {/* Header */}
      <VStack gap={8} mb={12} align="start" className="settings-header">
        <Box w="full">
          <Text
            fontSize="xs"
            fontWeight="bold"
            letterSpacing="widest"
            textTransform="uppercase"
            color="accent.400"
            fontFamily="monospace"
            mb={3}
          >
            SYSTEM CONFIGURATION
          </Text>
          <Heading
            as="h1"
            fontSize={{ base: '4xl', md: '5xl' }}
            fontWeight="900"
            color="text.primary"
            data-testid="settings-heading"
            letterSpacing="-0.02em"
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              textTransform: 'uppercase',
            }}
          >
            Settings
          </Heading>
          <Text
            fontSize="lg"
            color="text.secondary"
            data-testid="settings-description"
            mt={3}
            fontWeight="500"
          >
            Customize your Music Production Suite experience
          </Text>
        </Box>
      </VStack>

      {/* Settings Sections */}
      <VStack gap={6} align="stretch">
        <GeneralSettings />
        <SearchSettings />
        <WebTorrentSettings />
        <RuTrackerAuthCard
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoading={isAuthLoading}
        />
        <DebugSettings />
        <AdvancedSettings />
      </VStack>
    </PageLayout>
  )
}

export default Settings
