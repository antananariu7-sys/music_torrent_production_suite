import { Box, Heading, Text, VStack } from '@chakra-ui/react'
import { useState, useMemo } from 'react'
import type { TorrentContentFile } from '@shared/types/torrent.types'
import { buildSelectionFileTree, type SelectionTreeNode } from './utils/fileSelectionTree'
import { FileSelectionTree } from './components/FileSelectionTree'
import { FileSelectionControls } from './components/FileSelectionControls'

interface FileSelectionDialogProps {
  isOpen: boolean
  torrentName: string
  files: TorrentContentFile[]
  onConfirm: (selectedFileIndices: number[]) => void
  onCancel: () => void
  isLoading?: boolean
}

export function FileSelectionDialog({
  isOpen,
  torrentName,
  files,
  onConfirm,
  onCancel,
  isLoading = false,
}: FileSelectionDialogProps): JSX.Element | null {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(files.map((_, index) => index))
  )
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const fileTree = useMemo(() => buildSelectionFileTree(files), [files])

  const totalSelectedSize = useMemo(() => {
    return files.reduce((sum, file, index) => {
      return selectedIndices.has(index) ? sum + file.size : sum
    }, 0)
  }, [files, selectedIndices])

  const allSelected = selectedIndices.size === files.length
  const noneSelected = selectedIndices.size === 0

  const allExpanded = useMemo(() => {
    const allPaths = new Set<string>()
    function collectPaths(node: SelectionTreeNode) {
      if (node.isFolder && node.path) allPaths.add(node.path)
      node.children.forEach(collectPaths)
    }
    fileTree.children.forEach(collectPaths)
    return allPaths.size > 0 && allPaths.size === expandedFolders.size
  }, [fileTree, expandedFolders])

  // Early return after all hooks
  if (!isOpen) return null

  const toggleFile = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const toggleFolderSelection = (node: SelectionTreeNode) => {
    if (!node.isFolder) return
    const allChosen = node.fileIndices.every((idx) => selectedIndices.has(idx))
    setSelectedIndices((prev) => {
      const next = new Set(prev)
      if (allChosen) {
        node.fileIndices.forEach((idx) => next.delete(idx))
      } else {
        node.fileIndices.forEach((idx) => next.add(idx))
      }
      return next
    })
  }

  const expandAll = () => {
    const allPaths = new Set<string>()
    function collectPaths(node: SelectionTreeNode) {
      if (node.isFolder && node.path) allPaths.add(node.path)
      node.children.forEach(collectPaths)
    }
    fileTree.children.forEach(collectPaths)
    setExpandedFolders(allPaths)
  }

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIndices).sort((a, b) => a - b))
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      onClick={onCancel}
    >
      <Box
        width="full"
        maxW="3xl"
        maxH="90vh"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
        onClick={(e) => e.stopPropagation()}
        display="flex"
        flexDirection="column"
      >
        {/* Header */}
        <Box p={6} borderBottom="1px solid" borderColor="border.base">
          <Heading size="lg" color="text.primary" mb={2}>
            Select Files to Download
          </Heading>
          <Text color="text.muted" fontSize="sm">
            {torrentName}
          </Text>
        </Box>

        {/* File Tree */}
        <Box flex="1" overflowY="auto" px={4} py={3}>
          <VStack align="stretch" gap={0}>
            <FileSelectionTree
              root={fileTree}
              selectedIndices={selectedIndices}
              expandedFolders={expandedFolders}
              onToggleFile={toggleFile}
              onToggleFolder={toggleFolder}
              onToggleFolderSelection={toggleFolderSelection}
            />
          </VStack>
        </Box>

        {/* Footer Controls */}
        <FileSelectionControls
          totalFiles={files.length}
          selectedCount={selectedIndices.size}
          totalSelectedSize={totalSelectedSize}
          allSelected={allSelected}
          noneSelected={noneSelected}
          allExpanded={allExpanded}
          isLoading={isLoading}
          onSelectAll={() => setSelectedIndices(new Set(files.map((_, i) => i)))}
          onDeselectAll={() => setSelectedIndices(new Set())}
          onExpandAll={expandAll}
          onCollapseAll={() => setExpandedFolders(new Set())}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      </Box>
    </Box>
  )
}
