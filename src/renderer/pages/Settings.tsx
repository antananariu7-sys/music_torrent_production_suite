import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Text,
  Card,
  Button,
} from '@chakra-ui/react'
import { Switch } from '@chakra-ui/react'
import { useThemeStore } from '../store/useThemeStore'

interface SettingsProps {
  onBack: () => void
}

function Settings({ onBack }: SettingsProps) {
  const { mode, toggleMode } = useThemeStore()

  return (
    <Box minH="100vh" bg="bg.canvas" color="text.primary" py={12}>
      <Container maxW="container.md">
        {/* Header */}
        <VStack gap={6} mb={8} align="start">
          <Button onClick={onBack} variant="ghost" colorPalette="brand">
            ← Back to Home
          </Button>
          <Heading as="h1" fontSize="4xl" fontWeight="bold" color="text.primary">
            ⚙️ Settings
          </Heading>
          <Text fontSize="lg" color="text.secondary">
            Customize your Music Production Suite experience
          </Text>
        </VStack>

        {/* Settings Sections */}
        <VStack gap={6} align="stretch">
          {/* Appearance Section */}
          <Card.Root bg="bg.card" borderWidth="1px" borderColor="border.base">
            <Card.Header>
              <Heading size="md" color="text.primary">
                Appearance
              </Heading>
            </Card.Header>
            <Card.Body gap={4}>
              {/* Theme Toggle */}
              <HStack justify="space-between" py={2}>
                <VStack align="start" gap={1} flex={1}>
                  <Text fontWeight="medium" color="text.primary">
                    Dark Mode
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    Switch between light and dark themes
                  </Text>
                </VStack>
                <Switch.Root
                  checked={mode === 'dark'}
                  onCheckedChange={() => toggleMode()}
                  colorPalette="brand"
                  size="lg"
                >
                  <Switch.Thumb />
                </Switch.Root>
              </HStack>

              {/* Current Theme Display */}
              <Box
                p={4}
                borderRadius="md"
                bg="bg.surface"
                borderWidth="1px"
                borderColor="border.base"
              >
                <Text fontSize="sm" color="text.secondary">
                  Current theme:{' '}
                  <Text as="span" fontWeight="semibold" color="text.primary">
                    {mode === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </Text>
              </Box>
            </Card.Body>
          </Card.Root>

          {/* Future Settings Placeholder */}
          <Card.Root bg="bg.card" borderWidth="1px" borderColor="border.base">
            <Card.Header>
              <Heading size="md" color="text.primary">
                General
              </Heading>
            </Card.Header>
            <Card.Body>
              <Text fontSize="sm" color="text.muted" fontStyle="italic">
                More settings will be added here...
              </Text>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="bg.card" borderWidth="1px" borderColor="border.base">
            <Card.Header>
              <Heading size="md" color="text.primary">
                Advanced
              </Heading>
            </Card.Header>
            <Card.Body>
              <Text fontSize="sm" color="text.muted" fontStyle="italic">
                Advanced options coming soon...
              </Text>
            </Card.Body>
          </Card.Root>
        </VStack>
      </Container>
    </Box>
  )
}

export default Settings
