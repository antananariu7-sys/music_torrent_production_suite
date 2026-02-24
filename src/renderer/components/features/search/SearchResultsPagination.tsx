import { useCallback } from 'react'
import { HStack, Button, Text } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface SearchResultsPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalResults: number
  filteredCount?: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

const PAGE_SIZES = [20, 50, 100]
const MAX_VISIBLE_PAGES = 5

function getVisiblePages(
  current: number,
  total: number
): (number | 'ellipsis')[] {
  if (total <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const pages: (number | 'ellipsis')[] = [1]

  let start = Math.max(2, current - 1)
  let end = Math.min(total - 1, current + 1)

  // Adjust if near start
  if (current <= 3) {
    start = 2
    end = Math.min(4, total - 1)
  }

  // Adjust if near end
  if (current >= total - 2) {
    start = Math.max(total - 3, 2)
    end = total - 1
  }

  if (start > 2) pages.push('ellipsis')

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (end < total - 1) pages.push('ellipsis')

  pages.push(total)
  return pages
}

export function SearchResultsPagination({
  currentPage,
  totalPages,
  pageSize,
  totalResults,
  filteredCount,
  onPageChange,
  onPageSizeChange,
}: SearchResultsPaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(
    currentPage * pageSize,
    filteredCount ?? totalResults
  )
  const displayCount = filteredCount ?? totalResults

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onPageSizeChange(Number(e.target.value))
    },
    [onPageSizeChange]
  )

  if (displayCount === 0) return null

  const visiblePages = getVisiblePages(currentPage, totalPages)

  return (
    <HStack justify="space-between" mt={2} flexWrap="wrap" gap={2}>
      {/* Summary text */}
      <Text fontSize="xs" color="text.muted">
        Showing {startItem}–{endItem} of {displayCount}
        {filteredCount != null && filteredCount !== totalResults && (
          <Text as="span" color="text.muted">
            {' '}
            (filtered from {totalResults})
          </Text>
        )}
      </Text>

      {/* Page controls */}
      {totalPages > 1 && (
        <HStack gap={0.5}>
          <Button
            size="2xs"
            variant="ghost"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <FiChevronLeft />
          </Button>

          {visiblePages.map((page, idx) =>
            page === 'ellipsis' ? (
              <Text
                key={`ellipsis-${idx}`}
                fontSize="xs"
                color="text.muted"
                px={1}
              >
                …
              </Text>
            ) : (
              <Button
                key={page}
                size="2xs"
                variant={page === currentPage ? 'solid' : 'ghost'}
                colorPalette={page === currentPage ? 'blue' : 'gray'}
                onClick={() => onPageChange(page)}
                minW={6}
              >
                {page}
              </Button>
            )
          )}

          <Button
            size="2xs"
            variant="ghost"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <FiChevronRight />
          </Button>
        </HStack>
      )}

      {/* Page size selector */}
      <HStack gap={1}>
        <Text fontSize="xs" color="text.muted">
          Per page:
        </Text>
        <select
          value={pageSize}
          onChange={handlePageSizeChange}
          style={{
            fontSize: '12px',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid var(--chakra-colors-border-base)',
            background: 'var(--chakra-colors-bg-card)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option
              key={size}
              value={size}
              style={{
                background: 'var(--chakra-colors-bg-card)',
                color: 'var(--chakra-colors-text-primary)',
              }}
            >
              {size}
            </option>
          ))}
        </select>
      </HStack>
    </HStack>
  )
}
