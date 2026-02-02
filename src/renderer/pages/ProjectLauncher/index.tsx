import { useEffect, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Card,
  Button,
  VStack,
  HStack,
  Badge,
  Input,
  Textarea,
  Spinner,
  IconButton,
} from '@chakra-ui/react'
import { FiFolder, FiPlus, FiClock, FiMusic } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import type { AppInfo } from '@shared/types/app.types'
import Layout from '@/components/common/Layout'
import { FrequencyBars } from '@/pages/Welcome/components'
import { projectLauncherStyles } from './ProjectLauncher.styles'

interface ProjectLauncherProps {
  appInfo: AppInfo | null
}

export default function ProjectLauncher({ appInfo }: ProjectLauncherProps) {
  const {
    currentProject,
    recentProjects,
    isLoading,
    error,
    loadRecentProjects,
    createProject,
    openProject,
    clearError,
  } = useProjectStore()

  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    // Load recent projects on mount
    loadRecentProjects()
  }, [loadRecentProjects])

  useEffect(() => {
    // Navigate to main app when project is loaded
    if (currentProject) {
      // TODO: Navigate to main project view
      console.log('Project loaded:', currentProject)
    }
  }, [currentProject])

  const handleSelectLocation = async () => {
    const directory = await window.api.selectDirectory()
    if (directory) {
      setProjectLocation(directory)
    }
  }

  const handleCreateProject = async () => {
    if (!projectName.trim() || !projectLocation) {
      return
    }

    await createProject(projectName, projectLocation, projectDescription || undefined)
    setProjectName('')
    setProjectDescription('')
    setProjectLocation('')
    setShowCreateForm(false)
  }

  const handleOpenRecent = async (projectDirectory: string) => {
    const filePath = `${projectDirectory}/project.json`
    await openProject(filePath)
  }

  const handleBrowseProject = async () => {
    const directory = await window.api.selectDirectory()
    if (directory) {
      const filePath = `${directory}/project.json`
      await openProject(filePath)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <>
      <style>{projectLauncherStyles}</style>

      {/* Frequency visualization at bottom */}
      <Box
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        height="120px"
        overflow="hidden"
        opacity="0.15"
        pointerEvents="none"
        zIndex="0"
      >
        <FrequencyBars />
      </Box>

      <Layout maxW="container.xl">
        {/* Header Section */}
        <Box className="header-section" mb={12}>
          <Box textAlign="center">
            <Text
              fontSize="sm"
              fontWeight="bold"
              letterSpacing="widest"
              textTransform="uppercase"
              color="brand.400"
              fontFamily="monospace"
              mb={4}
              className="version-glow"
            >
              // PROJECT SYSTEM
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: '4xl', md: '6xl', lg: '7xl' }}
              fontWeight="900"
              lineHeight="0.95"
              letterSpacing="-0.02em"
              mb={4}
            >
              <Box
                as="span"
                display="block"
                color="text.primary"
                style={{
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  textTransform: 'uppercase',
                }}
              >
                Choose Your
              </Box>
              <Box
                as="span"
                display="block"
                bgGradient="to-r"
                gradientFrom="brand.400"
                gradientVia="accent.400"
                gradientTo="brand.600"
                bgClip="text"
                style={{
                  fontFamily: "'Arial Black', 'Arial', sans-serif",
                  textTransform: 'uppercase',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
                }}
              >
                Project
              </Box>
            </Heading>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              color="text.secondary"
              maxW="700px"
              mx="auto"
              lineHeight="1.7"
              fontWeight="500"
            >
              Create a new project or continue working on an existing one
            </Text>
          </Box>
        </Box>

        {/* Error Message */}
        {error && (
          <Box
            mb={8}
            p={6}
            bg="red.900/20"
            borderWidth="2px"
            borderColor="red.500"
            borderRadius="lg"
            position="relative"
            className="action-section"
          >
            <HStack justify="space-between" align="start">
              <VStack align="start" gap={2} flex="1">
                <HStack>
                  <Text fontSize="2xl">⚠️</Text>
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    fontFamily="monospace"
                    color="red.400"
                    letterSpacing="wider"
                    textTransform="uppercase"
                  >
                    ERROR
                  </Text>
                </HStack>
                <Text color="red.200" fontWeight="500">
                  {error}
                </Text>
              </VStack>
              <IconButton
                aria-label="Close error"
                onClick={clearError}
                variant="ghost"
                size="sm"
                colorPalette="red"
              >
                ✕
              </IconButton>
            </HStack>
          </Box>
        )}

        {/* Loading State */}
        {isLoading && (
          <Box textAlign="center" py={16} className="action-section">
            <VStack gap={4}>
              <Spinner size="xl" color="brand.500" borderWidth="3px" />
              <Text
                fontSize="sm"
                fontFamily="monospace"
                color="text.secondary"
                letterSpacing="wide"
              >
                LOADING PROJECTS...
              </Text>
            </VStack>
          </Box>
        )}

        {/* Main Actions */}
        {!isLoading && (
          <Box className="action-section" mb={16}>
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
              {/* Create New Project Card */}
              <Card.Root
                bg="bg.card"
                borderWidth="2px"
                borderColor="border.base"
                borderRadius="xl"
                overflow="hidden"
                position="relative"
                className="action-card action-card-1"
              >
                <Card.Body gap={5} p={8}>
                  <VStack align="start" gap={4}>
                    <HStack gap={4} align="center">
                      <Box fontSize="4xl" className="emoji-icon">
                        ✨
                      </Box>
                      <VStack align="start" gap={0}>
                        <Heading
                          size="xl"
                          color="text.primary"
                          fontWeight="800"
                          letterSpacing="-0.01em"
                        >
                          Create New Project
                        </Heading>
                        <Text
                          fontSize="xs"
                          fontFamily="monospace"
                          color="brand.400"
                          fontWeight="bold"
                        >
                          ACTION_01
                        </Text>
                      </VStack>
                    </HStack>

                    {!showCreateForm ? (
                      <>
                        <Text color="text.secondary" lineHeight="1.7" fontSize="md">
                          Start a fresh project with organized folder structure and automatic
                          configuration.
                        </Text>
                        <Box
                          w="full"
                          h="2px"
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                          }}
                        />
                        <Button
                          colorPalette="brand"
                          size="lg"
                          w="full"
                          fontWeight="bold"
                          letterSpacing="wide"
                          textTransform="uppercase"
                          onClick={() => setShowCreateForm(true)}
                        >
                          <HStack gap={2}>
                            <FiPlus />
                            <Text>New Project</Text>
                          </HStack>
                        </Button>
                      </>
                    ) : (
                      <VStack align="stretch" gap={4} w="full">
                        <Box>
                          <Text
                            fontSize="xs"
                            fontFamily="monospace"
                            mb={2}
                            color="text.secondary"
                            fontWeight="bold"
                            letterSpacing="wide"
                          >
                            PROJECT NAME *
                          </Text>
                          <Input
                            placeholder="My Awesome Mix"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            size="lg"
                            fontWeight="500"
                          />
                        </Box>

                        <Box>
                          <Text
                            fontSize="xs"
                            fontFamily="monospace"
                            mb={2}
                            color="text.secondary"
                            fontWeight="bold"
                            letterSpacing="wide"
                          >
                            DESCRIPTION (OPTIONAL)
                          </Text>
                          <Textarea
                            placeholder="Brief description of your project..."
                            value={projectDescription}
                            onChange={(e) => setProjectDescription(e.target.value)}
                            rows={3}
                            fontWeight="500"
                          />
                        </Box>

                        <Box>
                          <Text
                            fontSize="xs"
                            fontFamily="monospace"
                            mb={2}
                            color="text.secondary"
                            fontWeight="bold"
                            letterSpacing="wide"
                          >
                            LOCATION *
                          </Text>
                          <HStack>
                            <Input
                              placeholder="Select folder..."
                              value={projectLocation}
                              readOnly
                              flex={1}
                              fontFamily="monospace"
                              fontSize="sm"
                            />
                            <Button onClick={handleSelectLocation} colorPalette="accent">
                              <FiFolder />
                            </Button>
                          </HStack>
                        </Box>

                        <Box
                          w="full"
                          h="2px"
                          style={{
                            background:
                              'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                          }}
                        />

                        <HStack justify="flex-end" gap={3}>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setShowCreateForm(false)
                              setProjectName('')
                              setProjectDescription('')
                              setProjectLocation('')
                            }}
                            textTransform="uppercase"
                            fontWeight="bold"
                            letterSpacing="wide"
                          >
                            Cancel
                          </Button>
                          <Button
                            colorPalette="brand"
                            onClick={handleCreateProject}
                            disabled={!projectName.trim() || !projectLocation}
                            textTransform="uppercase"
                            fontWeight="bold"
                            letterSpacing="wide"
                          >
                            Create
                          </Button>
                        </HStack>
                      </VStack>
                    )}
                  </VStack>
                </Card.Body>
              </Card.Root>

              {/* Open Existing Project Card */}
              <Card.Root
                bg="bg.card"
                borderWidth="2px"
                borderColor="border.base"
                borderRadius="xl"
                overflow="hidden"
                position="relative"
                className="action-card action-card-2"
              >
                <Card.Body gap={5} p={8}>
                  <VStack align="start" gap={4}>
                    <HStack gap={4} align="center">
                      <Box fontSize="4xl" className="emoji-icon">
                        📂
                      </Box>
                      <VStack align="start" gap={0}>
                        <Heading
                          size="xl"
                          color="text.primary"
                          fontWeight="800"
                          letterSpacing="-0.01em"
                        >
                          Open Existing
                        </Heading>
                        <Text
                          fontSize="xs"
                          fontFamily="monospace"
                          color="accent.400"
                          fontWeight="bold"
                        >
                          ACTION_02
                        </Text>
                      </VStack>
                    </HStack>

                    <Text color="text.secondary" lineHeight="1.7" fontSize="md">
                      Browse for a project folder containing a project.json file to continue
                      working.
                    </Text>

                    <Box
                      w="full"
                      h="2px"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                      }}
                    />

                    <Button
                      colorPalette="accent"
                      size="lg"
                      w="full"
                      fontWeight="bold"
                      letterSpacing="wide"
                      textTransform="uppercase"
                      onClick={handleBrowseProject}
                    >
                      <HStack gap={2}>
                        <FiFolder />
                        <Text>Browse</Text>
                      </HStack>
                    </Button>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>
          </Box>
        )}

        {/* Recent Projects */}
        {!isLoading && recentProjects.length > 0 && (
          <Box className="recent-section" mb={12}>
            <HStack mb={6} gap={3}>
              <Box fontSize="2xl">
                <FiClock />
              </Box>
              <VStack align="start" gap={0}>
                <Heading size="lg" fontWeight="800" letterSpacing="-0.01em">
                  Recent Projects
                </Heading>
                <Text fontSize="xs" fontFamily="monospace" color="accent.400" fontWeight="bold">
                  QUICK_ACCESS
                </Text>
              </VStack>
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              {recentProjects.map((project) => (
                <Card.Root
                  key={project.projectId}
                  bg="bg.card"
                  borderWidth="2px"
                  borderColor="border.base"
                  borderRadius="lg"
                  overflow="hidden"
                  position="relative"
                  cursor="pointer"
                  className="project-card"
                  onClick={() => handleOpenRecent(project.projectDirectory)}
                >
                  <Card.Body p={6}>
                    <VStack align="stretch" gap={3}>
                      <HStack justify="space-between" align="start">
                        <VStack align="start" gap={1} flex="1">
                          <Heading
                            size="md"
                            fontWeight="700"
                            overflow="hidden"
                            textOverflow="ellipsis"
                            whiteSpace="nowrap"
                          >
                            {project.projectName}
                          </Heading>
                          <Text
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
                        {project.songCount > 0 && (
                          <Badge colorPalette="brand" size="sm">
                            <HStack gap={1}>
                              <FiMusic />
                              <Text fontWeight="bold">{project.songCount}</Text>
                            </HStack>
                          </Badge>
                        )}
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
                        <Text color="brand.400" fontWeight="bold">
                          {formatDate(project.lastOpened)}
                        </Text>
                      </HStack>
                    </VStack>
                  </Card.Body>
                </Card.Root>
              ))}
            </SimpleGrid>
          </Box>
        )}

        {/* Footer */}
        {appInfo && (
          <Box
            textAlign="center"
            pt={12}
            pb={6}
            borderTopWidth="1px"
            borderTopColor="border.base"
          >
            <HStack
              justify="center"
              gap={4}
              color="text.muted"
              fontSize="sm"
              fontFamily="monospace"
              fontWeight="500"
            >
              <HStack gap={2}>
                <Box w="2" h="2" bg="green.400" borderRadius="full" />
                <Text>VERSION {appInfo.version}</Text>
              </HStack>
              <Text color="border.base">|</Text>
              <Text>
                {appInfo.platform.toUpperCase()} / {appInfo.arch.toUpperCase()}
              </Text>
            </HStack>
          </Box>
        )}
      </Layout>
    </>
  )
}
