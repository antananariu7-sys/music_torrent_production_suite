import { useRef, useState, useMemo, useCallback } from 'react'
import { Flex, Text, Icon, IconButton, Badge, VStack } from '@chakra-ui/react'
import { FiPlay, FiTrash2, FiMusic } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { toaster } from '@/components/ui/toaster'
import type { Song } from '@shared/types/project.types'
import type { Track } from '@/store/audioPlayerStore'

function songToTrack(song: Song): Track {
  return {
    filePath: song.localFilePath ?? song.externalFilePath ?? '',
    name: song.title,
    duration: song.duration,
  }
}

interface MixPrepTracklistProps {
  songs: Song[]
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

export function MixPrepTracklist({
  songs,
  selectedIndex,
  onSelectIndex,
}: MixPrepTracklistProps): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragSongId = useRef<string | null>(null)

  const tracks = useMemo(() => songs.map(songToTrack), [songs])

  // ── Reorder ────────────────────────────────────────────────────────────────

  const handleReorder = useCallback(
    async (newOrder: string[]) => {
      if (!currentProject) return
      const response = await window.api.mix.reorderSongs(
        currentProject.id,
        newOrder
      )
      if (response.success && response.data) {
        setCurrentProject(response.data)
      } else {
        toaster.create({
          title: 'Failed to reorder tracks',
          description: response.error,
          type: 'error',
        })
      }
    },
    [currentProject, setCurrentProject]
  )

  // ── Remove ─────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    async (songId: string) => {
      if (!currentProject) return
      const response = await window.api.mix.removeSong(
        currentProject.id,
        songId
      )
      if (response.success && response.data) {
        setCurrentProject(response.data)
        toaster.create({ title: 'Track removed', type: 'info' })
      } else {
        toaster.create({
          title: 'Failed to remove track',
          description: response.error,
          type: 'error',
        })
      }
    },
    [currentProject, setCurrentProject]
  )

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

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

  // ── Pair highlighting ──────────────────────────────────────────────────────

  function isInSelectedPair(index: number): boolean {
    if (selectedIndex === 0) return index === 0
    return index === selectedIndex || index === selectedIndex - 1
  }

  function isPairConnector(index: number): boolean {
    // Show connector on the incoming track (selectedIndex) when it has a pair
    return selectedIndex > 0 && index === selectedIndex
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (songs.length === 0) {
    return (
      <VStack gap={2} p={6} textAlign="center" h="full" justify="center">
        <Icon as={FiMusic} boxSize={6} color="text.muted" />
        <Text color="text.muted" fontSize="xs">
          Add songs from Search or import files to build your mix
        </Text>
      </VStack>
    )
  }

  return (
    <VStack gap={0} align="stretch" overflowY="auto" flex={1}>
      {songs.map((song, index) => {
        const isSelected = isInSelectedPair(index)
        const showConnector = isPairConnector(index)
        const isDragTarget = dragOverIndex === index

        return (
          <Flex
            key={song.id}
            align="center"
            gap={2}
            px={3}
            py={1.5}
            cursor="pointer"
            draggable
            onDragStart={() => handleDragStart(song.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectIndex(index)}
            bg={
              isDragTarget
                ? 'blue.500/10'
                : isSelected
                  ? 'bg.elevated'
                  : undefined
            }
            borderTop={isDragTarget ? '2px solid' : undefined}
            borderColor={isDragTarget ? 'blue.500' : undefined}
            borderLeft={showConnector ? '3px solid' : '3px solid transparent'}
            borderLeftColor={showConnector ? 'brand.400' : 'transparent'}
            _hover={{ bg: isSelected ? 'bg.elevated' : 'bg.muted' }}
            transition="background 0.1s"
          >
            {/* Order number */}
            <Text
              fontSize="xs"
              fontWeight="bold"
              color="text.muted"
              w="20px"
              textAlign="center"
              flexShrink={0}
            >
              {index + 1}
            </Text>

            {/* Title (clamp to 1 line) */}
            <Text
              flex={1}
              fontSize="sm"
              fontWeight="medium"
              color="text.primary"
              lineClamp={1}
              title={`${song.artist ? song.artist + ' — ' : ''}${song.title}`}
            >
              {song.title}
            </Text>

            {/* BPM badge */}
            {song.bpm && (
              <Badge
                fontSize="2xs"
                colorPalette="purple"
                variant="subtle"
                flexShrink={0}
              >
                {Math.round(song.bpm)}
              </Badge>
            )}

            {/* Format badge */}
            {song.format && (
              <Badge
                fontSize="2xs"
                colorPalette="blue"
                variant="subtle"
                textTransform="uppercase"
                flexShrink={0}
              >
                {song.format}
              </Badge>
            )}

            {/* Inline action buttons */}
            <Flex gap={0} flexShrink={0} onClick={(e) => e.stopPropagation()}>
              <IconButton
                aria-label="Play"
                size="2xs"
                variant="ghost"
                colorPalette="blue"
                onClick={() => playPlaylist(tracks, index)}
                title="Play from here"
              >
                <Icon as={FiPlay} boxSize={3} />
              </IconButton>
              <IconButton
                aria-label="Remove"
                size="2xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => handleRemove(song.id)}
                title="Remove from mix"
              >
                <Icon as={FiTrash2} boxSize={3} />
              </IconButton>
            </Flex>
          </Flex>
        )
      })}
    </VStack>
  )
}
