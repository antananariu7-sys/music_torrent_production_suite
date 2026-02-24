import { memo } from 'react'
import { Box, Table, Text, HStack, Icon } from '@chakra-ui/react'
import { FiChevronDown, FiChevronRight } from 'react-icons/fi'
import type { SearchResult, ResultGroup } from '@shared/types/search.types'
import type { PageContentScanResult } from '@shared/types/discography.types'
import {
  useSearchTableState,
  type SortColumn,
} from './hooks/useSearchTableState'
import { SearchResultsRow } from './SearchResultsRow'
import { SearchResultsFilter } from './SearchResultsFilter'
import { SearchResultsPagination } from './SearchResultsPagination'
import type { SearchTabType } from './SearchResultsTabs'

interface SearchResultsTableProps {
  results: SearchResult[]
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean
  tabType?: SearchTabType
  scanResultsMap?: Map<string, PageContentScanResult>
  emptyMessage?: string
  highlightSongName?: string
  highlightAlbumName?: string
}

const ALBUM_GROUP_LABELS: Record<ResultGroup, string> = {
  studio: 'Studio Albums',
  live: 'Live / Concerts',
  compilation: 'Compilations',
  discography: 'Discography',
  other: 'Other',
}

const DISCO_GROUP_LABELS: Record<ResultGroup, string> = {
  studio: 'Studio Releases',
  live: 'Live Recordings',
  compilation: 'Compilations',
  discography: 'Collections',
  other: 'Other',
}

const SORTABLE_COLUMNS: {
  key: SortColumn
  label: string
  w?: string
  tooltip?: string
}[] = [
  { key: 'title', label: 'Title' },
  { key: 'size', label: 'Size', w: '90px' },
  { key: 'seeders', label: 'S/L', w: '110px' },
  {
    key: 'relevance',
    label: 'Relevance',
    w: '80px',
    tooltip:
      'Score 0\u2013100: title match (up to +40), seeder count (+1\u201330 log scale), lossless format bonus (+10)',
  },
]

function SortIndicator({
  column,
  activeColumn,
  direction,
}: {
  column: SortColumn
  activeColumn: SortColumn
  direction: 'asc' | 'desc'
}) {
  if (column !== activeColumn) return null
  return (
    <Text as="span" ml={1} fontSize="xs">
      {direction === 'asc' ? '▲' : '▼'}
    </Text>
  )
}

