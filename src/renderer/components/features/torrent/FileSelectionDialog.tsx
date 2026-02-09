import { Box, Button, Heading, Text, VStack, HStack, Flex, Icon } from '@chakra-ui/react'
import { useState, useMemo } from 'react'
import { FiFile, FiCheckSquare, FiSquare, FiFolder, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import type { TorrentContentFile } from '@shared/types/torrent.types'
import { Checkbox } from '@/components/ui/checkbox'

interface FileSelectionDialogProps {
  isOpen: boolean
  torrentName: string
  files: TorrentContentFile[]
  onConfirm: (selectedFileIndices: number[]) => void
  onCancel: () => void
  isLoading?: boolean
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Tree node for file/folder structure
 */
interface TreeNode {
  name: string
  path: string
  isFolder: boolean
  children: TreeNode[]
  fileIndices: number[] // indices of files in this folder (recursively)
  size: number // total size (for folders: sum of children)
}

/**
 * Build folder tree from flat file list
 */
function buildFileTree(files: TorrentContentFile[]): TreeNode {
  const root: TreeNode = {
    name: '',
    path: '',
    isFolder: true,
    children: [],
    fileIndices: [],
    size: 0,
  }

  files.forEach((file, index) => {
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
          fileIndices: [],
          size: 0,
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
      fileIndices: [index],
      size: file.size,
    })
  })

  // Calculate folder sizes and file indices recursively
  function calculateFolderData(node: TreeNode): void {
    if (!node.isFolder) return

    node.fileIndices = []
    node.size = 0

    for (const child of node.children) {
      calculateFolderData(child)
      node.fileIndices.push(...child.fileIndices)
      node.size += child.size
    }
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

export function FileSelectionDialog({
  isOpen,
  torrentName,
  files,
  onConfirm,
  onCancel,
  isLoading = false,
}: FileSelectionDialogProps): JSX.Element | null {
  // Track selected file indices (all selected by default)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(files.map((_, index) => index))
  )

  // Track expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Build file tree
  const fileTree = useMemo(() => buildFileTree(files), [files])

  // Calculate total selected size
  const totalSelectedSize = useMemo(() => {
    return files.reduce((sum, file, index) => {
      return selectedIndices.has(index) ? sum + file.size : sum
    }, 0)
  }, [files, selectedIndices])

  const allSelected = selectedIndices.size === files.length
  const noneSelected = selectedIndices.size === 0

  // Check if all folders are expanded
  const allExpanded = useMemo(() => {
    const allPaths = new Set<string>()
    function collectPaths(node: TreeNode) {
      if (node.isFolder && node.path) {
        allPaths.add(node.path)
      }
      node.children.forEach(collectPaths)
    }
    fileTree.children.forEach(collectPaths)
    return allPaths.size > 0 && allPaths.size === expandedFolders.size
  }, [fileTree, expandedFolders])

  // Early return after all hooks are called
  if (!isOpen) return null

  const toggleFile = (index: number) => {
    setSelectedIndices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
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

  const toggleFolderSelection = (node: TreeNode) => {
    if (!node.isFolder) return

    // Check if all files in this folder are selected
    const allSelected = node.fileIndices.every((idx) => selectedIndices.has(idx))

    setSelectedIndices((prev) => {
      const newSet = new Set(prev)
      if (allSelected) {
        // Deselect all files in folder
        node.fileIndices.forEach((idx) => newSet.delete(idx))
      } else {
        // Select all files in folder
        node.fileIndices.forEach((idx) => newSet.add(idx))
      }
      return newSet
    })
  }

  const selectAll = () => {
    setSelectedIndices(new Set(files.map((_, index) => index)))
  }

  const deselectAll = () => {
    setSelectedIndices(new Set())
  }

  const expandAll = () => {
    const allPaths = new Set<string>()
    function collectPaths(node: TreeNode) {
      if (node.isFolder && node.path) {
        allPaths.add(node.path)
      }
      node.children.forEach(collectPaths)
    }
    fileTree.children.forEach(collectPaths)
    setExpandedFolders(allPaths)
  }

  const collapseAll = () => {
    setExpandedFolders(new Set())
  }

  const handleConfirm = () => {
    const selectedArray = Array.from(selectedIndices).sort((a, b) => a - b)
    onConfirm(selectedArray)
  }

  // Render a tree node (file or folder)
  const renderTreeNode = (node: TreeNode, depth: number = 0): JSX.Element[] => {
    if (!node.isFolder && node.fileIndices.length === 0) return []

    const isExpanded = expandedFolders.has(node.path)
    const isSelected = node.fileIndices.every((idx) => selectedIndices.has(idx))
    const isPartiallySelected =
      !isSelected && node.fileIndices.some((idx) => selectedIndices.has(idx))

    const items: JSX.Element[] = []

    // Render current node
    if (node.path || !node.isFolder) {
      items.push(
        <Flex
          key={node.path}
          pl={depth * 6 + 2}
          pr={2}
          py={1}
          cursor="pointer"
          _hover={{ bg: 'bg.muted' }}
          align="center"
          gap={2}
          fontSize="sm"
        >
          {node.isFolder ? (
            <>
              <Icon
                as={isExpanded ? FiChevronDown : FiChevronRight}
                fontSize="sm"
                color="text.muted"
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(node.path)
                }}
              />
              <Box
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolderSelection(node)
                }}
              >
                <Checkbox
                  checked={isSelected}
                  css={{
                    opacity: isPartiallySelected ? 0.5 : 1,
                  }}
                />
              </Box>
              <Icon as={FiFolder} fontSize="md" color="blue.400" />
              <Text
                flex="1"
                color="text.primary"
                onClick={() => toggleFolder(node.path)}
              >
                {node.name}
              </Text>
              <Text fontSize="xs" color="text.muted">
                {formatBytes(node.size)}
              </Text>
            </>
          ) : (
            <>
              <Box w="14px" /> {/* Spacer for chevron */}
              <Box
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFile(node.fileIndices[0])
                }}
              >
                <Checkbox checked={selectedIndices.has(node.fileIndices[0])} />
              </Box>
              <Icon as={FiFile} fontSize="sm" color="text.muted" />
              <Text
                flex="1"
                color="text.primary"
                onClick={() => toggleFile(node.fileIndices[0])}
              >
                {node.name}
              </Text>
              <Text fontSize="xs" color="text.muted">
                {formatBytes(node.size)}
              </Text>
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
            {renderTreeNode(fileTree)}
          </VStack>
        </Box>

        {/* Footer */}
        <Box p={6} pt={4} borderTop="1px solid" borderColor="border.base">
          <Flex justify="space-between" align="center" mb={4}>
            <HStack gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={allSelected ? deselectAll : selectAll}
                disabled={isLoading}
              >
                <Icon as={allSelected ? FiSquare : FiCheckSquare} mr={2} />
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <Box w="1px" h="20px" bg="border.base" />
              <Button
                size="sm"
                variant="ghost"
                onClick={allExpanded ? collapseAll : expandAll}
                disabled={isLoading}
              >
                <Icon as={allExpanded ? FiChevronRight : FiChevronDown} mr={2} />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
            </HStack>
            <Text fontSize="sm" color="text.secondary">
              <Text as="span" fontWeight="bold" color="text.primary">
                {selectedIndices.size}
              </Text>{' '}
              / {files.length} files selected ({formatBytes(totalSelectedSize)})
            </Text>
          </Flex>

          <HStack justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={handleConfirm}
              loading={isLoading}
              disabled={noneSelected}
            >
              Start Download
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  )
}
