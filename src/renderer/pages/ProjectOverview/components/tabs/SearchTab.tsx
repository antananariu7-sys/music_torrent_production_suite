import { useState, useEffect } from 'react'
import { Box, VStack, HStack, Text, Grid, Icon, Input, Button } from '@chakra-ui/react'
import { FiAlertCircle } from 'react-icons/fi'
import { useAuthStore } from '@/store/useAuthStore'
import { toaster } from '@/components/ui/toaster'
import { useProjectStore } from '@/store/useProjectStore'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { SmartSearchBar, SmartSearch } from '@/components/features/search'
import { SearchHistory } from '@/components/features/search/SearchHistory'
import { ActivityLog } from '@/components/features/search/ActivityLog'

export function SearchTab(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const username = useAuthStore((state) => state.username)
  const setAuthState = useAuthStore((state) => state.setAuthState)
  const login = useAuthStore((state) => state.login)
  const currentProject = useProjectStore((state) => state.currentProject)
  const startSearch = useSmartSearchStore((state) => state.startSearch)
  const setProjectContext = useSmartSearchStore((state) => state.setProjectContext)
  const loadHistoryFromProject = useSmartSearchStore((state) => state.loadHistoryFromProject)

  const [loginUsername, setLoginUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  const handleLogin = async () => {
    if (!loginUsername.trim() || !password) {
      setLoginError('Username and password are required')
      return
    }
    setLoginError(null)
    setIsLoginLoading(true)
    try {
      const result = await window.api.auth.login({ username: loginUsername, password, remember: false })
      if (result.success) {
        login(loginUsername)
        setPassword('')
        toaster.create({ title: 'Login successful', description: `Welcome, ${loginUsername}!`, type: 'success', duration: 5000 })
      } else {
        setLoginError(result.error || 'Login failed')
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoginLoading(false)
    }
  }

  const handleLoginKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoginLoading) {
      handleLogin()
    }
  }

  // Torrent collection store
  const setCollectionContext = useTorrentCollectionStore((state) => state.setProjectContext)
  const loadCollectionFromProject = useTorrentCollectionStore(
    (state) => state.loadCollectionFromProject
  )

  // Check auth status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await window.api.auth.getStatus()
        if (response.success && response.data) {
          setAuthState(response.data)
        }
      } catch (error) {
        console.error('Failed to check auth status:', error)
      }
    }

    checkAuthStatus()
  }, [setAuthState])

  // Load search history and collection when project changes
  useEffect(() => {
    if (currentProject) {
      // Set project context for saving
      setProjectContext(
        currentProject.id,
        currentProject.name,
        currentProject.projectDirectory
      )

      // Set collection context
      setCollectionContext(
        currentProject.id,
        currentProject.name,
        currentProject.projectDirectory
      )

      // Load existing search history
      loadHistoryFromProject(currentProject.id, currentProject.projectDirectory)

      // Load existing torrent collection
      loadCollectionFromProject(currentProject.id, currentProject.projectDirectory)
    }
  }, [
    currentProject,
    setProjectContext,
    loadHistoryFromProject,
    setCollectionContext,
    loadCollectionFromProject,
  ])

  const handleSearchComplete = (filePath: string) => {
    console.log('[SearchTab] Torrent added to collection:', filePath)
  }

  const handleSearchCancel = () => {
    console.log('[SearchTab] Search cancelled')
  }

  const handleSelectHistoryQuery = (query: string) => {
    startSearch(query)
  }

  return (
    <Box>
      <VStack align="stretch" gap={6}>
        {/* Authentication Warning + Login Form */}
        {!isAuthenticated && (
          <Box
            p={4}
            borderRadius="md"
            bg="orange.500/10"
            borderWidth="1px"
            borderColor="orange.500/30"
          >
            <VStack align="start" gap={3}>
              <HStack>
                <Icon as={FiAlertCircle} />
                <Text fontWeight="bold" color="orange.500">
                  Authentication Required
                </Text>
              </HStack>
              <Text fontSize="sm" color="text.secondary">
                Please login to RuTracker to enable search functionality.
              </Text>

              {/* Inline Login Form */}
              <VStack align="stretch" gap={2} w="full">
                <HStack gap={2}>
                  <Input
                    placeholder="Username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    onKeyPress={handleLoginKeyPress}
                    size="sm"
                    disabled={isLoginLoading}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleLoginKeyPress}
                    size="sm"
                    disabled={isLoginLoading}
                  />
                  <Button
                    colorPalette="orange"
                    size="sm"
                    onClick={handleLogin}
                    disabled={!loginUsername.trim() || !password || isLoginLoading}
                    loading={isLoginLoading}
                    flexShrink={0}
                  >
                    Login
                  </Button>
                </HStack>
                {loginError && (
                  <Text fontSize="xs" color="red.400">
                    {loginError}
                  </Text>
                )}
              </VStack>
            </VStack>
          </Box>
        )}

        {/* Authenticated Content */}
        {isAuthenticated && (
          <VStack align="stretch" gap={4}>
            {/* User Info */}
            {username && (
              <Text fontSize="sm" color="text.muted">
                Logged in as{' '}
                <Text as="span" fontWeight="medium" color="text.primary">
                  {username}
                </Text>
              </Text>
            )}

            {/* Search Bar */}
            <SmartSearchBar placeholder="Search for artist, album, or song..." />

            {/* Search Results (Inline) */}
            <SmartSearch onComplete={handleSearchComplete} onCancel={handleSearchCancel} />

            {/* Two Column Layout: History + Activity Log */}
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4}>
              {/* Search History */}
              <SearchHistory onSelectQuery={handleSelectHistoryQuery} maxEntries={5} />

              {/* Activity Log */}
              <ActivityLog maxEntries={10} showClearButton />
            </Grid>
          </VStack>
        )}
      </VStack>
    </Box>
  )
}
