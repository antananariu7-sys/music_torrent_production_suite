import { useEffect, useState } from 'react'
import { Box, VStack, HStack, Text, Button, Icon, Heading, Code, Switch } from '@chakra-ui/react'
import { FiSettings, FiFolder } from 'react-icons/fi'
import type { TorrentSettings as TorrentSettingsType } from '@shared/types/torrent.types'

export function TorrentSettings(): JSX.Element {
  const [settings, setSettings] = useState<TorrentSettingsType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadSettings = async () => {
    try {
      const response = await window.api.torrent.getSettings()
      if (response.success && response.data) {
        setSettings(response.data)
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
