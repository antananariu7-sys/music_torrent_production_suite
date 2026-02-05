import { useState } from 'react'
import { Card, VStack, HStack, Heading, Text, Badge, Box, IconButton } from '@chakra-ui/react'
import { FiMusic, FiTrash2 } from 'react-icons/fi'
import type { RecentProject } from '@shared/types/project.types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useProjectStore } from '@/store/useProjectStore'

interface RecentProjectCardProps {
  /**
   * Single recent project data
   */
  project: RecentProject

  /**
   * Callback when card is clicked
   */
  onOpenProject: (projectDirectory: string) => Promise<void>
}

export function RecentProjectCard({
  project,
  onOpenProject,
}: RecentProjectCardProps): JSX.Element {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteProject = useProjectStore((state) => state.deleteProject)

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    await deleteProject(project.projectId)
    setIsDeleting(false)
    setShowDeleteConfirm(false)
  }

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <Card.Root
        key={project.projectId}
        data-testid={`launcher-card-recent-${project.projectId}`}
        bg="bg.card"
        borderWidth="2px"
        borderColor="border.base"
        borderRadius="lg"
        overflow="hidden"
        position="relative"
        cursor="pointer"
        className="project-card"
        onClick={() => onOpenProject(project.projectDirectory)}
      >
        <Card.Body p={6}>
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between" align="start">
              <VStack align="start" gap={1} flex="1" minW={0}>
                <Heading
                  data-testid="launcher-text-project-name"
                  size="md"
                  fontWeight="700"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {project.projectName}
                </Heading>
                <Text
                  data-testid="launcher-text-project-directory"
                  fontSize="xs"
                  fontFamily="monospace"
                  color="text.muted"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {project.projectDirectory}
                </Text>
              </VStack>
              <HStack gap={2}>
                {project.songCount > 0 && (
                  <Badge data-testid="launcher-badge-song-count" colorPalette="brand" size="sm">
                    <HStack gap={1}>
                      <FiMusic />
                      <Text fontWeight="bold">{project.songCount}</Text>
                    </HStack>
                  </Badge>
                )}
                <IconButton
                  aria-label="Delete project"
                  size="sm"
                  variant="ghost"
                  colorPalette="red"
                  onClick={handleDeleteClick}
                  _hover={{ bg: 'red.900/30' }}
                >
                  <FiTrash2 />
                </IconButton>
              </HStack>
            </HStack>

            <Box
              w="full"
              h="1px"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
              }}
            />

            <HStack justify="space-between" fontSize="xs" fontFamily="monospace">
              <Text color="text.muted">LAST OPENED</Text>
              <Text data-testid="launcher-text-last-opened" color="brand.400" fontWeight="bold">
                {formatDate(project.lastOpened)}
              </Text>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to remove "${project.projectName}" from recent projects? This will not delete the project files from disk.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColorPalette="red"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isLoading={isDeleting}
      />
    </>
  )
}
