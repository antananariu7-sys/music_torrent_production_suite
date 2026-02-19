import { Box, Flex, Text, Icon, IconButton } from '@chakra-ui/react'
import { FiChevronDown, FiChevronRight, FiFolder, FiFile, FiMusic, FiPlay, FiDownload, FiPlus, FiCheck } from 'react-icons/fi'
import { isAudioFile } from '@/utils/audioUtils'
import type { TorrentContentFile } from '@shared/types/torrent.types'
import type { TreeNode } from '../utils/fileTreeBuilder'
import { formatSize } from '../utils/formatters'

interface FileTreeNodeProps {
  node: TreeNode
  depth: number
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  currentTrackFilePath: string | undefined
  isPlaying: boolean
  downloadPath: string
  onPlayFile: (file: TorrentContentFile) => void
  onDownloadFile: (file: TorrentContentFile) => void
  onAddToMix?: (file: TorrentContentFile) => void
  mixedFileNames?: Set<string>
}

/** Mini progress bar used for both files and folders in the tree. */
function MiniProgressBar({ progress }: { progress: number }): JSX.Element {
  return (
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
            width: `${progress}%`,
            background: progress === 100
              ? 'var(--chakra-colors-green-500, #48bb78)'
              : 'var(--chakra-colors-blue-500, #3b82f6)',
            borderRadius: 9999,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </Box>
  )
}

export function FileTreeNode({
  node,
  depth,
  expandedFolders,
  toggleFolder,
  currentTrackFilePath,
  isPlaying,
  downloadPath,
  onPlayFile,
  onDownloadFile,
  onAddToMix,
  mixedFileNames,
}: FileTreeNodeProps): JSX.Element {
  if (!node.isFolder && node.files.length === 0) return <></>

  const isFolderExpanded = expandedFolders.has(node.path)

  // Check if this file is currently playing
  const isCurrentlyPlaying = !node.isFolder &&
    currentTrackFilePath !== undefined &&
    node.files[0] &&
    currentTrackFilePath === `${downloadPath}/${node.files[0].path}`.replace(/\\/g, '/')

  const isPlayableAudio = !node.isFolder && node.progress === 100 && isAudioFile(node.path)
  const isInMix = !node.isFolder && (mixedFileNames?.has(node.name.toLowerCase()) ?? false)

  return (
    <>
      {/* Render current node (skip root folder) */}
      {(node.path || !node.isFolder) && (
        <Flex
          key={node.path}
          pl={depth * 4 + 2}
          pr={2}
          py={0}
          cursor={node.isFolder ? 'pointer' : isPlayableAudio ? 'pointer' : 'default'}
          _hover={node.isFolder || isPlayableAudio ? { bg: isInMix ? 'green.500/15' : 'bg.muted' } : undefined}
          align="center"
          gap={2}
          fontSize="xs"
          bg={isCurrentlyPlaying ? 'blue.500/10' : isInMix ? 'green.500/8' : undefined}
          borderLeft={isCurrentlyPlaying ? '2px solid' : isInMix ? '2px solid' : undefined}
          borderColor={isCurrentlyPlaying ? 'blue.500' : isInMix ? 'green.500' : undefined}
          onClick={node.isFolder ? () => toggleFolder(node.path) : (isPlayableAudio && node.files[0]) ? () => onPlayFile(node.files[0]) : undefined}
        >
          {node.isFolder ? (
            <FolderRow node={node} isExpanded={isFolderExpanded} />
          ) : (
            <FileRow
              node={node}
              isCurrentlyPlaying={!!isCurrentlyPlaying}
              isPlaying={isPlaying}
              onPlayFile={onPlayFile}
              onDownloadFile={onDownloadFile}
              onAddToMix={onAddToMix}
              isInMix={isInMix}
            />
          )}
        </Flex>
      )}

      {/* Render children if folder is expanded (or root) */}
      {node.isFolder && (isFolderExpanded || !node.path) && node.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={node.path ? depth + 1 : depth}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
          currentTrackFilePath={currentTrackFilePath}
          isPlaying={isPlaying}
          downloadPath={downloadPath}
          onPlayFile={onPlayFile}
          onDownloadFile={onDownloadFile}
          onAddToMix={onAddToMix}
          mixedFileNames={mixedFileNames}
        />
      ))}
    </>
  )
}

