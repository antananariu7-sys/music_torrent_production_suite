import { useEffect } from 'react'
import { Box, VStack, HStack, Text } from '@chakra-ui/react'
import { FiAlertCircle } from 'react-icons/fi'
import { useAuthStore } from '@/store/useAuthStore'
import { SmartSearchBar, SmartSearch } from '@/components/features/search'

export function SearchSection(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const username = useAuthStore((state) => state.username)
  const setAuthState = useAuthStore((state) => state.setAuthState)

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

  const handleSearchComplete = (filePath: string) => {
    console.log('[SearchSection] Torrent downloaded to:', filePath)
    // TODO: Show success notification or add to project
  }

  const handleSearchCancel = () => {
    console.log('[SearchSection] Search cancelled')
  }

  return (
    <Box>
      <VStack align="stretch" gap={4}>
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
                <FiAlertCircle />
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

        {/* Authenticated User Info */}
        {isAuthenticated && username && (
          <Text fontSize="sm" color="text.secondary">
            Logged in as: <strong>{username}</strong>
          </Text>
        )}

        {/* Smart Search Bar */}
        {isAuthenticated && (
          <>
            <SmartSearchBar placeholder="Search for artist, album, or song..." />
            <SmartSearch
              onComplete={handleSearchComplete}
              onCancel={handleSearchCancel}
            />
          </>
        )}
      </VStack>
    </Box>
  )
}
