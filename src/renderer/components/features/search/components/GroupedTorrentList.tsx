import { useState, memo } from 'react'
import { VStack, Text, HStack, Icon } from '@chakra-ui/react'
import {
  FiMusic,
  FiDisc,
  FiChevronRight,
  FiChevronDown,
  FiList,
} from 'react-icons/fi'
import type { SearchResult, ResultGroup } from '@shared/types/search.types'
import type { PageContentScanResult } from '@shared/types/discography.types'
import { groupResults } from '@shared/utils/resultClassifier'
import { TorrentItem } from './TorrentItem'

// Group labels and icons for each category
const GROUP_CONFIG: Record<
  ResultGroup,
  { label: string; icon: typeof FiDisc; color: string }
> = {
  studio: { label: 'Studio Albums', icon: FiDisc, color: 'blue.400' },
  live: { label: 'Live / Concerts', icon: FiMusic, color: 'orange.400' },
  compilation: { label: 'Compilations', icon: FiList, color: 'purple.400' },
  discography: { label: 'Discography', icon: FiDisc, color: 'green.400' },
  other: { label: 'Other', icon: FiMusic, color: 'text.muted' },
}

const GROUP_ORDER: ResultGroup[] = [
  'studio',
  'discography',
  'live',
  'compilation',
  'other',
]

interface GroupedTorrentListProps {
  grouped: ReturnType<typeof groupResults>
  onSelectTorrent?: (torrent: SearchResult) => void
  isDownloading?: boolean
  scanResultsMap: Map<string, PageContentScanResult>
  highlightSongName?: string
}

export const GroupedTorrentList = memo(function GroupedTorrentList({
  grouped,
  onSelectTorrent,
  isDownloading,
  scanResultsMap,
  highlightSongName,
}: GroupedTorrentListProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ResultGroup>>(
    new Set()
  )

  const toggleGroup = (group: ResultGroup) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  return (
    <>
      {GROUP_ORDER.map((group) => {
        const items = grouped[group]
        if (items.length === 0) return null

        const config = GROUP_CONFIG[group]
        const isCollapsed = collapsedGroups.has(group)

        return (
          <VStack key={group} align="stretch" gap={1}>
            <HStack
              gap={2}
              py={1}
              cursor="pointer"
              onClick={() => toggleGroup(group)}
              _hover={{ color: 'text.primary' }}
              color="text.muted"
              transition="color 0.15s"
            >
              <Icon
                as={isCollapsed ? FiChevronRight : FiChevronDown}
                boxSize={3}
                flexShrink={0}
              />
              <Icon
                as={config.icon}
                boxSize={3.5}
                color={config.color}
                flexShrink={0}
              />
              <Text
                fontSize="xs"
                fontWeight="semibold"
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {config.label}
              </Text>
              <Text fontSize="xs" color="text.muted">
                ({items.length})
              </Text>
            </HStack>

            {!isCollapsed && (
              <VStack align="stretch" gap={2} pl={2}>
                {items.map((torrent) => (
                  <TorrentItem
                    key={torrent.id}
                    torrent={torrent}
                    onSelect={onSelectTorrent}
                    isDownloading={isDownloading}
                    scanResult={scanResultsMap.get(torrent.id)}
                    highlightSongName={highlightSongName}
                  />
                ))}
              </VStack>
            )}
          </VStack>
        )
      })}
    </>
  )
})
