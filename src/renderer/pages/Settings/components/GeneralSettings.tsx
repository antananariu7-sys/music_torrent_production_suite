import { Box, Heading, VStack, HStack, Text, Card } from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'
import { useThemeStore } from '@/store/useThemeStore'

/**
 * GeneralSettings Component
 *
 * Handles appearance settings (theme toggle, color preview)
 */
export function GeneralSettings() {
  const { mode, toggleMode } = useThemeStore()

  return (
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
  )
}
