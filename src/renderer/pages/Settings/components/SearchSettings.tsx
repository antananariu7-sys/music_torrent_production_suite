import { Box, Heading, VStack, HStack, Text, Card } from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'
import { useSettingsStore } from '@/store/useSettingsStore'

/**
 * SearchSettings Component
 *
 * Handles search-related settings (auto-scan discography)
 */
export function SearchSettings() {
  const { autoScanDiscography, setAutoScanDiscography } = useSettingsStore()

  return (
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
              onCheckedChange={(e: { checked: boolean }) => setAutoScanDiscography(e.checked)}
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
  )
}
