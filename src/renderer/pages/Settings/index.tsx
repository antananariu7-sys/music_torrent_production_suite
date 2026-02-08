import { useState, useEffect } from 'react'
import { Box, Heading, VStack, HStack, Text, Card, Input } from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'
import type { WebTorrentSettings } from '@shared/types/torrent.types'
import { useThemeStore } from '@/store/useThemeStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { PageLayout } from '@/components/common'
import { settingsStyles } from './Settings.styles'
import { RuTrackerAuthCard } from './components/RuTrackerAuthCard'

interface SettingsProps {
  appInfo: AppInfo | null
}

function Settings({ appInfo }: SettingsProps) {
  const { mode, toggleMode } = useThemeStore()
  const {
    login,
    logout,
    isLoggedIn,
    username,
    sessionExpiry,
    isAuthenticated,
    isSessionRestored,
  } = useAuthStore()
  const { autoScanDiscography, setAutoScanDiscography } = useSettingsStore()
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [wtSettings, setWtSettings] = useState<WebTorrentSettings | null>(null)
  const [isSavingWt, setIsSavingWt] = useState(false)
  const [debugInfo, setDebugInfo] = useState<{
    cookies: Array<{
      name: string
      value: string
      domain: string
      path: string
      expires: number
    }>
    cookieCount: number
  } | null>(null)

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

  // Load WebTorrent settings
  useEffect(() => {
    const loadWtSettings = async () => {
      try {
        const response = await window.api.webtorrent.getSettings()
        if (response.success && response.data) {
          setWtSettings(response.data)
        }
      } catch (err) {
        console.error('[Settings] Failed to load WebTorrent settings:', err)
      }
    }
    loadWtSettings()
  }, [])

  const saveWtSettings = async (updates: Partial<WebTorrentSettings>) => {
    setIsSavingWt(true)
    try {
      const response = await window.api.webtorrent.updateSettings(updates)
      if (response.success && response.data) {
        setWtSettings(response.data)
      }
    } catch (err) {
      console.error('[Settings] Failed to save WebTorrent settings:', err)
    } finally {
      setIsSavingWt(false)
    }
  }

  // Load debug info when logged in
  useEffect(() => {
    const loadDebugInfo = async () => {
      if (isLoggedIn) {
        try {
          const response = await window.api.auth.getDebugInfo()
          if (response.success && response.data) {
            setDebugInfo(response.data)
          }
        } catch (error) {
          console.error('[Settings] Failed to load debug info:', error)
        }
      } else {
        setDebugInfo(null)
      }
    }

    loadDebugInfo()
  }, [isLoggedIn])

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
        {/* Appearance Section */}
        <Card.Root
          bg="bg.card"
          borderWidth="2px"
          borderColor="border.base"
          borderRadius="xl"
          overflow="hidden"
          data-testid="appearance-section"
          className="settings-card settings-card-1"
        >
          <Card.Header
            p={6}
            borderBottomWidth="1px"
            borderBottomColor="border.base"
            bg="bg.surface"
          >
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Heading
                  size="lg"
                  color="text.primary"
                  data-testid="appearance-heading"
                  fontWeight="800"
                  letterSpacing="-0.01em"
                >
                  Appearance
                </Heading>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  color="brand.400"
                  fontWeight="bold"
                >
                  SECTION_01
                </Text>
              </VStack>
              <Text fontSize="3xl">🎨</Text>
            </HStack>
          </Card.Header>
          <Card.Body gap={6} p={6}>
            {/* Theme Toggle */}
            <Box>
              <HStack justify="space-between" mb={4}>
                <VStack align="start" gap={1} flex={1}>
                  <Text
                    fontWeight="bold"
                    color="text.primary"
                    data-testid="dark-mode-label"
                    fontSize="md"
                  >
                    Dark Mode
                  </Text>
                  <Text
                    fontSize="sm"
                    color="text.secondary"
                    data-testid="dark-mode-description"
                  >
                    Switch between light and dark themes
                  </Text>
                </VStack>
                <Switch.Root
                  checked={mode === 'dark'}
                  onCheckedChange={() => toggleMode()}
                  colorPalette="brand"
                  size="lg"
                  data-testid="theme-switch"
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label />
                </Switch.Root>
              </HStack>

              {/* Current Theme Display */}
              <Box
                p={4}
                borderRadius="lg"
                bg="bg.surface"
                borderWidth="2px"
                borderColor={mode === 'dark' ? 'brand.500' : 'gray.300'}
                data-testid="current-theme-display"
                className={
                  mode === 'dark' ? 'theme-indicator active' : 'theme-indicator'
                }
              >
                <HStack justify="space-between">
                  <VStack align="start" gap={1}>
                    <Text
                      fontSize="xs"
                      fontFamily="monospace"
                      color="text.muted"
                    >
                      ACTIVE THEME
                    </Text>
                    <HStack gap={2}>
                      <Box
                        w="3"
                        h="3"
                        bg={mode === 'dark' ? 'brand.400' : 'gray.400'}
                        borderRadius="full"
                      />
                      <Text
                        fontWeight="bold"
                        color="text.primary"
                        data-testid="current-theme-value"
                        fontFamily="monospace"
                        fontSize="sm"
                      >
                        {mode === 'dark' ? 'DARK' : 'LIGHT'}
                      </Text>
                    </HStack>
                  </VStack>
                  <Text fontSize="2xl">{mode === 'dark' ? '🌙' : '☀️'}</Text>
                </HStack>
              </Box>
            </Box>

            {/* Theme Preview */}
            <Box>
              <Text
                fontSize="xs"
                fontFamily="monospace"
                color="text.muted"
                mb={3}
                fontWeight="bold"
              >
                COLOR PREVIEW
              </Text>
              <HStack gap={2}>
                <Box
                  flex="1"
                  h="60px"
                  bg="brand.500"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="white"
                    fontFamily="monospace"
                  >
                    BRAND
                  </Text>
                </Box>
                <Box
                  flex="1"
                  h="60px"
                  bg="accent.500"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="white"
                    fontFamily="monospace"
                  >
                    ACCENT
                  </Text>
                </Box>
                <Box
                  flex="1"
                  h="60px"
                  bg="bg.surface"
                  borderWidth="2px"
                  borderColor="border.base"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color="text.primary"
                    fontFamily="monospace"
                  >
                    SURFACE
                  </Text>
                </Box>
              </HStack>
            </Box>
          </Card.Body>
        </Card.Root>

        {/* Search Section */}
        <Card.Root
          bg="bg.card"
          borderWidth="2px"
          borderColor="border.base"
          borderRadius="xl"
          overflow="hidden"
          data-testid="search-section"
          className="settings-card settings-card-2"
        >
          <Card.Header
            p={6}
            borderBottomWidth="1px"
            borderBottomColor="border.base"
            bg="bg.surface"
          >
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Heading
                  size="lg"
                  color="text.primary"
                  data-testid="search-heading"
                  fontWeight="800"
                  letterSpacing="-0.01em"
                >
                  Search
                </Heading>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  color="brand.400"
                  fontWeight="bold"
                >
                  SECTION_02
                </Text>
              </VStack>
              <Text fontSize="3xl">🔍</Text>
            </HStack>
          </Card.Header>
          <Card.Body gap={6} p={6}>
            <Box>
              <HStack justify="space-between">
                <VStack align="start" gap={1} flex={1}>
                  <Text
                    fontWeight="bold"
                    color="text.primary"
                    data-testid="auto-scan-label"
                    fontSize="md"
                  >
                    Auto-scan discography pages
                  </Text>
                  <Text
                    fontSize="sm"
                    color="text.secondary"
                    data-testid="auto-scan-description"
                  >
                    Automatically scan discography pages for your selected album
                    when search results arrive
                  </Text>
                </VStack>
                <Switch.Root
                  checked={autoScanDiscography}
                  onCheckedChange={(e) => setAutoScanDiscography(e.checked)}
                  colorPalette="brand"
                  size="lg"
                  data-testid="auto-scan-switch"
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label />
                </Switch.Root>
              </HStack>
            </Box>
          </Card.Body>
        </Card.Root>

        {/* Downloads Section */}
        {wtSettings && (
          <Card.Root
            bg="bg.card"
            borderWidth="2px"
            borderColor="border.base"
            borderRadius="xl"
            overflow="hidden"
            className="settings-card settings-card-3"
          >
            <Card.Header
              p={6}
              borderBottomWidth="1px"
              borderBottomColor="border.base"
              bg="bg.surface"
            >
              <HStack justify="space-between">
                <VStack align="start" gap={1}>
                  <Heading
                    size="lg"
                    color="text.primary"
                    fontWeight="800"
                    letterSpacing="-0.01em"
                  >
                    Downloads
                  </Heading>
                  <Text fontSize="xs" fontFamily="monospace" color="brand.400" fontWeight="bold">
                    SECTION_03
                  </Text>
                </VStack>
                <Text fontSize="3xl">⬇️</Text>
              </HStack>
            </Card.Header>
            <Card.Body gap={6} p={6}>
              <VStack align="stretch" gap={4}>
                <HStack justify="space-between">
                  <VStack align="start" gap={1} flex={1}>
                    <Text fontWeight="bold" color="text.primary" fontSize="md">
                      Max Concurrent Downloads
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Number of simultaneous torrent downloads (1-10)
                    </Text>
                  </VStack>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    w="80px"
                    size="sm"
                    textAlign="center"
                    value={wtSettings.maxConcurrentDownloads}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value, 10)
                      if (!isNaN(num) && num >= 1 && num <= 10) {
                        saveWtSettings({ maxConcurrentDownloads: num })
                      }
                    }}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxConcurrentDownloads: parseInt(e.target.value, 10) || wtSettings.maxConcurrentDownloads })}
                    disabled={isSavingWt}
                  />
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={1} flex={1}>
                    <Text fontWeight="bold" color="text.primary" fontSize="md">
                      Seed After Download
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      Continue sharing after download completes
                    </Text>
                  </VStack>
                  <Switch.Root
                    checked={wtSettings.seedAfterDownload}
                    onCheckedChange={() => saveWtSettings({ seedAfterDownload: !wtSettings.seedAfterDownload })}
                    colorPalette="brand"
                    size="lg"
                    disabled={isSavingWt}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label />
                  </Switch.Root>
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={1} flex={1}>
                    <Text fontWeight="bold" color="text.primary" fontSize="md">
                      Max Download Speed
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      KB/s (0 = unlimited)
                    </Text>
                  </VStack>
                  <Input
                    type="number"
                    min={0}
                    w="100px"
                    size="sm"
                    textAlign="center"
                    value={Math.round(wtSettings.maxDownloadSpeed / 1024)}
                    onBlur={(e) => {
                      const kbps = parseInt(e.target.value, 10)
                      if (!isNaN(kbps) && kbps >= 0) {
                        saveWtSettings({ maxDownloadSpeed: kbps * 1024 })
                      }
                    }}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxDownloadSpeed: (parseInt(e.target.value, 10) || 0) * 1024 })}
                    disabled={isSavingWt}
                  />
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={1} flex={1}>
                    <Text fontWeight="bold" color="text.primary" fontSize="md">
                      Max Upload Speed
                    </Text>
                    <Text fontSize="sm" color="text.secondary">
                      KB/s (0 = unlimited)
                    </Text>
                  </VStack>
                  <Input
                    type="number"
                    min={0}
                    w="100px"
                    size="sm"
                    textAlign="center"
                    value={Math.round(wtSettings.maxUploadSpeed / 1024)}
                    onBlur={(e) => {
                      const kbps = parseInt(e.target.value, 10)
                      if (!isNaN(kbps) && kbps >= 0) {
                        saveWtSettings({ maxUploadSpeed: kbps * 1024 })
                      }
                    }}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxUploadSpeed: (parseInt(e.target.value, 10) || 0) * 1024 })}
                    disabled={isSavingWt}
                  />
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* RuTracker Authentication Section */}
        <RuTrackerAuthCard
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoading={isAuthLoading}
        />

        {/* Debug: Auth State Display */}
        <Card.Root
          bg="bg.card"
          borderWidth="2px"
          borderColor="purple.500"
          borderRadius="xl"
          overflow="hidden"
          data-testid="auth-debug-section"
          className="settings-card"
        >
          <Card.Header
            p={6}
            borderBottomWidth="1px"
            borderBottomColor="border.base"
            bg="purple.900/20"
          >
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Heading
                  size="lg"
                  color="text.primary"
                  fontWeight="800"
                  letterSpacing="-0.01em"
                >
                  Debug: Auth State
                </Heading>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  color="purple.400"
                  fontWeight="bold"
                >
                  DEV_DEBUG
                </Text>
              </VStack>
              <Text fontSize="3xl">🐛</Text>
            </HStack>
          </Card.Header>
          <Card.Body p={6}>
            <VStack align="stretch" gap={4}>
              <Box
                p={4}
                borderRadius="lg"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.base"
                fontFamily="monospace"
              >
                <VStack align="start" gap={2}>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="text.muted">
                      isLoggedIn:
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color={isLoggedIn ? 'green.400' : 'red.400'}
                    >
                      {String(isLoggedIn)}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="text.muted">
                      username:
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="brand.400">
                      {username || 'null'}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="text.muted">
                      sessionExpiry:
                    </Text>
                    <Text fontSize="sm" fontWeight="bold" color="accent.400">
                      {sessionExpiry
                        ? new Date(sessionExpiry).toLocaleString()
                        : 'null'}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="text.muted">
                      isSessionRestored:
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color={isSessionRestored ? 'blue.400' : 'gray.400'}
                    >
                      {String(isSessionRestored)}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" w="full">
                    <Text fontSize="sm" color="text.muted">
                      isAuthenticated():
                    </Text>
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      color={isAuthenticated() ? 'green.400' : 'red.400'}
                    >
                      {String(isAuthenticated())}
                    </Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Cookies Section */}
              {debugInfo && debugInfo.cookieCount > 0 && (
                <Box
                  p={4}
                  borderRadius="lg"
                  bg="bg.surface"
                  borderWidth="1px"
                  borderColor="border.base"
                >
                  <VStack align="start" gap={3}>
                    <HStack justify="space-between" w="full">
                      <Text
                        fontSize="xs"
                        fontFamily="monospace"
                        color="purple.400"
                        fontWeight="bold"
                      >
                        SESSION COOKIES
                      </Text>
                      <Text
                        fontSize="xs"
                        fontFamily="monospace"
                        color="text.muted"
                      >
                        {debugInfo.cookieCount} cookie(s)
                      </Text>
                    </HStack>
                    <Box
                      w="full"
                      maxH="300px"
                      overflowY="auto"
                      borderRadius="md"
                      bg="bg.canvas"
                      p={3}
                    >
                      <VStack align="stretch" gap={2}>
                        {debugInfo.cookies.map((cookie, index) => (
                          <Box
                            key={index}
                            p={3}
                            borderRadius="md"
                            bg="bg.surface"
                            borderWidth="1px"
                            borderColor="border.base"
                            fontFamily="monospace"
                            fontSize="xs"
                          >
                            <VStack align="start" gap={1}>
                              <HStack>
                                <Text color="text.muted" minW="60px">
                                  name:
                                </Text>
                                <Text color="brand.400" fontWeight="bold">
                                  {cookie.name}
                                </Text>
                              </HStack>
                              <HStack>
                                <Text color="text.muted" minW="60px">
                                  value:
                                </Text>
                                <Text
                                  color="text.primary"
                                  wordBreak="break-all"
                                  lineClamp={1}
                                  title={cookie.value}
                                >
                                  {cookie.value.length > 40
                                    ? `${cookie.value.substring(0, 40)}...`
                                    : cookie.value}
                                </Text>
                              </HStack>
                              <HStack>
                                <Text color="text.muted" minW="60px">
                                  domain:
                                </Text>
                                <Text color="accent.400">{cookie.domain}</Text>
                              </HStack>
                              <HStack>
                                <Text color="text.muted" minW="60px">
                                  path:
                                </Text>
                                <Text color="text.secondary">
                                  {cookie.path}
                                </Text>
                              </HStack>
                              <HStack>
                                <Text color="text.muted" minW="60px">
                                  expires:
                                </Text>
                                <Text color="text.secondary">
                                  {new Date(
                                    cookie.expires * 1000
                                  ).toLocaleString()}
                                </Text>
                              </HStack>
                            </VStack>
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                  </VStack>
                </Box>
              )}

              <Text fontSize="xs" color="text.muted" fontStyle="italic">
                This debug panel shows the current authentication state in
                real-time. It will be removed in production.
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Advanced Section */}
        <Card.Root
          bg="bg.card"
          borderWidth="2px"
          borderColor="border.base"
          borderRadius="xl"
          overflow="hidden"
          data-testid="advanced-section"
          className="settings-card settings-card-4"
        >
          <Card.Header
            p={6}
            borderBottomWidth="1px"
            borderBottomColor="border.base"
            bg="bg.surface"
          >
            <HStack justify="space-between">
              <VStack align="start" gap={1}>
                <Heading
                  size="lg"
                  color="text.primary"
                  data-testid="advanced-heading"
                  fontWeight="800"
                  letterSpacing="-0.01em"
                >
                  Advanced
                </Heading>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  color="purple.400"
                  fontWeight="bold"
                >
                  SECTION_04
                </Text>
              </VStack>
              <Text fontSize="3xl">🔧</Text>
            </HStack>
          </Card.Header>
          <Card.Body p={6}>
            <VStack align="start" gap={3}>
              <Box
                w="full"
                p={4}
                borderRadius="lg"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.base"
                borderStyle="dashed"
              >
                <Text
                  fontSize="sm"
                  color="text.muted"
                  fontStyle="italic"
                  data-testid="advanced-placeholder"
                  fontFamily="monospace"
                >
                  → Advanced options coming soon...
                </Text>
              </Box>
              <HStack
                gap={2}
                fontSize="xs"
                fontFamily="monospace"
                color="text.muted"
              >
                <Text>STATUS:</Text>
                <Text color="yellow.500" fontWeight="bold">
                  DEVELOPMENT
                </Text>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </VStack>
    </PageLayout>
  )
}

export default Settings
