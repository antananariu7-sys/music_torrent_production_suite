import { Box, HStack, VStack, Text, IconButton, Icon, Badge } from '@chakra-ui/react'
import { FiChevronDown, FiChevronRight } from 'react-icons/fi'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useDownloadQueueStore } from '@/store/downloadQueueStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { toaster } from '@/components/ui/toaster'
import { isAudioFile, getFileName } from '@/utils/audioUtils'
import type { QueuedTorrent, TorrentContentFile } from '@shared/types/torrent.types'

import { formatSpeed, formatSize, STATUS_COLOR } from './utils/formatters'
import { buildFileTree } from './utils/fileTreeBuilder'
import { FileTreeNode } from './components/FileTreeNode'
import { TorrentControls } from './components/TorrentControls'
import { TorrentProgressBar } from './components/TorrentProgressBar'
import { RemoveDialog } from './components/RemoveDialog'

interface DownloadQueueItemProps {
  torrent: QueuedTorrent
}

export function DownloadQueueItem({ torrent }: DownloadQueueItemProps): JSX.Element {
  const pauseTorrent = useDownloadQueueStore((s) => s.pauseTorrent)
  const resumeTorrent = useDownloadQueueStore((s) => s.resumeTorrent)
  const removeTorrent = useDownloadQueueStore((s) => s.removeTorrent)
  const playTrack = useAudioPlayerStore((s) => s.playTrack)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const clearPlaylist = useAudioPlayerStore((s) => s.clearPlaylist)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  const canPause = torrent.status === 'downloading' || torrent.status === 'seeding'
  const canResume = torrent.status === 'paused' || torrent.status === 'error'
  const showProgress = torrent.status === 'downloading' || torrent.status === 'seeding' || torrent.status === 'paused'
  const hasMultipleFiles = torrent.files.length > 1
  const isPartialComplete = torrent.status === 'completed' && torrent.files.some(f => !f.selected)

  // Auto-expand folder when current track changes
  useEffect(() => {
    if (!currentTrack || !torrent.downloadPath) return

    const currentTrackInThisTorrent = torrent.files.find(
      file => file.selected && currentTrack.filePath === `${torrent.downloadPath}/${file.path}`.replace(/\\/g, '/')
    )

    if (currentTrackInThisTorrent) {
      const parts = currentTrackInThisTorrent.path.split(/[\\/]/).filter(Boolean)
      const folderPaths: string[] = []
      for (let i = 0; i < parts.length - 1; i++) {
        folderPaths.push(parts.slice(0, i + 1).join('/'))
      }
      if (folderPaths.length > 0) {
        setExpandedFolders(prev => {
          const newSet = new Set(prev)
          folderPaths.forEach(path => newSet.add(path))
          return newSet
        })
        setIsExpanded(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.filePath, torrent.downloadPath])

  const fileTree = useMemo(() => buildFileTree(torrent.files), [torrent.files])

  const audioFiles = useMemo(() => {
    return torrent.files
      .filter(f => f.selected && f.progress === 100 && isAudioFile(f.path))
      .map(f => ({
        filePath: `${torrent.downloadPath}/${f.path}`.replace(/\\/g, '/'),
        name: getFileName(f.path),
      }))
  }, [torrent.files, torrent.downloadPath])

  const downloadedFiles = useMemo(
    () => torrent.files.filter(f => f.downloaded > 0),
    [torrent.files],
  )

  const downloadedSize = useMemo(
    () => downloadedFiles.reduce((sum, f) => sum + f.downloaded, 0),
    [downloadedFiles],
  )

  const handleOpenFolder = useCallback(async () => {
    if (!torrent.downloadPath) return
    const firstFile = torrent.files[0]
    if (firstFile) {
      const firstSeg = firstFile.path.split(/[\\/]/)[0]
      if (firstSeg) {
        await window.api.openPath(torrent.downloadPath + '/' + firstSeg)
        return
      }
    }
    await window.api.openPath(torrent.downloadPath)
  }, [torrent.downloadPath, torrent.files])

  const stopPlayerIfNeeded = useCallback(() => {
    if (!currentTrack || !torrent.downloadPath) return
    const normalizedTrack = currentTrack.filePath.replace(/\\/g, '/')
    const normalizedBase = torrent.downloadPath.replace(/\\/g, '/')
    if (normalizedTrack.startsWith(normalizedBase + '/') || normalizedTrack.startsWith(normalizedBase + '\\')) {
      clearPlaylist()
    }
  }, [currentTrack, torrent.downloadPath, clearPlaylist])

  const handleRemoveKeepFiles = useCallback(async () => {
    setShowRemoveDialog(false)
    stopPlayerIfNeeded()
    await removeTorrent(torrent.id)
    toaster.create({ title: 'Torrent removed', description: 'Files kept on disk', type: 'info' })
  }, [removeTorrent, torrent.id, stopPlayerIfNeeded])

  const handleRemoveDeleteFiles = useCallback(async () => {
    setShowRemoveDialog(false)
    stopPlayerIfNeeded()
    await removeTorrent(torrent.id, true)
    toaster.create({ title: 'Torrent removed', description: 'Files deleted from disk', type: 'success' })
  }, [removeTorrent, torrent.id, stopPlayerIfNeeded])

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  const handlePlayFile = useCallback((file: TorrentContentFile) => {
    if (!torrent.downloadPath || file.progress < 100) return
    const fileIndex = audioFiles.findIndex(
      (af) => af.filePath === `${torrent.downloadPath}/${file.path}`.replace(/\\/g, '/')
    )
    if (fileIndex >= 0 && audioFiles.length > 0) {
      playPlaylist(audioFiles, fileIndex)
    } else {
      const filePath = `${torrent.downloadPath}/${file.path}`.replace(/\\/g, '/')
      playTrack({ filePath, name: getFileName(file.path) })
    }
  }, [torrent.downloadPath, audioFiles, playPlaylist, playTrack])

  const handleDownloadFile = useCallback(async (file: TorrentContentFile) => {
    const fileIndex = torrent.files.findIndex(f => f.path === file.path)
    if (fileIndex === -1) return
    try {
      await window.api.webtorrent.downloadMoreFiles(torrent.id, [fileIndex])
    } catch (err) {
      console.error('Failed to download file:', err)
    }
  }, [torrent.files, torrent.id])

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor={torrent.status === 'error' ? 'red.500/50' : 'border.base'}
      transition="all 0.2s"
      _hover={{ borderColor: 'border.focus' }}
    >
      <VStack align="stretch" gap={2}>
        {/* Top row: name + status + actions */}
        <HStack justify="space-between" gap={4}>
          <HStack gap={2} flex="1" minW={0}>
            {hasMultipleFiles && (
              <IconButton
                aria-label={isExpanded ? 'Collapse files' : 'Expand files'}
                size="xs"
                variant="ghost"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Hide file list' : 'Show file list'}
              >
                <Icon as={isExpanded ? FiChevronDown : FiChevronRight} boxSize={4} />
              </IconButton>
            )}
            <VStack align="start" gap={1} flex="1" minW={0}>
              <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
                {torrent.name}
              </Text>
              <HStack gap={3} flexWrap="wrap">
                <Badge colorPalette={STATUS_COLOR[torrent.status]} variant="subtle" size="sm">
                  {isPartialComplete ? 'completed (partial)' : torrent.status}
                </Badge>
                {torrent.totalSize > 0 && (
                  <Text fontSize="xs" color="text.muted">
                    {formatSize(torrent.downloaded)} / {formatSize(torrent.totalSize)}
                  </Text>
                )}
                {torrent.status === 'downloading' && (
                  <>
                    <Text fontSize="xs" color="green.500">↓ {formatSpeed(torrent.downloadSpeed)}</Text>
                    <Text fontSize="xs" color="blue.500">↑ {formatSpeed(torrent.uploadSpeed)}</Text>
                  </>
                )}
                {torrent.status === 'seeding' && (
                  <Text fontSize="xs" color="green.500">↑ {formatSpeed(torrent.uploadSpeed)}</Text>
                )}
                {torrent.seeders > 0 && (
                  <Text fontSize="xs" color="text.muted">{torrent.seeders} peers</Text>
                )}
              </HStack>
            </VStack>
          </HStack>

          <TorrentControls
            canPause={canPause}
            canResume={canResume}
            hasAudioFiles={audioFiles.length > 0}
            audioFileCount={audioFiles.length}
            hasDownloadPath={!!torrent.downloadPath}
            onPause={() => pauseTorrent(torrent.id)}
            onResume={() => resumeTorrent(torrent.id)}
            onRemove={() => setShowRemoveDialog(true)}
            onOpenFolder={handleOpenFolder}
            onPlayAll={() => audioFiles.length > 0 && playPlaylist(audioFiles, 0)}
          />
        </HStack>

        {/* Progress bar */}
        {showProgress && (
          <TorrentProgressBar
            progress={torrent.progress}
            status={torrent.status}
            downloadSpeed={torrent.downloadSpeed}
            downloaded={torrent.downloaded}
            totalSize={torrent.totalSize}
          />
        )}

        {/* File list (expanded view with folder structure) */}
        {isExpanded && hasMultipleFiles && (
          <Box mt={2} p={3} borderRadius="md" bg="bg.surface" borderWidth="1px" borderColor="border.base">
            <Text fontSize="xs" fontWeight="semibold" color="text.secondary" mb={2}>
              Files ({torrent.files.length})
            </Text>
            <VStack align="stretch" gap={0}>
              <FileTreeNode
                node={fileTree}
                depth={0}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                currentTrackFilePath={currentTrack?.filePath}
                isPlaying={isPlaying}
                downloadPath={torrent.downloadPath}
                onPlayFile={handlePlayFile}
                onDownloadFile={handleDownloadFile}
              />
            </VStack>
          </Box>
        )}

        {/* Completed indicator */}
        {torrent.status === 'completed' && (
          <Text fontSize="xs" color="green.500">
            Download complete — {formatSize(torrent.totalSize)}
          </Text>
        )}

        {/* Error message */}
        {torrent.error && (
          <Text fontSize="xs" color="red.500">{torrent.error}</Text>
        )}
      </VStack>

      {/* Remove confirmation dialog */}
      {showRemoveDialog && (
        <RemoveDialog
          torrentName={torrent.name}
          downloadPath={torrent.downloadPath}
          downloadedFiles={downloadedFiles}
          downloadedSize={downloadedSize}
          onCancel={() => setShowRemoveDialog(false)}
          onKeepFiles={handleRemoveKeepFiles}
          onDeleteFiles={handleRemoveDeleteFiles}
        />
      )}
    </Box>
  )
}
