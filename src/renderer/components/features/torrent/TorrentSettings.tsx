import { useEffect, useState } from 'react'
import { Box, VStack, HStack, Text, Button, Icon, Heading, Code, Switch, Input, Separator } from '@chakra-ui/react'
import { FiSettings, FiFolder } from 'react-icons/fi'
import type { TorrentSettings as TorrentSettingsType, WebTorrentSettings } from '@shared/types/torrent.types'

export function TorrentSettings(): JSX.Element {
  const [settings, setSettings] = useState<TorrentSettingsType | null>(null)
  const [wtSettings, setWtSettings] = useState<WebTorrentSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadSettings = async () => {
    try {
      const [torrentResponse, wtResponse] = await Promise.all([
        window.api.torrent.getSettings(),
        window.api.webtorrent.getSettings(),
      ])
      if (torrentResponse.success && torrentResponse.data) {
        setSettings(torrentResponse.data)
      }
      if (wtResponse.success && wtResponse.data) {
        setWtSettings(wtResponse.data)
      }
    } catch (err) {
      console.error('Failed to load torrent settings:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async (newSettings: TorrentSettingsType) => {
    setIsSaving(true)
    try {
      const response = await window.api.torrent.updateSettings(newSettings)
      if (response.success && response.data) {
        setSettings(response.data)
      }
    } catch (err) {
      console.error('Failed to save torrent settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectDirectory = async () => {
    try {
      const directory = await window.api.selectDirectory()
      if (directory && settings) {
        const newSettings = { ...settings, torrentsFolder: directory }
        setSettings(newSettings)
        await saveSettings(newSettings)
      }
    } catch (err) {
      console.error('Failed to select directory:', err)
    }
  }

  const handleTogglePreferMagnet = async () => {
    if (!settings) return
    const newSettings = { ...settings, preferMagnetLinks: !settings.preferMagnetLinks }
    setSettings(newSettings)
    await saveSettings(newSettings)
  }

  const handleToggleAutoOpen = async () => {
    if (!settings) return
    const newSettings = { ...settings, autoOpen: !settings.autoOpen }
    setSettings(newSettings)
    await saveSettings(newSettings)
  }

  const handleToggleKeepHistory = async () => {
    if (!settings) return
    const newSettings = { ...settings, keepHistory: !settings.keepHistory }
    setSettings(newSettings)
    await saveSettings(newSettings)
  }

  const saveWtSettings = async (updates: Partial<WebTorrentSettings>) => {
    setIsSaving(true)
    try {
      const response = await window.api.webtorrent.updateSettings(updates)
      if (response.success && response.data) {
        setWtSettings(response.data)
      }
    } catch (err) {
      console.error('Failed to save WebTorrent settings:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleSeedAfterDownload = async () => {
    if (!wtSettings) return
    await saveWtSettings({ seedAfterDownload: !wtSettings.seedAfterDownload })
  }

  const handleMaxConcurrentChange = async (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1 || num > 10) return
    await saveWtSettings({ maxConcurrentDownloads: num })
  }

  const handleMaxDownloadSpeedChange = async (value: string) => {
    const kbps = parseInt(value, 10)
    if (isNaN(kbps) || kbps < 0) return
    await saveWtSettings({ maxDownloadSpeed: kbps * 1024 })
  }

  const handleMaxUploadSpeedChange = async (value: string) => {
    const kbps = parseInt(value, 10)
    if (isNaN(kbps) || kbps < 0) return
    await saveWtSettings({ maxUploadSpeed: kbps * 1024 })
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <Box
      p={6}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
    >
      <HStack gap={2} mb={4}>
        <Icon as={FiSettings} boxSize={5} color="interactive.base" />
        <Heading size="md" color="text.primary">
          Settings
        </Heading>
      </HStack>

      {isLoading ? (
        <Box p={6} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            Loading settings...
          </Text>
        </Box>
      ) : settings ? (
        <VStack align="stretch" gap={4}>
          {/* Download Directory */}
          <Box>
            <Text fontSize="sm" fontWeight="medium" color="text.primary" mb={2}>
              Download Directory
            </Text>
            <HStack gap={2}>
              <Code
                flex="1"
                p={2}
                borderRadius="sm"
                bg="bg.elevated"
                fontSize="xs"
                color="text.secondary"
              >
                {settings.torrentsFolder || 'Not set'}
              </Code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectDirectory}
                disabled={isSaving}
              >
                <Icon as={FiFolder} mr={2} />
                Browse
              </Button>
            </HStack>
          </Box>

          {/* Toggles */}
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="medium" color="text.primary">
                  Prefer Magnet Links
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Use magnet links instead of downloading .torrent files
                </Text>
              </VStack>
              <Switch.Root
                checked={settings.preferMagnetLinks ?? true}
                onCheckedChange={handleTogglePreferMagnet}
                disabled={isSaving}
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </HStack>

            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="medium" color="text.primary">
                  Auto-Open in Torrent Client
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Automatically open torrents in your default torrent application
                </Text>
              </VStack>
              <Switch.Root
                checked={settings.autoOpen ?? false}
                onCheckedChange={handleToggleAutoOpen}
                disabled={isSaving}
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </HStack>

            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="medium" color="text.primary">
                  Keep Download History
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Save a history of downloaded torrents
                </Text>
              </VStack>
              <Switch.Root
                checked={settings.keepHistory ?? true}
                onCheckedChange={handleToggleKeepHistory}
                disabled={isSaving}
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </HStack>
          </VStack>

          {/* WebTorrent Download Queue Settings */}
          {wtSettings && (
            <>
              <Separator />
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Download Queue
              </Text>

              <VStack align="stretch" gap={3}>
                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                      Max Concurrent Downloads
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      Number of simultaneous downloads (1-10)
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
                    onBlur={(e) => handleMaxConcurrentChange(e.target.value)}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxConcurrentDownloads: parseInt(e.target.value, 10) || wtSettings.maxConcurrentDownloads })}
                    disabled={isSaving}
                  />
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                      Seed After Download
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      Continue sharing after download completes
                    </Text>
                  </VStack>
                  <Switch.Root
                    checked={wtSettings.seedAfterDownload}
                    onCheckedChange={handleToggleSeedAfterDownload}
                    disabled={isSaving}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                  </Switch.Root>
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                      Max Download Speed
                    </Text>
                    <Text fontSize="xs" color="text.muted">
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
                    onBlur={(e) => handleMaxDownloadSpeedChange(e.target.value)}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxDownloadSpeed: (parseInt(e.target.value, 10) || 0) * 1024 })}
                    disabled={isSaving}
                  />
                </HStack>

                <HStack justify="space-between">
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" fontWeight="medium" color="text.primary">
                      Max Upload Speed
                    </Text>
                    <Text fontSize="xs" color="text.muted">
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
                    onBlur={(e) => handleMaxUploadSpeedChange(e.target.value)}
                    onChange={(e) => setWtSettings({ ...wtSettings, maxUploadSpeed: (parseInt(e.target.value, 10) || 0) * 1024 })}
                    disabled={isSaving}
                  />
                </HStack>
              </VStack>
            </>
          )}
        </VStack>
      ) : (
        <Box p={6} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            Failed to load settings
          </Text>
        </Box>
      )}
    </Box>
  )
}
