import { useEffect, useState } from 'react'
import { HStack, VStack, Text, Icon, IconButton } from '@chakra-ui/react'
import { FiPlay, FiDownload } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { useMixExportStore } from '@/store/mixExportStore'
import { useMixExportListener } from '@/hooks/useMixExportListener'
import { toaster } from '@/components/ui/toaster'
import { MetadataSection } from '../MetadataSection'
import { MixTracklist } from '@/components/features/mix/MixTracklist'
import { AddFilesDropZone } from '@/components/features/mix/AddFilesDropZone'
import { ExportConfigModal } from '@/components/features/mix/ExportConfigModal'
import { ExportProgressBar } from '@/components/features/mix/ExportProgressBar'
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
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)
  const isExporting = useMixExportStore((s) => s.isExporting)
  const progress = useMixExportStore((s) => s.progress)
  const cancelExport = useMixExportStore((s) => s.cancelExport)

  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  useMixExportListener()

  // Sync assets/audio/ folder on every tab visit
  useEffect(() => {
    if (!currentProject) return
    window.api.mix.syncAudioFolder(currentProject.id).then((response) => {
      if (response.success && response.data && response.newCount && response.newCount > 0) {
        setCurrentProject(response.data)
        toaster.create({
          title: `Synced ${response.newCount} new ${response.newCount === 1 ? 'track' : 'tracks'} from audio folder`,
          type: 'success',
        })
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id])

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
          <HStack gap={2}>
            <IconButton
              aria-label="Export mix"
              size="sm"
              colorPalette="green"
              variant="subtle"
              onClick={() => setIsExportModalOpen(true)}
              title="Export mix to file"
              disabled={isExporting}
            >
              <Icon as={FiDownload} boxSize={4} />
            </IconButton>
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
          </HStack>
        )}
      </HStack>

      {/* Export Progress — visible during export AND after completion/error */}
      {progress && (
        <ExportProgressBar progress={progress} onCancel={cancelExport} />
      )}

      {/* Tracklist */}
      <MixTracklist />

      {/* Add files */}
      <AddFilesDropZone />

      {/* Metadata Section */}
      <MetadataSection
        genre={currentProject.mixMetadata?.genre}
        tags={currentProject.mixMetadata?.tags || []}
        directory={currentProject.projectDirectory}
      />

      {/* Export Config Modal */}
      <ExportConfigModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectId={currentProject.id}
        songs={songs}
        defaultCrossfade={currentProject.mixMetadata?.exportConfig?.defaultCrossfadeDuration ?? 5}
        exportConfig={currentProject.mixMetadata?.exportConfig}
        projectName={currentProject.name}
        mixMetadata={currentProject.mixMetadata}
      />
    </VStack>
  )
}
