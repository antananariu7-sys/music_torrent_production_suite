import { HStack, IconButton, Icon } from '@chakra-ui/react'
import { FiPause, FiPlay, FiX, FiFolder, FiMusic } from 'react-icons/fi'

interface TorrentControlsProps {
  canPause: boolean
  canResume: boolean
  hasAudioFiles: boolean
  audioFileCount: number
  hasDownloadPath: boolean
  onPause: () => void
  onResume: () => void
  onRemove: () => void
  onOpenFolder: () => void
  onPlayAll: () => void
}

export function TorrentControls({
  canPause,
  canResume,
  hasAudioFiles,
  audioFileCount,
  hasDownloadPath,
  onPause,
  onResume,
  onRemove,
  onOpenFolder,
  onPlayAll,
}: TorrentControlsProps): JSX.Element {
  return (
    <HStack gap={1} flexShrink={0}>
      <IconButton
        aria-label="Open folder"
        size="sm"
        variant="ghost"
        onClick={onOpenFolder}
        title="Open download folder"
        disabled={!hasDownloadPath}
      >
        <Icon as={FiFolder} boxSize={4} />
      </IconButton>
      {hasAudioFiles && (
        <IconButton
          aria-label="Play all"
          size="sm"
          variant="ghost"
          colorPalette="blue"
          onClick={onPlayAll}
          title={`Play all (${audioFileCount} audio files)`}
        >
          <Icon as={FiMusic} boxSize={4} />
        </IconButton>
      )}
      {canPause && (
        <IconButton
          aria-label="Pause"
          size="sm"
          variant="ghost"
          onClick={onPause}
          title="Pause download"
        >
          <Icon as={FiPause} boxSize={4} />
        </IconButton>
      )}
      {canResume && (
        <IconButton
          aria-label="Resume"
          size="sm"
          variant="ghost"
          colorPalette="green"
          onClick={onResume}
          title="Resume download"
        >
          <Icon as={FiPlay} boxSize={4} />
        </IconButton>
      )}
      <IconButton
        aria-label="Remove"
        size="sm"
        variant="ghost"
        colorPalette="red"
        onClick={onRemove}
        title="Remove from queue"
      >
        <Icon as={FiX} boxSize={4} />
      </IconButton>
    </HStack>
  )
}
