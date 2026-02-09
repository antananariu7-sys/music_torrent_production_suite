import { Box, VStack, HStack, Text, Heading, Icon } from '@chakra-ui/react'
import { FiActivity } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import {
  useDownloadQueueStore,
  useQueuedTorrents,
} from '@/store/downloadQueueStore'
import { DownloadQueueItem } from './DownloadQueueItem'
import { FileSelectionDialog } from './FileSelectionDialog'
import { useFileSelectionStore } from '@/store/fileSelectionStore'
import { toaster } from '@/components/ui/toaster'

export function DownloadQueue(): JSX.Element {
  const isLoading = useDownloadQueueStore((s) => s.isLoading)
  const torrents = useQueuedTorrents()
  const removeTorrent = useDownloadQueueStore((s) => s.removeTorrent)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // File selection dialog state
  const dialogState = useFileSelectionStore()

  // Listen for file selection needed events from backend
  useEffect(() => {
    const cleanup = window.api.webtorrent.onFileSelectionNeeded((data) => {
      // Only open dialog if not already open
      if (!dialogState.isOpen) {
        dialogState.openFileSelection(data.id, data.name, data.files)
      }
    })

    return cleanup
  }, [dialogState])

  // Handle file selection confirmation
  const handleFileSelectionConfirm = async (selectedFileIndices: number[]) => {
    if (!dialogState.torrentId) return

    setIsSubmitting(true)
    try {
      const response = await window.api.webtorrent.selectFiles({
        id: dialogState.torrentId,
        selectedFileIndices,
      })

      if (response.success) {
        toaster.create({
          title: 'Download started',
          description: `Downloading ${selectedFileIndices.length} file(s)`,
          type: 'success',
        })
        dialogState.closeFileSelection()
      } else {
        toaster.create({
          title: 'Failed to start download',
          description: response.error || 'Unknown error',
          type: 'error',
        })
      }
    } catch (error) {
      toaster.create({
        title: 'Failed to start download',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle file selection cancellation
  const handleFileSelectionCancel = async () => {
    if (!dialogState.torrentId) {
      // Close dialog even if no torrent ID
      dialogState.closeFileSelection()
      return
    }

    const torrentId = dialogState.torrentId

    try {
      // Remove the torrent from queue if user cancels (using store action to ensure state updates)
      await removeTorrent(torrentId)
      // Remove from tracking since torrent is removed
      shownDialogsRef.current.delete(torrentId)
      toaster.create({
        title: 'Download cancelled',
        type: 'info',
      })
    } catch (error) {
      console.error('Failed to cancel download:', error)
      toaster.create({
        title: 'Failed to cancel download',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      })
    } finally {
      // Always close the dialog, even if removal failed
      dialogState.closeFileSelection()
    }
  }

  const activeCount = torrents.filter(
    t => t.status === 'downloading' || t.status === 'queued'
  ).length

  return (
    <Box
      p={6}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
    >
      <HStack justify="space-between" mb={4}>
        <HStack gap={2}>
          <Icon as={FiActivity} boxSize={5} color="interactive.base" />
          <Heading size="md" color="text.primary">
            Download Queue
          </Heading>
          {activeCount > 0 && (
            <Text
              fontSize="xs"
              bg="green.500"
              color="white"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {activeCount} active
            </Text>
          )}
        </HStack>
      </HStack>

      {isLoading ? (
        <Box p={6} textAlign="center">
          <Text fontSize="sm" color="text.muted">
            Loading queue...
          </Text>
        </Box>
      ) : torrents.length === 0 ? (
        <Box p={6} textAlign="center">
          <Icon as={FiActivity} boxSize={10} color="text.muted" mb={3} />
          <Text fontSize="sm" color="text.muted">
            No active downloads
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Click &quot;Download&quot; on a collected torrent to start
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={3}>
          {torrents.map((torrent) => (
            <DownloadQueueItem key={torrent.id} torrent={torrent} />
          ))}
        </VStack>
      )}

      {/* File Selection Dialog */}
      <FileSelectionDialog
        isOpen={dialogState.isOpen}
        torrentName={dialogState.torrentName}
        files={dialogState.files}
        onConfirm={handleFileSelectionConfirm}
        onCancel={handleFileSelectionCancel}
        isLoading={isSubmitting}
      />
    </Box>
  )
}
