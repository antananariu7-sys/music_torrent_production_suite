import { useState, useEffect } from 'react'
import { Box, Heading, VStack, HStack, Text, Card } from '@chakra-ui/react'
import { useAuthStore } from '@/store/useAuthStore'

interface DebugInfo {
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    expires: number
  }>
  cookieCount: number
}

/**
 * DebugSettings Component
 *
 * Displays authentication state and session cookies for debugging purposes
 * This component will be removed in production
 */
export function DebugSettings() {
  const {
    isLoggedIn,
    username,
    sessionExpiry,
    isAuthenticated,
    isSessionRestored,
  } = useAuthStore()
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)

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
          console.error('[DebugSettings] Failed to load debug info:', error)
        }
      } else {
        setDebugInfo(null)
      }
    }

    loadDebugInfo()
  }, [isLoggedIn])

  return (
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
          {/* Auth State Display */}
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
  )
}
