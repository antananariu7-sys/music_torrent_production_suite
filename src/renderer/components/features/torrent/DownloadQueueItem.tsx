import { Box, HStack, VStack, Text, IconButton, Icon, Badge, Flex } from '@chakra-ui/react'
import { FiPause, FiPlay, FiX, FiFolder, FiChevronDown, FiChevronRight, FiFile, FiMusic } from 'react-icons/fi'
import { useState, useMemo } from 'react'
import { useDownloadQueueStore } from '@/store/downloadQueueStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { isAudioFile, getFileName } from '@/utils/audioUtils'
import type { QueuedTorrent, TorrentContentFile } from '@shared/types/torrent.types'

interface DownloadQueueItemProps {
  torrent: QueuedTorrent
}

interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  files: TorrentContentFile[] // Files in this folder (for progress calculation)
  size: number
  downloaded: number
  progress: number
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'gray',
  downloading: 'blue',
  seeding: 'green',
  paused: 'yellow',
  completed: 'green',
  error: 'red',
  'awaiting-file-selection': 'purple',
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let speed = bytesPerSec
  let i = 0
  while (speed >= 1024 && i < units.length - 1) {
    speed /= 1024
    i++
  }
  return `${speed.toFixed(1)} ${units[i]}`
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

function buildFileTree(files: TorrentContentFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: [],
    files: [],
    size: 0,
    downloaded: 0,
    progress: 0,
  }

  files.forEach((file) => {
    const parts = file.path.split(/[\\/]/).filter(Boolean)
    let currentNode = root

    // Navigate/create folder structure
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i]
      let folderNode = currentNode.children.find(
        (child) => child.isFolder && child.name === folderName
      )

      if (!folderNode) {
        folderNode = {
          name: folderName,
          path: parts.slice(0, i + 1).join('/'),
          isFolder: true,
          children: [],
          files: [],
          size: 0,
          downloaded: 0,
          progress: 0,
        }
        currentNode.children.push(folderNode)
      }

      currentNode = folderNode
    }

    // Add file to current folder
    const fileName = parts[parts.length - 1]
    currentNode.children.push({
      name: fileName,
      path: file.path,
      isFolder: false,
      children: [],
      files: [file],
      size: file.size,
      downloaded: file.downloaded,
      progress: file.progress,
    })
  })

  // Calculate folder sizes and progress recursively
  function calculateFolderData(node: TreeNode): void {
    if (!node.isFolder) return

    node.files = []
    node.size = 0
    node.downloaded = 0

    for (const child of node.children) {
      calculateFolderData(child)
      node.files.push(...child.files)
      node.size += child.size
      node.downloaded += child.downloaded
    }

    node.progress = node.size > 0 ? Math.round((node.downloaded / node.size) * 100) : 0
  }

  calculateFolderData(root)

  // Sort children: folders first, then files, both alphabetically
  function sortChildren(node: TreeNode): void {
    node.children.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortChildren)
  }

  sortChildren(root)

  return root
}

