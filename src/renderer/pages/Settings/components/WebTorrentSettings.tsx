import { useState, useEffect } from 'react'
import { Heading, VStack, HStack, Text, Card, Input } from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'
import type { WebTorrentSettings as WebTorrentSettingsType } from '@shared/types/torrent.types'

/**
 * WebTorrentSettings Component
 *
 * Handles WebTorrent download settings (concurrent downloads, speeds, seeding)
 */
export function WebTorrentSettings() {
  const [wtSettings, setWtSettings] = useState<WebTorrentSettingsType | null>(null)
  const [isSavingWt, setIsSavingWt] = useState(false)

  // Load WebTorrent settings
  useEffect(() => {
    const loadWtSettings = async () => {
      try {
        const response = await window.api.webtorrent.getSettings()
        if (response.success && response.data) {
          setWtSettings(response.data)
        }
      } catch (err) {
        console.error('[WebTorrentSettings] Failed to load settings:', err)
      }
    }
    loadWtSettings()
  }, [])

  const saveWtSettings = async (updates: Partial<WebTorrentSettingsType>) => {
    setIsSavingWt(true)
    try {
      const response = await window.api.webtorrent.updateSettings(updates)
      if (response.success && response.data) {
        setWtSettings(response.data)
      }
    } catch (err) {
      console.error('[WebTorrentSettings] Failed to save settings:', err)
    } finally {
      setIsSavingWt(false)
    }
  }

  if (!wtSettings) {
    return null
  }

  return (
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
          {/* Max Concurrent Downloads */}
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

          {/* Seed After Download */}
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

          {/* Max Download Speed */}
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

          {/* Max Upload Speed */}
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
  )
}
