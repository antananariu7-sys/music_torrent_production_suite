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
  IconButton,
  Stack,
} from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import type { AppInfo } from '../../../shared/types/app.types'
import Layout from '../../components/common/Layout'
import { Waveform, FrequencyBars } from './components'
import { welcomeStyles } from './Welcome.styles'

interface WelcomeProps {
  appInfo: AppInfo | null
}

function Welcome({ appInfo }: WelcomeProps) {
  const navigate = useNavigate()

  return (
    <>
      <style>{welcomeStyles}</style>

      {/* Frequency visualization at bottom - absolute positioned */}
      <Box
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        height="120px"
        overflow="hidden"
        opacity="0.15"
        pointerEvents="none"
        zIndex="0"
      >
        <FrequencyBars />
      </Box>

      <Layout maxW="container.xl">
          {/* Header with Settings Button */}
          <HStack justify="flex-end" mb={8}>
            <IconButton
              aria-label="Open settings"
              onClick={() => navigate('/settings')}
              variant="ghost"
              size="lg"
              colorPalette="brand"
              fontSize="2xl"
              className="settings-icon"
              style={{ transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              ⚙️
            </IconButton>
          </HStack>

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
                  fontSize="sm"
                  fontWeight="bold"
                  letterSpacing="widest"
                  textTransform="uppercase"
                  color="accent.400"
                  fontFamily="monospace"
                  mb={4}
                  className="version-glow"
                >
                  // PRODUCTION SUITE V2.0
                </Text>
                <Heading
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
                  <Text color="text.secondary" lineHeight="1.7" fontSize="md">
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
                  <Text color="text.secondary" lineHeight="1.7" fontSize="md">
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
                  <Text color="text.secondary" lineHeight="1.7" fontSize="md">
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

          {/* App Info Footer - Technical display */}
          {appInfo && (
            <Box
              textAlign="center"
              pt={12}
              pb={6}
              borderTopWidth="1px"
              borderTopColor="border.base"
              className="footer-fade"
            >
              <VStack gap={3}>
                <HStack
                  justify="center"
                  gap={4}
                  color="text.muted"
                  fontSize="sm"
                  fontFamily="monospace"
                  fontWeight="500"
                >
                  <HStack gap={2}>
                    <Box w="2" h="2" bg="green.400" borderRadius="full" />
                    <Text>VERSION {appInfo.version}</Text>
                  </HStack>
                  <Text color="border.base">|</Text>
                  <Text>
                    {appInfo.platform.toUpperCase()} / {appInfo.arch.toUpperCase()}
                  </Text>
                </HStack>
                <Text fontSize="xs" color="text.muted" fontFamily="monospace">
                  © 2026 Music Production Suite. Built with Electron + React.
                </Text>
              </VStack>
            </Box>
          )}
      </Layout>
    </>
  )
}

export default Welcome