export function DownloadQueueItem({ torrent }: DownloadQueueItemProps): JSX.Element {
  const pauseTorrent = useDownloadQueueStore((s) => s.pauseTorrent)
  const resumeTorrent = useDownloadQueueStore((s) => s.resumeTorrent)
  const removeTorrent = useDownloadQueueStore((s) => s.removeTorrent)
  const playTrack = useAudioPlayerStore((s) => s.playTrack)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const canPause = torrent.status === 'downloading' || torrent.status === 'seeding'
  const canResume = torrent.status === 'paused' || torrent.status === 'error'
  const showProgress = torrent.status === 'downloading' || torrent.status === 'seeding' || torrent.status === 'paused'

  // Filter to show only selected files (the ones being downloaded)
  const selectedFiles = torrent.files.filter(f => f.selected)
  const hasMultipleFiles = selectedFiles.length > 1

  // Build file tree from selected files
  const fileTree = useMemo(() => buildFileTree(selectedFiles), [selectedFiles])

  // Get all audio files for playlist
  const audioFiles = useMemo(() => {
    return selectedFiles
      .filter(f => f.progress === 100 && isAudioFile(f.path))
      .map(f => ({
        filePath: `${torrent.downloadPath}/${f.path}`.replace(/\\/g, '/'),
        name: getFileName(f.path),
      }))
  }, [selectedFiles, torrent.downloadPath])

  const handleOpenFolder = async () => {
    if (torrent.downloadPath) {
      await window.api.openPath(torrent.downloadPath)
    }
  }

  const toggleExpanded = () => {
    if (hasMultipleFiles) {
      setIsExpanded(!isExpanded)
    }
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const handlePlayFile = (file: TorrentContentFile) => {
    if (!torrent.downloadPath || file.progress < 100) return

    // Find the index of this file in the audio files list
    const fileIndex = audioFiles.findIndex(
      (af) => af.filePath === `${torrent.downloadPath}/${file.path}`.replace(/\\/g, '/')
    )

    // If found, play the entire playlist starting from this file
    if (fileIndex >= 0 && audioFiles.length > 0) {
      playPlaylist(audioFiles, fileIndex)
    } else {
      // Fallback: play just this file
      const filePath = `${torrent.downloadPath}/${file.path}`.replace(/\\/g, '/')
      playTrack({
        filePath,
        name: getFileName(file.path),
      })
    }
  }

  const handlePlayAll = () => {
    if (audioFiles.length === 0) return
    playPlaylist(audioFiles, 0)
  }

  // Render a tree node (file or folder)
  const renderTreeNode = (node: TreeNode, depth: number): JSX.Element[] => {
    if (!node.isFolder && node.files.length === 0) return []

    const isExpanded = expandedFolders.has(node.path)
    const items: JSX.Element[] = []

    // Render current node
    if (node.path || !node.isFolder) {
      items.push(
        <Flex
          key={node.path}
          pl={depth * 4 + 2}
          pr={2}
          py={0}
          cursor={node.isFolder ? 'pointer' : 'default'}
          _hover={node.isFolder ? { bg: 'bg.muted' } : undefined}
          align="center"
          gap={2}
          fontSize="xs"
          onClick={node.isFolder ? () => toggleFolder(node.path) : undefined}
        >
          {node.isFolder ? (
            <>
              <Icon
                as={isExpanded ? FiChevronDown : FiChevronRight}
                boxSize={3}
                color="text.muted"
                flexShrink={0}
              />
              <Icon as={FiFolder} boxSize={3} color="blue.400" flexShrink={0} />
              <Text flex="1" color="text.primary" lineClamp={1}>
                {node.name}
              </Text>
              <Text color="text.muted" flexShrink={0}>
                {formatSize(node.downloaded)} / {formatSize(node.size)}
              </Text>
              <Text
                color={node.progress === 100 ? 'green.500' : 'blue.500'}
                fontWeight="medium"
                w="35px"
                textAlign="right"
                flexShrink={0}
              >
                {node.progress}%
              </Text>
              {/* Mini progress bar for folder */}
              <Box w="50px" flexShrink={0}>
                <div
                  style={{
                    height: 3,
                    background: 'var(--chakra-colors-bg-muted, #2d2d44)',
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${node.progress}%`,
                      background: node.progress === 100
                        ? 'var(--chakra-colors-green-500, #48bb78)'
                        : 'var(--chakra-colors-blue-500, #3b82f6)',
                      borderRadius: 9999,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </Box>
            </>
          ) : (
            <>
              <Box w="3" flexShrink={0} /> {/* Spacer for chevron */}
              <Icon
                as={isAudioFile(node.path) ? FiMusic : FiFile}
                boxSize={3}
                color={isAudioFile(node.path) ? 'blue.400' : 'text.muted'}
                flexShrink={0}
              />
              <Text flex="1" color="text.primary" lineClamp={1} title={node.path}>
                {node.name}
              </Text>
              <Text color="text.muted" flexShrink={0}>
                {formatSize(node.downloaded)} / {formatSize(node.size)}
              </Text>
              <Text
                color={node.progress === 100 ? 'green.500' : 'blue.500'}
                fontWeight="medium"
                w="35px"
                textAlign="right"
                flexShrink={0}
              >
                {node.progress}%
              </Text>
              {/* Mini progress bar for file */}
              <Box w="50px" flexShrink={0}>
                <div
                  style={{
                    height: 3,
                    background: 'var(--chakra-colors-bg-muted, #2d2d44)',
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${node.progress}%`,
                      background: node.progress === 100
                        ? 'var(--chakra-colors-green-500, #48bb78)'
                        : 'var(--chakra-colors-blue-500, #3b82f6)',
                      borderRadius: 9999,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </Box>
              {/* Play button for completed audio files */}
              {node.progress === 100 && isAudioFile(node.path) && node.files[0] && (
                <IconButton
                  aria-label="Play"
                  size="xs"
                  variant="ghost"
                  colorPalette="blue"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePlayFile(node.files[0])
                  }}
                  title="Play"
                  flexShrink={0}
                >
                  <Icon as={FiPlay} boxSize={3} />
                </IconButton>
              )}
            </>
          )}
        </Flex>
      )
    }

    // Render children if folder is expanded
    if (node.isFolder && (isExpanded || !node.path)) {
      node.children.forEach((child) => {
        items.push(...renderTreeNode(child, node.path ? depth + 1 : depth))
      })
    }

    return items
  }

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
            {/* Expand/collapse button for multi-file torrents */}
            {hasMultipleFiles && (
              <IconButton
                aria-label={isExpanded ? 'Collapse files' : 'Expand files'}
                size="xs"
                variant="ghost"
                onClick={toggleExpanded}
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
                {torrent.status}
              </Badge>
              {torrent.totalSize > 0 && (
                <Text fontSize="xs" color="text.muted">
                  {formatSize(torrent.downloaded)} / {formatSize(torrent.totalSize)}
                </Text>
              )}
              {torrent.status === 'downloading' && (
                <>
                  <Text fontSize="xs" color="green.500">
                    ↓ {formatSpeed(torrent.downloadSpeed)}
                  </Text>
                  <Text fontSize="xs" color="blue.500">
                    ↑ {formatSpeed(torrent.uploadSpeed)}
                  </Text>
                </>
              )}
              {torrent.status === 'seeding' && (
                <Text fontSize="xs" color="green.500">
                  ↑ {formatSpeed(torrent.uploadSpeed)}
                </Text>
              )}
              {torrent.seeders > 0 && (
                <Text fontSize="xs" color="text.muted">
                  {torrent.seeders} peers
                </Text>
              )}
            </HStack>
            </VStack>
          </HStack>

          <HStack gap={1} flexShrink={0}>
            <IconButton
              aria-label="Open folder"
              size="sm"
              variant="ghost"
              onClick={handleOpenFolder}
              title="Open download folder"
              disabled={!torrent.downloadPath}
            >
              <Icon as={FiFolder} boxSize={4} />
            </IconButton>
            {audioFiles.length > 0 && (
              <IconButton
                aria-label="Play all"
                size="sm"
                variant="ghost"
                colorPalette="blue"
                onClick={handlePlayAll}
                title={`Play all (${audioFiles.length} audio files)`}
              >
                <Icon as={FiMusic} boxSize={4} />
              </IconButton>
            )}
            {canPause && (
              <IconButton
                aria-label="Pause"
                size="sm"
                variant="ghost"
                onClick={() => pauseTorrent(torrent.id)}
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
                onClick={() => resumeTorrent(torrent.id)}
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
              onClick={() => removeTorrent(torrent.id)}
              title="Remove from queue"
            >
              <Icon as={FiX} boxSize={4} />
            </IconButton>
          </HStack>
        </HStack>

        {/* Progress bar */}
        {showProgress && (
          <Box>
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
                  width: `${torrent.progress}%`,
                  background: torrent.status === 'paused'
                    ? 'var(--chakra-colors-yellow-500, #ecc94b)'
                    : 'var(--chakra-colors-blue-500, #3b82f6)',
                  borderRadius: 9999,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <Text fontSize="xs" color="text.muted" mt={1}>
              {torrent.progress}%
              {torrent.status === 'downloading' && torrent.downloadSpeed > 0 && torrent.totalSize > 0 && (
                <> — ETA {formatEta(torrent.totalSize - torrent.downloaded, torrent.downloadSpeed)}</>
              )}
            </Text>
          </Box>
        )}

        {/* File list (expanded view with folder structure) */}
        {isExpanded && hasMultipleFiles && (
          <Box
            mt={2}
            p={3}
            borderRadius="md"
            bg="bg.surface"
            borderWidth="1px"
            borderColor="border.base"
          >
            <Text fontSize="xs" fontWeight="semibold" color="text.secondary" mb={2}>
              Files ({selectedFiles.length})
            </Text>
            <VStack align="stretch" gap={0}>
              {renderTreeNode(fileTree, 0)}
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
          <Text fontSize="xs" color="red.500">
            {torrent.error}
          </Text>
        )}
      </VStack>
    </Box>
  )
}

function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '∞'
  const seconds = Math.round(remainingBytes / speedBps)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}