function FolderRow({ node, isExpanded }: { node: TreeNode; isExpanded: boolean }): JSX.Element {
  return (
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
      <MiniProgressBar progress={node.progress} />
    </>
  )
}

function FileRow({
  node,
  isCurrentlyPlaying,
  isPlaying,
  onPlayFile,
  onDownloadFile,
  onAddToMix,
  isInMix,
}: {
  node: TreeNode
  isCurrentlyPlaying: boolean
  isPlaying: boolean
  onPlayFile: (file: TorrentContentFile) => void
  onDownloadFile: (file: TorrentContentFile) => void
  onAddToMix?: (file: TorrentContentFile) => void
  isInMix: boolean
}): JSX.Element {
  return (
    <>
      {/* Show play icon if currently playing, otherwise spacer */}
      {isCurrentlyPlaying && isPlaying ? (
        <Icon as={FiPlay} boxSize={3} color="blue.500" flexShrink={0} />
      ) : (
        <Box w="3" flexShrink={0} />
      )}
      <Icon
        as={isAudioFile(node.path) ? FiMusic : FiFile}
        boxSize={3}
        color={!node.selected ? 'text.muted' : isCurrentlyPlaying ? 'blue.500' : isInMix ? 'green.400' : isAudioFile(node.path) ? 'blue.400' : 'text.muted'}
        flexShrink={0}
        opacity={node.selected ? 1 : 0.4}
      />
      <Text
        flex="1"
        color={!node.selected ? 'text.muted' : isCurrentlyPlaying ? 'blue.500' : isInMix ? 'green.300' : 'text.primary'}
        fontWeight={isCurrentlyPlaying ? 'semibold' : isInMix ? 'medium' : 'normal'}
        lineClamp={1}
        title={node.path}
        opacity={node.selected ? 1 : 0.4}
        textDecoration={node.selected ? undefined : 'line-through'}
      >
        {node.name}
      </Text>
      {node.selected ? (
        <>
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
          <MiniProgressBar progress={node.progress} />
        </>
      ) : (
        <>
          <Text fontSize="2xs" color="text.muted" opacity={0.5} flexShrink={0}>
            {formatSize(node.size)}
          </Text>
          <IconButton
            aria-label="Download this file"
            size="xs"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              if (node.files[0]) onDownloadFile(node.files[0])
            }}
            title="Download this file"
            flexShrink={0}
          >
            <Icon as={FiDownload} boxSize={3} />
          </IconButton>
        </>
      )}
      {/* Play + Add-to-Mix buttons for completed audio files */}
      {node.selected && node.progress === 100 && isAudioFile(node.path) && node.files[0] && (
        <>
          <IconButton
            aria-label="Play"
            size="xs"
            variant="ghost"
            colorPalette="blue"
            onClick={(e) => {
              e.stopPropagation()
              onPlayFile(node.files[0])
            }}
            title="Play"
            flexShrink={0}
          >
            <Icon as={FiPlay} boxSize={3} />
          </IconButton>
          {onAddToMix && (
            isInMix ? (
              <IconButton
                aria-label="In Mix"
                size="xs"
                variant="ghost"
                colorPalette="green"
                disabled
                title="Already in Mix"
                flexShrink={0}
              >
                <Icon as={FiCheck} boxSize={3} />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Add to Mix"
                size="xs"
                variant="ghost"
                colorPalette="green"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddToMix(node.files[0])
                }}
                title="Add to Mix"
                flexShrink={0}
              >
                <Icon as={FiPlus} boxSize={3} />
              </IconButton>
            )
          )}
        </>
      )}
    </>
  )
}
