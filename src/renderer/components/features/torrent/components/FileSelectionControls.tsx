import { Box, Button, Flex, HStack, Text, Icon } from '@chakra-ui/react'
import { FiCheckSquare, FiSquare, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import { formatBytes } from '../utils/fileSelectionTree'

interface FileSelectionControlsProps {
  totalFiles: number
  selectedCount: number
  totalSelectedSize: number
  allSelected: boolean
  noneSelected: boolean
  allExpanded: boolean
  isLoading: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onConfirm: () => void
  onCancel: () => void
}

/**
 * FileSelectionControls
 *
 * Footer toolbar: select/deselect all, expand/collapse all, count display, confirm/cancel.
 */
export function FileSelectionControls({
  totalFiles,
  selectedCount,
  totalSelectedSize,
  allSelected,
  noneSelected,
  allExpanded,
  isLoading,
  onSelectAll,
  onDeselectAll,
  onExpandAll,
  onCollapseAll,
  onConfirm,
  onCancel,
}: FileSelectionControlsProps): JSX.Element {
  return (
    <Box p={6} pt={4} borderTop="1px solid" borderColor="border.base">
      <Flex justify="space-between" align="center" mb={4}>
        <HStack gap={2}>
          <Button
            size="sm"
            variant="ghost"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            disabled={isLoading}
          >
            <Icon as={allSelected ? FiSquare : FiCheckSquare} mr={2} />
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <Box w="1px" h="20px" bg="border.base" />
          <Button
            size="sm"
            variant="ghost"
            onClick={allExpanded ? onCollapseAll : onExpandAll}
            disabled={isLoading}
          >
            <Icon as={allExpanded ? FiChevronRight : FiChevronDown} mr={2} />
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        </HStack>
        <Text fontSize="sm" color="text.secondary">
          <Text as="span" fontWeight="bold" color="text.primary">
            {selectedCount}
          </Text>{' '}
          / {totalFiles} files selected ({formatBytes(totalSelectedSize)})
        </Text>
      </Flex>

      <HStack justify="flex-end" gap={3}>
        <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          colorPalette="blue"
          onClick={onConfirm}
          loading={isLoading}
          disabled={noneSelected}
        >
          Start Download
        </Button>
      </HStack>
    </Box>
  )
}
