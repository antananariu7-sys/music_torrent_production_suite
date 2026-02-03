import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Card,
  Button,
  VStack,
  HStack,
  Badge,
  Stack,
} from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'
import { PageLayout, Waveform } from '@/components/common'
import { welcomeStyles } from './Welcome.styles'

interface WelcomeProps {
  appInfo: AppInfo | null
}

function Welcome({ appInfo }: WelcomeProps): JSX.Element {
  return (
    <PageLayout appInfo={appInfo} maxW="container.xl" showCopyright customStyles={welcomeStyles} showFrequencyBars>

          {/* Hero Section - Bold asymmetric layout */}
          <Stack direction={{ base: 'column', lg: 'row' }} gap={12} mb={20} align="center">
            {/* Left: Main Title */}
            <VStack
              align={{ base: 'center', lg: 'flex-start' }}
              gap={6}
              flex="1"
              textAlign={{ base: 'center', lg: 'left' }}
              className="hero-left"
            >
              <Box>
                <Text
                  data-testid="welcome-text-version"
                  fontSize="sm"
                  fontWeight="bold"
                  letterSpacing="widest"
                  textTransform="uppercase"
                  color="accent.400"
                  fontFamily="monospace"
                  mb={4}
                  className="version-glow"
                >
                  PRODUCTION SUITE V2.0
                </Text>
                <Heading
                  data-testid="welcome-heading-main"
                  as="h1"
                  fontSize={{ base: '4xl', md: '6xl', lg: '7xl' }}
                  fontWeight="900"
                  lineHeight="0.95"
                  letterSpacing="-0.02em"
                  mb={4}
                >
                  <Box
                    as="span"
                    display="block"
                    color="text.primary"
                    style={{
                      fontFamily: "'Arial Black', 'Arial', sans-serif",
                      textTransform: 'uppercase',
                    }}
                  >
                    Music
                  </Box>
                  <Box
                    as="span"
                    display="block"
                    bgGradient="to-r"
                    gradientFrom="brand.400"
                    gradientVia="accent.400"
                    gradientTo="brand.600"
                    bgClip="text"
                    style={{
                      fontFamily: "'Arial Black', 'Arial', sans-serif",
                      textTransform: 'uppercase',
                      WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
                    }}
                  >
                    Production
                  </Box>
                </Heading>
              </Box>

              <Text
                data-testid="welcome-text-description"
                fontSize={{ base: 'lg', md: 'xl' }}
                color="text.secondary"
                maxW="600px"
                lineHeight="1.7"
                fontWeight="500"
              >
                Integrated torrent search, download management, and mixing capabilities. Built
                for producers who demand precision.
              </Text>

              <HStack gap={3} mt={4}>
                <Box
                  data-testid="welcome-badge-online"
                  px={4}
                  py={2}
                  bg="brand.500"
                  color="white"
                  fontWeight="bold"
                  fontSize="sm"
                  fontFamily="monospace"
                  borderRadius="sm"
                  boxShadow="0 0 20px rgba(59, 130, 246, 0.4)"
                >
                  ● ONLINE
                </Box>
                <Box
                  data-testid="welcome-badge-modules"
                  px={4}
                  py={2}
                  borderWidth="2px"
                  borderColor="border.base"
                  color="text.secondary"
                  fontWeight="bold"
                  fontSize="sm"
                  fontFamily="monospace"
                  borderRadius="sm"
                >
                  3 MODULES LOADED
                </Box>
              </HStack>
            </VStack>

            {/* Right: Waveform visualization */}
            <Box flex="1" position="relative" className="hero-right">
              <Box
                data-testid="welcome-section-spectrum"
                p={8}
                bg="bg.card"
                borderWidth="2px"
                borderColor="brand.500"
                borderRadius="lg"
                position="relative"
                overflow="hidden"
                boxShadow="0 20px 60px rgba(0, 0, 0, 0.3)"
                _before={{
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(14, 165, 233, 0.1))',
                  pointerEvents: 'none',
                }}
              >
                <VStack gap={4} position="relative" zIndex={1}>
                  <HStack justify="space-between" w="full">
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      fontFamily="monospace"
                      color="accent.400"
                      letterSpacing="wider"
                    >
                      AUDIO SPECTRUM
                    </Text>
                    <Text fontSize="xs" fontFamily="monospace" color="text.muted">
                      44.1kHz / 24bit
                    </Text>
                  </HStack>
                  <Waveform color="var(--chakra-colors-brand-400)" animate />
                  <Waveform color="var(--chakra-colors-accent-400)" animate />
                  <HStack justify="space-between" w="full" mt={2}>
                    <Text fontSize="xs" fontFamily="monospace" color="text.muted">
                      -∞ dB
                    </Text>
                    <Text fontSize="xs" fontFamily="monospace" color="text.muted">
                      0.0 dB
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </Box>
          </Stack>

          {/* Feature Cards - Grid breaking asymmetric layout */}
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} mb={12}>
            {/* Card 1: Torrent Search */}
            <Card.Root
              data-testid="welcome-card-torrent-search"
              bg="bg.card"
              borderWidth="2px"
              borderColor="border.base"
              borderRadius="xl"
              overflow="hidden"
              position="relative"
              className="feature-card feature-card-1 card-1"
            >
              <Card.Body gap={5} p={8}>
                <VStack align="start" gap={4}>
                  <HStack gap={4} align="center">
                    <Box fontSize="4xl" className="emoji-icon">
                      🔍
                    </Box>
                    <VStack align="start" gap={0}>
                      <Heading
                        data-testid="welcome-heading-torrent-search"
                        size="xl"
                        color="text.primary"
                        fontWeight="800"
                        letterSpacing="-0.01em"
                      >
                        Torrent Search
                      </Heading>
                      <Text fontSize="xs" fontFamily="monospace" color="accent.400" fontWeight="bold">
                        MODULE_01
                      </Text>
                    </VStack>
                  </HStack>
                  <Text data-testid="welcome-text-torrent-search" color="text.secondary" lineHeight="1.7" fontSize="md">
                    Automated RuTracker search with batch processing and real-time progress
                    tracking. Lightning-fast indexing.
                  </Text>
                  <Box
                    w="full"
                    h="2px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                    }}
                  />
                  <HStack gap={2} fontSize="xs" color="text.muted" fontFamily="monospace">
                    <Badge size="sm" colorPalette="cyan">
                      BATCH
                    </Badge>
                    <Badge size="sm" colorPalette="blue">
                      REALTIME
                    </Badge>
                    <Badge size="sm" colorPalette="purple">
                      AUTO
                    </Badge>
                  </HStack>
                  <Button
                    data-testid="welcome-button-torrent-search"
                    colorPalette="accent"
                    size="lg"
                    w="full"
                    disabled
                    fontWeight="bold"
                    letterSpacing="wide"
                    textTransform="uppercase"
                  >
                    Coming Soon
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>

            {/* Card 2: Download Manager */}
            <Card.Root
              data-testid="welcome-card-download-manager"
              bg="bg.card"
              borderWidth="2px"
              borderColor="border.base"
              borderRadius="xl"
              overflow="hidden"
              position="relative"
              className="feature-card feature-card-2 card-2"
            >
              <Card.Body gap={5} p={8}>
                <VStack align="start" gap={4}>
                  <HStack gap={4} align="center">
                    <Box fontSize="4xl" className="emoji-icon">
                      📥
                    </Box>
                    <VStack align="start" gap={0}>
                      <Heading
                        data-testid="welcome-heading-download-manager"
                        size="xl"
                        color="text.primary"
                        fontWeight="800"
                        letterSpacing="-0.01em"
                      >
                        Download Manager
                      </Heading>
                      <Text fontSize="xs" fontFamily="monospace" color="brand.400" fontWeight="bold">
                        MODULE_02
                      </Text>
                    </VStack>
                  </HStack>
                  <Text data-testid="welcome-text-download-manager" color="text.secondary" lineHeight="1.7" fontSize="md">
                    WebTorrent-based downloads with intelligent queue management and configurable
                    seeding protocols.
                  </Text>
                  <Box
                    w="full"
                    h="2px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                    }}
                  />
                  <HStack gap={2} fontSize="xs" color="text.muted" fontFamily="monospace">
                    <Badge size="sm" colorPalette="blue">
                      QUEUE
                    </Badge>
                    <Badge size="sm" colorPalette="cyan">
                      P2P
                    </Badge>
                    <Badge size="sm" colorPalette="purple">
                      SEED
                    </Badge>
                  </HStack>
                  <Button
                    data-testid="welcome-button-download-manager"
                    colorPalette="brand"
                    size="lg"
                    w="full"
                    disabled
                    fontWeight="bold"
                    letterSpacing="wide"
                    textTransform="uppercase"
                  >
                    Coming Soon
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>

            {/* Card 3: Music Mixer */}
            <Card.Root
              data-testid="welcome-card-mixer"
              bg="bg.card"
              borderWidth="2px"
              borderColor="border.base"
              borderRadius="xl"
              overflow="hidden"
              position="relative"
              className="feature-card feature-card-3 card-3"
            >
              <Card.Body gap={5} p={8}>
                <VStack align="start" gap={4}>
                  <HStack gap={4} align="center">
                    <Box fontSize="4xl" className="emoji-icon">
                      🎚️
                    </Box>
                    <VStack align="start" gap={0}>
                      <Heading
                        data-testid="welcome-heading-mixer"
                        size="xl"
                        color="text.primary"
                        fontWeight="800"
                        letterSpacing="-0.01em"
                      >
                        Music Mixer
                      </Heading>
                      <Text fontSize="xs" fontFamily="monospace" color="purple.400" fontWeight="bold">
                        MODULE_03
                      </Text>
                    </VStack>
                  </HStack>
                  <Text data-testid="welcome-text-mixer" color="text.secondary" lineHeight="1.7" fontSize="md">
                    Professional audio mixing and editing interface with multi-track support and
                    effects processing.
                  </Text>
                  <Box
                    w="full"
                    h="2px"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                    }}
                  />
                  <HStack gap={2} fontSize="xs" color="text.muted" fontFamily="monospace">
                    <Badge size="sm" colorPalette="purple">
                      MULTI-TRACK
                    </Badge>
                    <Badge size="sm" colorPalette="pink">
                      FX
                    </Badge>
                    <Badge size="sm" colorPalette="blue">
                      VST
                    </Badge>
                  </HStack>
                  <Button
                    data-testid="welcome-button-mixer"
                    colorPalette="purple"
                    size="lg"
                    w="full"
                    disabled
                    fontWeight="bold"
                    letterSpacing="wide"
                    textTransform="uppercase"
                  >
                    Coming Soon
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>

    </PageLayout>
  )
}

export default Welcome
