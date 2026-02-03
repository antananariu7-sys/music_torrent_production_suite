import { useState } from 'react'
import {
  Card,
  Button,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Input,
  Checkbox,
} from '@chakra-ui/react'
import { useAuthStore } from '@/store/useAuthStore'

interface RuTrackerAuthCardProps {
  onLogin?: (username: string, password: string, remember: boolean) => Promise<void>
  onLogout?: () => Promise<void>
  isLoading?: boolean
}

export function RuTrackerAuthCard({
  onLogin,
  onLogout,
  isLoading = false,
}: RuTrackerAuthCardProps): JSX.Element {
  const { isLoggedIn, username, isSessionRestored } = useAuthStore()
  const [loginUsername, setLoginUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!loginUsername.trim() || !password) {
      setError('Username and password are required')
      return
    }

    setError(null)

    try {
      if (onLogin) {
        await onLogin(loginUsername, password, rememberMe)
      }

      // Reset password field after successful login
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const handleLogout = async () => {
    setError(null)

    try {
      if (onLogout) {
        await onLogout()
      }

      // Reset form fields
      setLoginUsername('')
      setPassword('')
      setRememberMe(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin()
    }
  }

  return (
    <Card.Root
      bg="bg.card"
      borderWidth="2px"
      borderColor="border.base"
      borderRadius="xl"
      overflow="hidden"
      data-testid="rutracker-auth-section"
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
              data-testid="rutracker-auth-heading"
              fontWeight="800"
              letterSpacing="-0.01em"
            >
              RuTracker Authentication
            </Heading>
            <Text fontSize="xs" fontFamily="monospace" color="accent.400" fontWeight="bold">
              SECTION_02
            </Text>
          </VStack>
          <Text fontSize="3xl">🔐</Text>
        </HStack>
      </Card.Header>

      <Card.Body gap={6} p={6}>
        {!isLoggedIn ? (
          <VStack align="stretch" gap={4}>
            <Text color="text.secondary" fontSize="sm" lineHeight="1.7">
              Log in to your RuTracker account to enable music search and download features.
            </Text>

            <Box
              w="full"
              h="2px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
              }}
            />

            <Box>
              <Text
                fontSize="xs"
                fontFamily="monospace"
                mb={2}
                color="text.secondary"
                fontWeight="bold"
                letterSpacing="wide"
              >
                USERNAME *
              </Text>
              <Input
                data-testid="rutracker-input-username"
                placeholder="Enter your RuTracker username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyPress={handleKeyPress}
                size="lg"
                fontWeight="500"
                disabled={isLoading}
              />
            </Box>

            <Box>
              <Text
                fontSize="xs"
                fontFamily="monospace"
                mb={2}
                color="text.secondary"
                fontWeight="bold"
                letterSpacing="wide"
              >
                PASSWORD *
              </Text>
              <Input
                data-testid="rutracker-input-password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                size="lg"
                fontWeight="500"
                disabled={isLoading}
              />
            </Box>

            <HStack gap={2}>
              <Checkbox.Root
                data-testid="rutracker-checkbox-remember"
                checked={rememberMe}
                onCheckedChange={(e: { checked: boolean | 'indeterminate' }) => setRememberMe(e.checked === true)}
                disabled={isLoading}
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control />
              </Checkbox.Root>
              <Text fontSize="sm" fontWeight="500" color="text.primary">
                Remember my credentials
              </Text>
            </HStack>

            {error && (
              <Box
                p={4}
                borderRadius="lg"
                bg="red.500/10"
                borderWidth="1px"
                borderColor="red.500/30"
                data-testid="rutracker-error-message"
              >
                <Text fontSize="sm" color="red.500" fontWeight="500">
                  {error}
                </Text>
              </Box>
            )}

            <Box
              w="full"
              h="2px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
              }}
            />

            <Button
              data-testid="rutracker-button-login"
              colorPalette="brand"
              size="lg"
              w="full"
              fontWeight="bold"
              letterSpacing="wide"
              textTransform="uppercase"
              onClick={handleLogin}
              disabled={!loginUsername.trim() || !password || isLoading}
              loading={isLoading}
            >
              Login to RuTracker
            </Button>
          </VStack>
        ) : (
          <VStack align="stretch" gap={4}>
            <Box
              p={4}
              borderRadius="lg"
              bg="bg.surface"
              borderWidth="2px"
              borderColor="brand.500"
              data-testid="rutracker-logged-in-display"
            >
              <HStack justify="space-between">
                <VStack align="start" gap={1}>
                  <Text fontSize="xs" fontFamily="monospace" color="text.muted">
                    LOGGED IN AS
                  </Text>
                  <HStack gap={2}>
                    <Box
                      w="3"
                      h="3"
                      bg="green.400"
                      borderRadius="full"
                    />
                    <Text
                      fontWeight="bold"
                      color="text.primary"
                      data-testid="rutracker-username-display"
                      fontFamily="monospace"
                      fontSize="sm"
                    >
                      {username}
                    </Text>
                  </HStack>
                </VStack>
                <Text fontSize="2xl">✅</Text>
              </HStack>
            </Box>

            {isSessionRestored && (
              <Box
                p={4}
                borderRadius="lg"
                bg="blue.500/10"
                borderWidth="1px"
                borderColor="blue.500/30"
                data-testid="rutracker-session-restored-indicator"
              >
                <HStack gap={2}>
                  <Text fontSize="lg">🔄</Text>
                  <VStack align="start" gap={0}>
                    <Text fontSize="sm" color="blue.500" fontWeight="bold">
                      Session Restored
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      Your previous login session is active and being monitored
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            )}

            <Text color="text.secondary" fontSize="sm" lineHeight="1.7">
              You&apos;re successfully authenticated. You can now search and download music from RuTracker.
            </Text>

            <Box
              w="full"
              h="2px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
              }}
            />

            <Button
              data-testid="rutracker-button-logout"
              colorPalette="red"
              variant="outline"
              size="lg"
              w="full"
              fontWeight="bold"
              letterSpacing="wide"
              textTransform="uppercase"
              onClick={handleLogout}
              disabled={isLoading}
              loading={isLoading}
            >
              Logout
            </Button>
          </VStack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
