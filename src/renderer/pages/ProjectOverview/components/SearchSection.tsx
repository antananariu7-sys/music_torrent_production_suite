import { useEffect } from 'react'
import { Box, VStack, HStack, Text, Grid, Heading, Icon } from '@chakra-ui/react'
import { FiAlertCircle, FiSearch } from 'react-icons/fi'
import { useAuthStore } from '@/store/useAuthStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useSmartSearchStore } from '@/store/smartSearchStore'
import { SmartSearchBar, SmartSearch } from '@/components/features/search'
import { SearchHistory } from '@/components/features/search/SearchHistory'
import { ActivityLog } from '@/components/features/search/ActivityLog'

export function SearchSection(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const username = useAuthStore((state) => state.username)
  const setAuthState = useAuthStore((state) => state.setAuthState)
  const currentProject = useProjectStore((state) => state.currentProject)
  const startSearch = useSmartSearchStore((state) => state.startSearch)
  const setProjectContext = useSmartSearchStore((state) => state.setProjectContext)
  const loadHistoryFromProject = useSmartSearchStore((state) => state.loadHistoryFromProject)

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

  // Load search history when project changes
  useEffect(() => {
    if (currentProject) {
      // Set project context for saving
      setProjectContext(
        currentProject.id,
        currentProject.name,
        currentProject.projectDirectory
      )

      // Load existing search history
      loadHistoryFromProject(currentProject.id, currentProject.projectDirectory)
    }
  }, [currentProject, setProjectContext, loadHistoryFromProject])

  const handleSearchComplete = (filePath: string) => {
    console.log('[SearchSection] Torrent downloaded to:', filePath)
    // TODO: Show success notification or add to project
  }

  const handleSearchCancel = () => {
    console.log('[SearchSection] Search cancelled')
  }

  const handleSelectHistoryQuery = (query: string) => {
    startSearch(query)
  }

  return (
    <Box>
      <VStack align="stretch" gap={6}>
        {/* Section Header */}
        <HStack gap={2}>
          <Icon as={FiSearch} boxSize={5} color="interactive.base" />
          <Heading size="md" color="text.primary">
            Search Music
          </Heading>
        </HStack>

        {/* Authentication Warning */}
        {!isAuthenticated && (
          <Box
            p={4}
            borderRadius="md"
            bg="orange.500/10"
            borderWidth="1px"
            borderColor="orange.500/30"
          >
            <VStack align="start" gap={2}>
              <HStack>
                <Icon as={FiAlertCircle} />
                <Text fontWeight="bold" color="orange.500">
                  Authentication Required
                </Text>
              </HStack>
              <Text fontSize="sm" color="text.secondary">
                Please login to RuTracker in the Settings page to enable search
                functionality.
              </Text>
            </VStack>
          </Box>
        )}

        {/* Authenticated Content */}
        {isAuthenticated && (
          <VStack align="stretch" gap={4}>
            {/* User Info */}
            {username && (
              <Text fontSize="sm" color="text.muted">
                Logged in as <Text as="span" fontWeight="medium" color="text.primary">{username}</Text>
              </Text>
            )}

            {/* Search Bar */}
            <SmartSearchBar placeholder="Search for artist, album, or song..." />

            {/* Search Results (Inline) */}
            <SmartSearch
              onComplete={handleSearchComplete}
              onCancel={handleSearchCancel}
            />

            {/* Two Column Layout: History + Activity Log */}
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4}>
              {/* Search History */}
              <SearchHistory
                onSelectQuery={handleSelectHistoryQuery}
                maxEntries={5}
              />

              {/* Activity Log */}
              <ActivityLog maxEntries={10} showClearButton />
            </Grid>
          </VStack>
        )}
      </VStack>
    </Box>
  )
}