export const SearchResultsTable = memo(function SearchResultsTable({
  results,
  onSelectTorrent,
  isDownloading,
  tabType,
  scanResultsMap,
  emptyMessage = 'No results found.',
  highlightSongName,
  highlightAlbumName,
}: SearchResultsTableProps) {
  const {
    rows,
    sortColumn,
    sortDirection,
    onSort,
    onToggleGroup,
    isGroupCollapsed,
    expandedRowId,
    onToggleExpand,
    filterText,
    onFilterChange,
    currentPage,
    pageSize,
    filteredCount,
    totalCount,
    totalPages,
    onPageChange,
    onPageSizeChange,
    showHidden,
    hiddenCount,
    hiddenResults,
    onToggleHidden,
  } = useSearchTableState(results, { scanResultsMap, tabType })

  const groupLabels =
    tabType === 'discography' ? DISCO_GROUP_LABELS : ALBUM_GROUP_LABELS
  const isDiscographyTab = tabType === 'discography'

  if (results.length === 0) {
    return (
      <Box py={8} textAlign="center">
        <Text color="text.muted" fontSize="sm">
          {emptyMessage}
        </Text>
      </Box>
    )
  }

  return (
    <Box>
      {/* Filter input */}
      <SearchResultsFilter
        value={filterText}
        onChange={onFilterChange}
        totalCount={totalCount}
      />

      {/* Filtered empty state */}
      {filteredCount === 0 && filterText ? (
        <Box py={6} textAlign="center">
          <Text color="text.muted" fontSize="sm">
            No results match &ldquo;{filterText}&rdquo;
          </Text>
        </Box>
      ) : filteredCount === 0 && hiddenCount > 0 ? (
        <Box py={6} textAlign="center">
          <Text color="text.muted" fontSize="sm">
            All results were filtered as non-audio.{' '}
            <Text
              as="span"
              color="blue.400"
              cursor="pointer"
              _hover={{ textDecoration: 'underline' }}
              onClick={onToggleHidden}
            >
              Show {hiddenCount} hidden results
            </Text>
          </Text>
        </Box>
      ) : (
        <>
          <Box maxH="500px" overflowY="auto">
            <Table.Root size="sm" variant="outline">
              <Table.Header>
                <Table.Row>
                  {SORTABLE_COLUMNS.map((col) => (
                    <Table.ColumnHeader
                      key={col.key}
                      w={col.w}
                      cursor="pointer"
                      onClick={() => onSort(col.key)}
                      _hover={{ color: 'text.primary' }}
                      userSelect="none"
                      title={col.tooltip}
                    >
                      {col.label}
                      <SortIndicator
                        column={col.key}
                        activeColumn={sortColumn}
                        direction={sortDirection}
                      />
                    </Table.ColumnHeader>
                  ))}
                  <Table.ColumnHeader w={isDiscographyTab ? '100px' : '70px'}>
                    {isDiscographyTab ? 'Match' : 'Format'}
                  </Table.ColumnHeader>
                  <Table.ColumnHeader w="100px">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => {
                  if (row.type === 'group') {
                    const collapsed = isGroupCollapsed(row.group)
                    return (
                      <Table.Row
                        key={`group-${row.group}`}
                        bg="bg.surface"
                        cursor="pointer"
                        onClick={() => onToggleGroup(row.group)}
                        _hover={{ bg: 'bg.elevated' }}
                      >
                        <Table.Cell colSpan={6} py={1.5}>
                          <HStack gap={2} color="text.muted">
                            <Icon
                              as={collapsed ? FiChevronRight : FiChevronDown}
                              boxSize={3.5}
                            />
                            <Text
                              fontSize="xs"
                              fontWeight="semibold"
                              textTransform="uppercase"
                              letterSpacing="wide"
                            >
                              {groupLabels[row.group]}
                            </Text>
                            <Text fontSize="xs" color="text.muted">
                              ({row.count})
                            </Text>
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    )
                  }

                  return (
                    <SearchResultsRow
                      key={row.result.id}
                      torrent={row.result}
                      onSelect={onSelectTorrent}
                      isDownloading={isDownloading}
                      tabType={tabType}
                      scanResult={scanResultsMap?.get(row.result.id)}
                      isExpanded={expandedRowId === row.result.id}
                      onToggleExpand={onToggleExpand}
                      highlightSongName={highlightSongName}
                      highlightAlbumName={highlightAlbumName}
                      filterText={filterText}
                    />
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>

          {/* Pagination */}
          <SearchResultsPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalResults={totalCount}
            filteredCount={filterText ? filteredCount : undefined}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />

          {/* Hidden (non-audio) results section */}
          {hiddenCount > 0 && (
            <Box mt={3}>
              <HStack
                gap={2}
                cursor="pointer"
                onClick={onToggleHidden}
                color="text.muted"
                _hover={{ color: 'text.primary' }}
                userSelect="none"
              >
                <Icon
                  as={showHidden ? FiChevronDown : FiChevronRight}
                  boxSize={3.5}
                />
                <Text fontSize="xs" fontWeight="semibold">
                  Non-audio results ({hiddenCount})
                </Text>
              </HStack>

              {showHidden && (
                <Box mt={1} maxH="300px" overflowY="auto" opacity={0.6}>
                  <Table.Root size="sm" variant="outline">
                    <Table.Body>
                      {hiddenResults.map((result) => (
                        <SearchResultsRow
                          key={result.id}
                          torrent={result}
                          onSelect={onSelectTorrent}
                          isDownloading={isDownloading}
                          tabType={tabType}
                          scanResult={scanResultsMap?.get(result.id)}
                          isExpanded={expandedRowId === result.id}
                          onToggleExpand={onToggleExpand}
                          highlightSongName={highlightSongName}
                          highlightAlbumName={highlightAlbumName}
                          filterText={filterText}
                        />
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  )
})
