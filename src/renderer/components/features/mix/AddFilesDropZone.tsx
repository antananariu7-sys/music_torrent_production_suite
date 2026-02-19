import { useState, useCallback } from 'react'
import { Box, Flex, Text, Icon, Spinner } from '@chakra-ui/react'
import { FiUpload } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { toaster } from '@/components/ui/toaster'
import { isAudioFile } from '@/utils/audioUtils'
import type { Project } from '@shared/types/project.types'

export function AddFilesDropZone(): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const [isDragging, setIsDragging] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [addingCount, setAddingCount] = useState(0)

  const addFiles = useCallback(async (filePaths: string[]) => {
    if (!currentProject) return
    const audioPaths = filePaths.filter(isAudioFile)
    if (audioPaths.length === 0) {
      toaster.create({ title: 'No audio files found', type: 'warning' })
      return
    }

    setIsAdding(true)
    setAddingCount(audioPaths.length)

    let latestProject: Project = currentProject
    let added = 0
    let failed = 0

    for (const sourcePath of audioPaths) {
      try {
        const response = await window.api.mix.addSong({
          projectId: latestProject.id,
          sourcePath,
          order: latestProject.songs.length,
        })
        if (response.success && response.data) {
          latestProject = response.data
          added++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    setCurrentProject(latestProject)
    setIsAdding(false)
    setAddingCount(0)

    if (added > 0) {
      toaster.create({
        title: `Added ${added} ${added === 1 ? 'track' : 'tracks'} to Mix`,
        type: 'success',
      })
    }
    if (failed > 0) {
      toaster.create({
        title: `${failed} ${failed === 1 ? 'file' : 'files'} failed to add`,
        type: 'error',
      })
    }
  }, [currentProject, setCurrentProject])

  const handleClick = useCallback(async () => {
    if (isAdding) return
    const paths = await window.api.selectAudioFiles()
    if (paths && paths.length > 0) {
      await addFiles(paths)
    }
  }, [isAdding, addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (isAdding) return

    const files = Array.from(e.dataTransfer.files)
    // Electron exposes .path on File objects for filesystem drag-and-drop
    const paths = files
      .map((f) => (f as unknown as { path: string }).path)
      .filter(Boolean)

    if (paths.length > 0) {
      await addFiles(paths)
    }
  }, [isAdding, addFiles])

  return (
    <Box
      borderWidth="2px"
      borderStyle="dashed"
      borderColor={isDragging ? 'blue.400' : 'border.base'}
      borderRadius="md"
      bg={isDragging ? 'blue.500/8' : 'bg.card'}
      transition="all 0.15s"
      cursor={isAdding ? 'default' : 'pointer'}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      _hover={!isAdding ? { borderColor: 'blue.400', bg: 'blue.500/5' } : undefined}
      p={5}
    >
      <Flex direction="column" align="center" gap={2}>
        {isAdding ? (
          <>
            <Spinner size="sm" color="blue.400" />
            <Text fontSize="sm" color="text.muted">
              Adding {addingCount} {addingCount === 1 ? 'file' : 'files'}…
            </Text>
          </>
        ) : (
          <>
            <Icon as={FiUpload} boxSize={5} color={isDragging ? 'blue.400' : 'text.muted'} />
            <Text fontSize="sm" color={isDragging ? 'blue.400' : 'text.muted'} textAlign="center">
              Drop audio files here or{' '}
              <Text as="span" color="blue.400" textDecoration="underline">
                click to browse
              </Text>
            </Text>
            <Text fontSize="xs" color="text.muted">
              MP3, FLAC, WAV, M4A, AAC, OGG and more
            </Text>
          </>
        )}
      </Flex>
    </Box>
  )
}
