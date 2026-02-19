import { useRef, useState } from 'react'
import { Box, Flex, Text, Icon, IconButton, Table, Badge, VStack } from '@chakra-ui/react'
import {
  FiPlay,
  FiTrash2,
  FiArrowUp,
  FiArrowDown,
  FiMusic,
} from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { toaster } from '@/components/ui/toaster'
import { formatDuration, formatFileSize } from '@/pages/ProjectOverview/utils'
import type { Song } from '@shared/types/project.types'
import type { Track } from '@/store/audioPlayerStore'

function songToTrack(song: Song): Track {
  return {
    filePath: song.localFilePath ?? song.externalFilePath ?? '',
    name: song.title,
    duration: song.duration,
  }
}

export function MixTracklist(): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)

  // Drag-and-drop state
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragSongId = useRef<string | null>(null)

  if (!currentProject) return <></>

  const songs = [...currentProject.songs].sort((a, b) => a.order - b.order)

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
        <VStack gap={2}>
          <Icon as={FiMusic} boxSize={8} color="text.muted" />
          <Text color="text.muted" fontSize="md">
            No tracks yet. Add files from the Torrent tab.
          </Text>
        </VStack>
      </Box>
    )
  }

  const tracks = songs.map(songToTrack)

  async function handleRemove(songId: string): Promise<void> {
    const response = await window.api.mix.removeSong(currentProject!.id, songId)
    if (response.success && response.data) {
      setCurrentProject(response.data)
      toaster.create({ title: 'Track removed', type: 'info' })
    } else {
      toaster.create({ title: 'Failed to remove track', description: response.error, type: 'error' })
    }
  }

  async function handleReorder(newOrder: string[]): Promise<void> {
    const response = await window.api.mix.reorderSongs(currentProject!.id, newOrder)
    if (response.success && response.data) {
      setCurrentProject(response.data)
    } else {
      toaster.create({ title: 'Failed to reorder tracks', description: response.error, type: 'error' })
    }
  }

  function moveUp(index: number): void {
    if (index === 0) return
    const newOrder = songs.map((s) => s.id)
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    handleReorder(newOrder)
  }

  function moveDown(index: number): void {
    if (index === songs.length - 1) return
    const newOrder = songs.map((s) => s.id)
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    handleReorder(newOrder)
  }

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  function handleDragStart(songId: string): void {
    dragSongId.current = songId
  }

  function handleDragOver(e: React.DragEvent, index: number): void {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(dropIndex: number): void {
    setDragOverIndex(null)
    const fromId = dragSongId.current
    dragSongId.current = null
    if (!fromId) return

    const fromIndex = songs.findIndex((s) => s.id === fromId)
    if (fromIndex === -1 || fromIndex === dropIndex) return

    const newOrder = songs.map((s) => s.id)
    newOrder.splice(fromIndex, 1)
    newOrder.splice(dropIndex, 0, fromId)
    handleReorder(newOrder)
  }

  function handleDragEnd(): void {
    setDragOverIndex(null)
    dragSongId.current = null
  }

  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      overflow="hidden"
    >
      <Table.Root variant="outline">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="44px" textAlign="center"></Table.ColumnHeader>
            <Table.ColumnHeader>Title</Table.ColumnHeader>
            <Table.ColumnHeader>Artist</Table.ColumnHeader>
            <Table.ColumnHeader w="90px" textAlign="right">Duration</Table.ColumnHeader>
            <Table.ColumnHeader w="80px" pl={4}>Format</Table.ColumnHeader>
            <Table.ColumnHeader w="80px" textAlign="right">Bitrate</Table.ColumnHeader>
            <Table.ColumnHeader w="80px" textAlign="right">Size</Table.ColumnHeader>
            <Table.ColumnHeader w="90px" textAlign="center">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {songs.map((song, index) => (
            <Table.Row
              key={song.id}
              draggable
              onDragStart={() => handleDragStart(song.id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              cursor="grab"
              bg={dragOverIndex === index ? 'blue.500/10' : undefined}
              borderTop={dragOverIndex === index ? '2px solid' : undefined}
              borderColor={dragOverIndex === index ? 'blue.500' : undefined}
              _hover={{ bg: 'bg.muted' }}
            >
              <Table.Cell textAlign="center" px={1}>
                <IconButton
                  aria-label="Play"
                  size="xs"
                  variant="ghost"
                  colorPalette="blue"
                  onClick={() => playPlaylist(tracks, index)}
                  title="Play"
                >
                  <Icon as={FiPlay} boxSize={3} />
                </IconButton>
              </Table.Cell>
              <Table.Cell>
                <Text fontWeight="medium" color="text.primary" lineClamp={1} title={song.title}>
                  {song.title}
                </Text>
              </Table.Cell>
              <Table.Cell color="text.secondary" fontSize="sm">
                {song.artist || '—'}
              </Table.Cell>
              <Table.Cell textAlign="right" fontFamily="monospace" fontSize="sm" color="text.secondary">
                {formatDuration(song.duration)}
              </Table.Cell>
              <Table.Cell pl={4}>
                {song.format ? (
                  <Badge
                    fontSize="2xs"
                    fontWeight="bold"
                    textTransform="uppercase"
                    colorPalette="blue"
                    variant="subtle"
                  >
                    {song.format}
                  </Badge>
                ) : (
                  <Text color="text.muted" fontSize="xs">—</Text>
                )}
              </Table.Cell>
              <Table.Cell textAlign="right" fontSize="xs" color="text.secondary">
                {song.bitrate ? `${song.bitrate} kbps` : '—'}
              </Table.Cell>
              <Table.Cell textAlign="right" fontSize="xs" color="text.secondary">
                {formatFileSize(song.fileSize)}
              </Table.Cell>
              <Table.Cell>
                <Flex gap={1} justify="center">
                  <IconButton
                    aria-label="Move up"
                    size="xs"
                    variant="ghost"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <Icon as={FiArrowUp} boxSize={3} />
                  </IconButton>
                  <IconButton
                    aria-label="Move down"
                    size="xs"
                    variant="ghost"
                    onClick={() => moveDown(index)}
                    disabled={index === songs.length - 1}
                    title="Move down"
                  >
                    <Icon as={FiArrowDown} boxSize={3} />
                  </IconButton>
                  <IconButton
                    aria-label="Remove"
                    size="xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => handleRemove(song.id)}
                    title="Remove from Mix"
                  >
                    <Icon as={FiTrash2} boxSize={3} />
                  </IconButton>
                </Flex>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}
