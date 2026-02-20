import { useEffect, useRef } from 'react'
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react'
import { FiX, FiFolder, FiPlay } from 'react-icons/fi'
import { toaster } from '@/components/ui/toaster'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import type { MixExportProgress } from '@shared/types/mixExport.types'

interface ExportProgressBarProps {
  progress: MixExportProgress
  onCancel: () => void
}

const PHASE_LABELS: Record<string, string> = {
  validating: 'Validating files...',
  analyzing: 'Analyzing loudness',
  rendering: 'Rendering mix',
  encoding: 'Encoding',
  complete: 'Export complete',
  error: 'Export failed',
  cancelled: 'Export cancelled',
}

function getPhaseLabel(progress: MixExportProgress): string {
  const base = PHASE_LABELS[progress.phase] ?? progress.phase
  if (progress.phase === 'analyzing' && progress.totalTracks > 0) {
    return `${base} — track ${progress.currentTrackIndex + 1}/${progress.totalTracks}`
  }
  if (progress.phase === 'rendering' && progress.currentTrackName) {
    return `${base}...`
  }
  return base
}

function getOutputDirectory(outputPath: string): string {
  return outputPath.replace(/[\\/][^\\/]+$/, '')
}

export function ExportProgressBar({ progress, onCancel }: ExportProgressBarProps): JSX.Element {
  const toastedRef = useRef(false)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)

  // On completion: show toast
  useEffect(() => {
    if (toastedRef.current) return

    if (progress.phase === 'complete') {
      toastedRef.current = true
      toaster.create({
        title: 'Mix exported successfully',
        type: 'success',
      })
    } else if (progress.phase === 'error') {
      toastedRef.current = true
      toaster.create({
        title: 'Export failed',
        description: progress.error ?? 'Unknown error',
        type: 'error',
      })
    } else if (progress.phase === 'cancelled') {
      toastedRef.current = true
      toaster.create({
        title: 'Export cancelled',
        type: 'info',
      })
    }
  }, [progress.phase, progress.outputPath, progress.error])

  const isTerminal = progress.phase === 'complete' || progress.phase === 'error' || progress.phase === 'cancelled'
  const barColor = progress.phase === 'complete'
    ? 'var(--chakra-colors-green-500, #38a169)'
    : progress.phase === 'error'
      ? 'var(--chakra-colors-red-500, #e53e3e)'
      : progress.phase === 'cancelled'
        ? 'var(--chakra-colors-yellow-500, #ecc94b)'
        : 'var(--chakra-colors-blue-500, #3b82f6)'

  function handleOpenFolder(): void {
    if (progress.outputPath) {
      window.api.openPath(getOutputDirectory(progress.outputPath))
    }
  }

  function handlePlayMix(): void {
    if (progress.outputPath) {
      const filename = progress.outputPath.replace(/^.*[\\/]/, '')
      playPlaylist([{ filePath: progress.outputPath, name: filename }], 0)
    }
  }

  return (
    <Box
      p={4}
      borderRadius="lg"
      bg="bg.card"
      border="1px solid"
      borderColor="border.base"
    >
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="text.primary">
            {getPhaseLabel(progress)}
          </Text>
          <HStack gap={2}>
            <Text fontSize="sm" color="text.muted">
              {progress.percentage}%
            </Text>
            {!isTerminal && (
              <Button size="xs" variant="ghost" onClick={onCancel} title="Cancel export">
                <FiX />
              </Button>
            )}
          </HStack>
        </HStack>

        {/* Progress bar */}
        <div
          style={{
            height: 8,
            background: 'var(--chakra-colors-bg-surface, #1a1a2e)',
            borderRadius: 9999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress.percentage}%`,
              background: barColor,
              borderRadius: 9999,
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        {/* Completed state — show output path and actions */}
        {progress.phase === 'complete' && progress.outputPath && (
          <HStack justify="space-between" pt={1}>
            <Text fontSize="xs" color="text.muted" truncate flex={1}>
              {progress.outputPath}
            </Text>
            <HStack gap={1}>
              <Button size="xs" variant="ghost" onClick={handlePlayMix} title="Play exported mix">
                <FiPlay />
                Play
              </Button>
              <Button size="xs" variant="ghost" onClick={handleOpenFolder} title="Open output folder">
                <FiFolder />
                Open folder
              </Button>
            </HStack>
          </HStack>
        )}

        {/* Error state — show error message */}
        {progress.phase === 'error' && progress.error && (
          <Text fontSize="xs" color="red.400" pt={1}>
            {progress.error}
          </Text>
        )}
      </VStack>
    </Box>
  )
}
