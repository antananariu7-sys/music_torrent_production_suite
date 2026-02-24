import { useState, useMemo } from 'react'
import { Box, HStack, Button, Text } from '@chakra-ui/react'
import type { SearchResult } from '@shared/types/search.types'
import type { PageContentScanResult } from '@shared/types/discography.types'
import { SearchResultsTable } from './SearchResultsTable'
import { SearchResultsLoadMore } from './SearchResultsLoadMore'

export type SearchTabType = 'album' | 'discography'

interface SearchResultsTabsProps {
  results: SearchResult[]
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean
  discographyScanResults?: PageContentScanResult[]
  highlightSongName?: string
  highlightAlbumName?: string
}

export function SearchResultsTabs({
  results,
  onSelectTorrent,
  isDownloading,
  discographyScanResults = [],
  highlightSongName,
  highlightAlbumName,
}: SearchResultsTabsProps) {
  const albumResults = useMemo(
    () => results.filter((r) => r.searchSource === 'album'),
    [results]
  )
  const discoResults = useMemo(
    () => results.filter((r) => r.searchSource === 'discography'),
    [results]
  )

  const defaultTab: SearchTabType =
    albumResults.length > 0 ? 'album' : 'discography'
  const [activeTab, setActiveTab] = useState<SearchTabType>(defaultTab)

  // Build scan results map for Match column
  const scanResultsMap = useMemo(() => {
    const map = new Map<string, PageContentScanResult>()
    discographyScanResults.forEach((r) => {
      map.set(r.searchResult.id, r)
    })
    return map
  }, [discographyScanResults])

  const tabs: { value: SearchTabType; label: string; count: number }[] = [
    { value: 'album', label: 'Album Results', count: albumResults.length },
    {
      value: 'discography',
      label: 'Discography Results',
      count: discoResults.length,
    },
  ]

  return (
    <Box>
      {/* Tab buttons */}
      <HStack gap={1} mb={2}>
        {tabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? 'solid' : 'ghost'}
            colorPalette={activeTab === tab.value ? 'blue' : 'gray'}
            size="xs"
            onClick={() => setActiveTab(tab.value)}
            px={3}
          >
            <Text fontSize="xs">
              {tab.label} ({tab.count})
            </Text>
          </Button>
        ))}
      </HStack>

      {/* Tab content */}
      {activeTab === 'album' && (
        <SearchResultsTable
          results={albumResults}
          onSelectTorrent={onSelectTorrent}
          isDownloading={isDownloading}
          tabType="album"
          emptyMessage="No direct album results."
          highlightSongName={highlightSongName}
        />
      )}
      {activeTab === 'discography' && (
        <SearchResultsTable
          results={discoResults}
          onSelectTorrent={onSelectTorrent}
          isDownloading={isDownloading}
          tabType="discography"
          scanResultsMap={scanResultsMap}
          emptyMessage="No discography results."
          highlightSongName={highlightSongName}
          highlightAlbumName={highlightAlbumName}
        />
      )}

      {/* Load More button (for discography search) */}
      <SearchResultsLoadMore />
    </Box>
  )
}
