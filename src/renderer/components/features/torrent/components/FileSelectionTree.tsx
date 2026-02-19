import { Box, Flex, Text, Icon } from '@chakra-ui/react'
import { FiFile, FiFolder, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import { Checkbox } from '@/components/ui/checkbox'
import type { SelectionTreeNode } from '../utils/fileSelectionTree'
import { formatBytes } from '../utils/fileSelectionTree'

interface FileSelectionTreeProps {
  root: SelectionTreeNode
  selectedIndices: Set<number>
  expandedFolders: Set<string>
  onToggleFile: (index: number) => void
  onToggleFolder: (path: string) => void
  onToggleFolderSelection: (node: SelectionTreeNode) => void
}

/**
 * FileSelectionTree
 *
 * Renders a recursive file/folder tree with checkboxes for file selection.
 */
export function FileSelectionTree({
  root,
  selectedIndices,
  expandedFolders,
  onToggleFile,
  onToggleFolder,
  onToggleFolderSelection,
}: FileSelectionTreeProps): JSX.Element {
  const renderNode = (node: SelectionTreeNode, depth: number = 0): JSX.Element[] => {
    if (!node.isFolder && node.fileIndices.length === 0) return []

    const isExpanded = expandedFolders.has(node.path)
    const isSelected = node.fileIndices.every((idx) => selectedIndices.has(idx))
    const isPartiallySelected = !isSelected && node.fileIndices.some((idx) => selectedIndices.has(idx))

    const items: JSX.Element[] = []

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
                  onToggleFolder(node.path)
                }}
              />
              <Box
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFolderSelection(node)
                }}
              >
                <Checkbox
                  checked={isSelected}
                  css={{ opacity: isPartiallySelected ? 0.5 : 1 }}
                />
              </Box>
              <Icon as={FiFolder} fontSize="md" color="blue.400" />
              <Text flex="1" color="text.primary" onClick={() => onToggleFolder(node.path)}>
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
                  onToggleFile(node.fileIndices[0])
                }}
              >
                <Checkbox checked={selectedIndices.has(node.fileIndices[0])} />
              </Box>
              <Icon as={FiFile} fontSize="sm" color="text.muted" />
              <Text
                flex="1"
                color="text.primary"
                onClick={() => onToggleFile(node.fileIndices[0])}
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

    if (node.isFolder && (isExpanded || !node.path)) {
      node.children.forEach((child) => {
        items.push(...renderNode(child, node.path ? depth + 1 : depth))
      })
    }

    return items
  }

  return <>{renderNode(root)}</>
}
