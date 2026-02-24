import { useCallback } from 'react'
import { Box, Button, Text, HStack, Spinner } from '@chakra-ui/react'
import { FiChevronDown } from 'react-icons/fi'
import {
  useSmartSearchStore,
  useDiscoSearchMeta,
  useIsLoadingMore,
  useLoadMoreError,
} from '@/store/smartSearchStore'

const LOAD_MORE_BATCH_SIZE = 10

export function SearchResultsLoadMore() {
  const { discoQuery, discoLoadedPages, discoTotalPages } = useDiscoSearchMeta()
  const isLoadingMore = useIsLoadingMore()
  const loadMoreError = useLoadMoreError()
  const {
    appendRuTrackerResults,
    setLoadingMore,
    setLoadMoreError,
    setDiscoSearchMeta,
  } = useSmartSearchStore()

  const hasMore = discoLoadedPages > 0 && discoLoadedPages < discoTotalPages

  const handleLoadMore = useCallback(async () => {
    if (!discoQuery || !hasMore) return

    const fromPage = discoLoadedPages + 1
    const toPage = Math.min(
      discoLoadedPages + LOAD_MORE_BATCH_SIZE,
      discoTotalPages
    )

    setLoadingMore(true)

    try {
      const response = await window.api.search.loadMore({
        query: discoQuery,
        fromPage,
        toPage,
        filters: { minSeeders: 5 },
      })

      if (response.success) {
        appendRuTrackerResults(response.results, 'discography')
        setDiscoSearchMeta(discoQuery, toPage, response.totalPages)
      } else {
        setLoadMoreError(response.error || 'Failed to load more results')
      }
    } catch (err) {
      setLoadMoreError(
        err instanceof Error ? err.message : 'Failed to load more results'
      )
    }
  }, [
    discoQuery,
    hasMore,
    discoLoadedPages,
    discoTotalPages,
    setLoadingMore,
    appendRuTrackerResults,
    setDiscoSearchMeta,
    setLoadMoreError,
  ])

  if (!hasMore && !loadMoreError) return null

  const fromPage = discoLoadedPages + 1
  const toPage = Math.min(
    discoLoadedPages + LOAD_MORE_BATCH_SIZE,
    discoTotalPages
  )

  return (
    <Box mt={3} textAlign="center">
      {loadMoreError && (
        <Text fontSize="xs" color="red.400" mb={2}>
          {loadMoreError}
        </Text>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handleLoadMore}
        disabled={isLoadingMore}
      >
        <HStack gap={2}>
          {isLoadingMore ? <Spinner size="xs" /> : <FiChevronDown />}
          <Text fontSize="xs">
            {isLoadingMore
              ? `Loading pages ${fromPage}-${toPage}...`
              : `Load more results (pages ${fromPage}-${toPage} of ~${discoTotalPages})`}
          </Text>
        </HStack>
      </Button>
    </Box>
  )
}
