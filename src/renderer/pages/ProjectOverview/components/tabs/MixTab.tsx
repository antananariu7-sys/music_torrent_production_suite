import { HStack, VStack, Text, Icon, IconButton } from '@chakra-ui/react'
import { FiPlay } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { MetadataSection } from '../MetadataSection'
import { MixTracklist } from '@/components/features/mix/MixTracklist'
import { formatDuration, calculateTotalDuration, calculateTotalSize, formatFileSize } from '../../utils'
import type { Song } from '@shared/types/project.types'
import type { Track } from '@/store/audioPlayerStore'

function songToTrack(song: Song): Track {
  return {
    filePath: song.localFilePath ?? song.externalFilePath ?? '',
    name: song.title,
    duration: song.duration,
  }
}

export function MixTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)

  if (!currentProject) {
    return <></>
  }

  const songs = [...currentProject.songs].sort((a, b) => a.order - b.order)
  const totalDuration = calculateTotalDuration(songs)
  const totalSize = calculateTotalSize(songs)
  const tracks = songs.map(songToTrack)

  function handlePlayAll(): void {
    if (tracks.length > 0) {
      playPlaylist(tracks, 0)
    }
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Mix Header */}
      <HStack justify="space-between" align="center">
        <HStack gap={6}>
          <Text fontSize="lg" fontWeight="semibold" color="text.primary">
            Mix
          </Text>
          <Text fontSize="sm" color="text.muted">
            {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
          </Text>
          {totalDuration > 0 && (
            <Text fontSize="sm" color="text.muted">
              {formatDuration(totalDuration)}
            </Text>
          )}
          {totalSize > 0 && (
            <Text fontSize="sm" color="text.muted">
              {formatFileSize(totalSize)}
            </Text>
          )}
        </HStack>
        {songs.length > 0 && (
          <IconButton
            aria-label="Play all"
            size="sm"
            colorPalette="blue"
            variant="subtle"
            onClick={handlePlayAll}
            title="Play all tracks"
          >
            <Icon as={FiPlay} boxSize={4} />
          </IconButton>
        )}
      </HStack>

      {/* Tracklist */}
      <MixTracklist />

      {/* Metadata Section */}
      <MetadataSection
        genre={currentProject.mixMetadata?.genre}
        tags={currentProject.mixMetadata?.tags || []}
        directory={currentProject.projectDirectory}
      />
    </VStack>
  )
}
