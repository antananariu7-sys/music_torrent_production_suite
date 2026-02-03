import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Input,
  VStack,
  HStack,
  Text,
  Table,
  Spinner,
} from '@chakra-ui/react'
import { FiSearch, FiAlertCircle } from 'react-icons/fi'
import { useAuthStore } from '@/store/useAuthStore'
import { useSearchStore } from '@/store/useSearchStore'

export function SearchSection(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const username = useAuthStore((state) => state.username)

  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Search store
  const results = useSearchStore((state) => state.results)
  const searchError = useSearchStore((state) => state.error)
  const setResults = useSearchStore((state) => state.setResults)
  const setError = useSearchStore((state) => state.setError)

  // Auth store action
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return
    }

    setIsLoading(true)
    setError(undefined)

    try {
      const response = await window.api.search.start({ query: searchQuery })

      if (response.success && response.results) {
        setResults(response.results)
      } else {
        setError(response.error || 'Search failed')
      }
    } catch (error) {
      console.error('Search failed:', error)
      setError(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && searchQuery.trim()) {
      handleSearch()
    }
  }

  const handleViewTorrent = async (url: string) => {
    try {
      console.log('[SearchSection] Opening torrent URL with session:', url)
      const response = await window.api.search.openUrl(url)

      if (!response.success) {
        console.error('[SearchSection] Failed to open URL:', response.error)
        setError(response.error || 'Failed to open torrent page')
      } else {
        console.log('[SearchSection] ✅ Torrent page opened successfully')
      }
    } catch (error) {
      console.error('[SearchSection] Error opening URL:', error)
      setError(error instanceof Error ? error.message : 'Failed to open torrent page')
    }
  }

  return (
    <Box>
      {/* Search Input Section */}
      <VStack align="stretch" gap={4}>
        <HStack>
          <Input
            placeholder={
              isAuthenticated
                ? 'Search RuTracker for music torrents...'
                : 'Login to search RuTracker'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isAuthenticated || isLoading}
            size="lg"
          />
          <Button
            colorPalette="blue"
            onClick={handleSearch}
            loading={isLoading}
            disabled={!isAuthenticated || !searchQuery.trim() || isLoading}
            size="lg"
          >
            <FiSearch /> Search
          </Button>
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
                <FiAlertCircle />
                <Text fontWeight="bold" color="orange.500">
                  Authentication Required
                </Text>
              </HStack>
              <Text fontSize="sm" color="text.secondary">
                Please login to RuTracker in the Settings page to enable search functionality.
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

        {/* Search Error */}
        {searchError && (
          <Box
            p={4}
            borderRadius="md"
            bg="red.500/10"
            borderWidth="1px"
            borderColor="red.500/30"
          >
            <HStack>
              <FiAlertCircle />
              <Text color="red.500">{searchError}</Text>
            </HStack>
          </Box>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <Box>
            <Text fontSize="lg" fontWeight="bold" mb={3}>
              Search Results ({results.length})
            </Text>
            <Box overflowX="auto">
              <Table.Root size="sm" variant="outline">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Title</Table.ColumnHeader>
                    <Table.ColumnHeader>Author</Table.ColumnHeader>
                    <Table.ColumnHeader>Size</Table.ColumnHeader>
                    <Table.ColumnHeader>Seeders</Table.ColumnHeader>
                    <Table.ColumnHeader>Leechers</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {results.map((result) => (
                    <Table.Row key={result.id}>
                      <Table.Cell>
                        <Text fontSize="sm" fontWeight="medium">
                          {result.title}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{result.author}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm">{result.size}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="green.500" fontWeight="bold">
                          {result.seeders}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text fontSize="sm" color="red.500">
                          {result.leechers}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="ghost"
                          size="sm"
                          colorPalette="blue"
                          onClick={() => handleViewTorrent(result.url)}
                        >
                          View
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Box>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <HStack justify="center" py={4}>
            <Spinner size="lg" color="blue.500" />
            <Text>Searching RuTracker...</Text>
          </HStack>
        )}
      </VStack>
    </Box>
  )
}
