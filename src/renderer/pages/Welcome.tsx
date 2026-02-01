import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Card,
  Button,
  VStack,
  HStack,
  Badge,
  IconButton,
} from '@chakra-ui/react'
import type { AppInfo } from '../../shared/types/app.types'

interface WelcomeProps {
  appInfo: AppInfo | null
  onOpenSettings: () => void
}

function Welcome({ appInfo, onOpenSettings }: WelcomeProps) {
  return (
    <Box minH="100vh" bg="bg.canvas" color="text.primary" py={12}>
      <Container maxW="container.xl">
        {/* Header with Settings Button */}
        <HStack justify="flex-end" mb={4}>
          <IconButton
            aria-label="Open settings"
            onClick={onOpenSettings}
            variant="ghost"
            colorPalette="brand"
            fontSize="xl"
          >
            ⚙️
          </IconButton>
        </HStack>

        {/* Hero Section */}
        <VStack gap={4} mb={16} textAlign="center">
          <Heading
            as="h1"
            fontSize={{ base: '4xl', md: '5xl', lg: '6xl' }}
            fontWeight="bold"
            bgGradient="to-r"
            gradientFrom="brand.500"
            gradientTo="accent.500"
            bgClip="text"
          >
            🎵 Music Production Suite
          </Heading>
          <Text
            fontSize={{ base: 'lg', md: 'xl' }}
            color="text.secondary"
            maxW="2xl"
          >
            Integrated torrent search, download management, and mixing
            capabilities
          </Text>
        </VStack>

        {/* Feature Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} mb={12}>
          {/* Component 1: Torrent Search */}
          <Card.Root
            bg="bg.card"
            borderWidth="1px"
            borderColor="border.base"
            transition="all 0.2s"
            _hover={{
              transform: 'translateY(-4px)',
              shadow: 'xl',
              borderColor: 'border.hover',
            }}
          >
            <Card.Body gap={4}>
              <VStack align="start" gap={3}>
                <HStack>
                  <Text fontSize="3xl">🔍</Text>
                  <Heading size="lg" color="text.primary">
                    Torrent Search
                  </Heading>
                </HStack>
                <Text color="text.secondary" lineHeight="tall">
                  Automated RuTracker search with batch processing and real-time
                  progress
                </Text>
                <Button colorPalette="accent" variant="solid" disabled w="full">
                  Coming Soon
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Component 2: Download Manager */}
          <Card.Root
            bg="bg.card"
            borderWidth="1px"
            borderColor="border.base"
            transition="all 0.2s"
            _hover={{
              transform: 'translateY(-4px)',
              shadow: 'xl',
              borderColor: 'border.hover',
            }}
          >
            <Card.Body gap={4}>
              <VStack align="start" gap={3}>
                <HStack>
                  <Text fontSize="3xl">📥</Text>
                  <Heading size="lg" color="text.primary">
                    Download Manager
                  </Heading>
                </HStack>
                <Text color="text.secondary" lineHeight="tall">
                  WebTorrent-based downloads with queue management and seeding
                </Text>
                <Button colorPalette="brand" variant="solid" disabled w="full">
                  Coming Soon
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>

          {/* Component 3: Music Mixer */}
          <Card.Root
            bg="bg.card"
            borderWidth="1px"
            borderColor="border.base"
            transition="all 0.2s"
            _hover={{
              transform: 'translateY(-4px)',
              shadow: 'xl',
              borderColor: 'border.hover',
            }}
          >
            <Card.Body gap={4}>
              <VStack align="start" gap={3}>
                <HStack>
                  <Text fontSize="3xl">🎚️</Text>
                  <Heading size="lg" color="text.primary">
                    Music Mixer
                  </Heading>
                </HStack>
                <Text color="text.secondary" lineHeight="tall">
                  Audio mixing and editing interface (Architecture TBD)
                </Text>
                <Button colorPalette="purple" variant="solid" disabled w="full">
                  Coming Soon
                </Button>
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        {/* App Info Footer */}
        {appInfo && (
          <Box
            textAlign="center"
            pt={8}
            borderTopWidth="1px"
            borderTopColor="border.base"
          >
            <HStack justify="center" gap={3} color="text.muted" fontSize="sm">
              <Badge colorPalette="gray" variant="subtle">
                v{appInfo.version}
              </Badge>
              <Text>•</Text>
              <Text>
                {appInfo.platform} ({appInfo.arch})
              </Text>
            </HStack>
          </Box>
        )}
      </Container>
    </Box>
  )
}

export default Welcome
