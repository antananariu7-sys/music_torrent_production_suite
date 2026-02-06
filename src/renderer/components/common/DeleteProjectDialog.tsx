import { useState } from 'react'
import { Box, Button, Heading, Text, VStack, HStack, Icon } from '@chakra-ui/react'
import { FiAlertTriangle, FiTrash2 } from 'react-icons/fi'

interface DeleteProjectDialogProps {
  isOpen: boolean
  projectName: string
  projectDirectory: string
  onDeleteFromRecent: () => Promise<void>
  onDeleteFromDisk: () => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function DeleteProjectDialog({
  isOpen,
  projectName,
  projectDirectory,
  onDeleteFromRecent,
  onDeleteFromDisk,
  onCancel,
  isLoading = false,
}: DeleteProjectDialogProps): JSX.Element | null {
  const [isDeletingFromDisk, setIsDeletingFromDisk] = useState(false)

  if (!isOpen) return null

  const handleDeleteFromDisk = async () => {
    setIsDeletingFromDisk(true)
    await onDeleteFromDisk()
    setIsDeletingFromDisk(false)
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
        maxW="lg"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={0}>
          {/* Header */}
          <Box p={6} borderBottom="1px solid" borderColor="border.base">
            <Heading size="lg" color="text.primary">
              Remove Project
            </Heading>
          </Box>

          {/* Body */}
          <Box p={6}>
            <VStack align="stretch" gap={4}>
              <Text color="text.secondary">
                Remove <strong>&quot;{projectName}&quot;</strong> from recent projects?
              </Text>
              <Text fontSize="sm" color="text.muted" fontFamily="monospace">
                {projectDirectory}
              </Text>
            </VStack>
          </Box>

          {/* Primary action - Remove from recent */}
          <HStack p={6} pt={0} justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onCancel} disabled={isLoading || isDeletingFromDisk}>
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={onDeleteFromRecent}
              loading={isLoading}
              disabled={isDeletingFromDisk}
            >
              Remove from Recent
            </Button>
          </HStack>

          {/* Danger Zone */}
          <Box
            mx={6}
            mb={6}
            p={4}
            borderRadius="lg"
            border="1px solid"
            borderColor="red.500/30"
            bg="red.500/5"
          >
            <VStack align="stretch" gap={3}>
              <HStack gap={2}>
                <Icon as={FiAlertTriangle} color="red.400" />
                <Text fontSize="sm" fontWeight="semibold" color="red.400">
                  Danger Zone
                </Text>
              </HStack>

              <Text fontSize="sm" color="text.secondary">
                Permanently delete project files from disk. This action cannot be undone.
              </Text>

              <Button
                size="sm"
                variant="outline"
                colorPalette="red"
                onClick={handleDeleteFromDisk}
                loading={isDeletingFromDisk}
                disabled={isLoading}
                w="fit-content"
              >
                <Icon as={FiTrash2} mr={2} />
                Delete from Disk
              </Button>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </Box>
  )
}
