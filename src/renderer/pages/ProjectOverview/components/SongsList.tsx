import { Box, Text, VStack } from '@chakra-ui/react'
import {
  Table,
} from '@chakra-ui/react'
import type { Song } from '@shared/types/project.types'
import { formatDuration } from '../utils'

interface SongsListProps {
  songs: Song[]
  maxDisplay?: number
}

export function SongsList({ songs, maxDisplay = 10 }: SongsListProps): JSX.Element {
  const displayedSongs = songs.slice(0, maxDisplay)
  const hasMore = songs.length > maxDisplay

  if (songs.length === 0) {
    return (
      <Box
        bg="bg.card"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        p={12}
        textAlign="center"
      >
        <Text color="text.muted" fontSize="lg">
          No songs added yet
        </Text>
      </Box>
    )
  }

  return (
    <VStack align="stretch" gap={2}>
      <Box
        bg="bg.card"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        overflow="hidden"
      >
        <Table.Root variant="outline" striped>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader w="60px" textAlign="center">#</Table.ColumnHeader>
              <Table.ColumnHeader>Title</Table.ColumnHeader>
              <Table.ColumnHeader>Artist</Table.ColumnHeader>
              <Table.ColumnHeader w="120px" textAlign="right">Duration</Table.ColumnHeader>
              <Table.ColumnHeader w="100px">Format</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {displayedSongs.map((song) => (
              <Table.Row key={song.id}>
                <Table.Cell textAlign="center" color="text.muted">
                  {song.order}
                </Table.Cell>
                <Table.Cell fontWeight="medium" color="text.primary">
                  {song.title}
                </Table.Cell>
                <Table.Cell color="text.secondary">
                  {song.artist || '—'}
                </Table.Cell>
                <Table.Cell textAlign="right" fontFamily="monospace" color="text.secondary">
                  {formatDuration(song.duration)}
                </Table.Cell>
                <Table.Cell>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    color="accent.400"
                  >
                    {song.format || '—'}
                  </Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>

      {hasMore && (
        <Text fontSize="sm" color="text.muted" textAlign="center">
          Showing {maxDisplay} of {songs.length} songs
        </Text>
      )}
    </VStack>
  )
}
