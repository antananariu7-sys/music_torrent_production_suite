import { memo } from 'react'
import { Box, Table, Text } from '@chakra-ui/react'
import type { SearchResult } from '@shared/types/search.types'
import { SearchResultsRow } from './SearchResultsRow'

interface SearchResultsTableProps {
  results: SearchResult[]
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean
}

export const SearchResultsTable = memo(function SearchResultsTable({
  results,
  onSelectTorrent,
  isDownloading,
}: SearchResultsTableProps) {
  if (results.length === 0) {
    return (
      <Box py={8} textAlign="center">
        <Text color="text.muted" fontSize="sm">
          No results found.
        </Text>
      </Box>
    )
  }

  return (
    <Box maxH="500px" overflowY="auto">
      <Table.Root size="sm" variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Title</Table.ColumnHeader>
            <Table.ColumnHeader w="90px">Size</Table.ColumnHeader>
            <Table.ColumnHeader w="110px">S/L</Table.ColumnHeader>
            <Table.ColumnHeader w="80px">Relevance</Table.ColumnHeader>
            <Table.ColumnHeader w="70px">Format</Table.ColumnHeader>
            <Table.ColumnHeader w="100px">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {results.map((torrent) => (
            <SearchResultsRow
              key={torrent.id}
              torrent={torrent}
              onSelect={onSelectTorrent}
              isDownloading={isDownloading}
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
})
