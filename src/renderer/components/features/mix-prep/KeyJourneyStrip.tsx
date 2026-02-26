import { HStack, Text, Badge } from '@chakra-ui/react'
import { getCompatibilityLabel } from '@shared/utils/camelotWheel'
import type { Song } from '@shared/types/project.types'

interface KeyJourneyStripProps {
  songs: Song[]
}

const compatColor = {
  true: 'green',
  false: 'red',
  null: 'gray',
} as const

/**
 * Horizontal strip showing the Camelot key path through the mix
 * with compatibility indicators between each pair.
 */
export function KeyJourneyStrip({ songs }: KeyJourneyStripProps): JSX.Element {
  if (songs.length === 0) {
    return (
      <Text fontSize="xs" color="text.muted">
        No tracks
      </Text>
    )
  }

  const items: JSX.Element[] = []

  for (let i = 0; i < songs.length; i++) {
    const key = songs[i].musicalKey ?? '?'

    // Key badge
    items.push(
      <Badge
        key={`key-${i}`}
        variant="subtle"
        colorPalette={key === '?' ? 'gray' : 'blue'}
        fontSize="2xs"
        fontFamily="monospace"
      >
        {key}
      </Badge>
    )

    // Arrow connector with compatibility color (skip after last)
    if (i < songs.length - 1) {
      const nextKey = songs[i + 1].musicalKey
      const compat = getCompatibilityLabel(songs[i].musicalKey, nextKey)
      const colorKey = String(compat.compatible) as 'true' | 'false' | 'null'
      const palette = compatColor[colorKey]

      items.push(
        <Text
          key={`arrow-${i}`}
          fontSize="2xs"
          color={`${palette}.400`}
          title={compat.label}
        >
          →
        </Text>
      )
    }
  }

  return (
    <HStack gap={1} wrap="wrap">
      {items}
    </HStack>
  )
}
