import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, SimpleGrid, VStack, HStack, Spinner, Text, Badge, Icon } from '@chakra-ui/react'
import { FiActivity } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useActiveTorrents } from '@/store/downloadQueueStore'
import type { AppInfo } from '@shared/types/app.types'
import { PageLayout, ErrorAlert } from '@/components/common'
import { projectLauncherStyles } from './ProjectLauncher.styles'
import { LauncherHeader } from './components/LauncherHeader'
import { CreateProjectCard } from './components/CreateProjectCard'
import { OpenProjectCard } from './components/OpenProjectCard'
import { RecentProjectsSection } from './components/RecentProjectsSection'

interface ProjectLauncherProps {
  appInfo: AppInfo | null
}

export default function ProjectLauncher({
  appInfo,
}: ProjectLauncherProps): JSX.Element {
  const navigate = useNavigate()
  const {
    currentProject,
    recentProjects,
    isLoading,
    error,
    loadRecentProjects,
    createProject,
    openProject,
    clearError,
    closeProject,
  } = useProjectStore()

  useEffect(() => {
    // Close project and release lock when returning to launcher
    closeProject()
    // Load recent projects on mount
    loadRecentProjects()
  }, [loadRecentProjects, closeProject])

  useEffect(() => {
    // Navigate to project overview when project is loaded
    if (currentProject) {
      navigate('/project')
    }
  }, [currentProject, navigate])

  const activeTorrents = useActiveTorrents()

  const handleCreateProject = async (
    name: string,
    location: string,
    description?: string
  ) => {
    await createProject(name, location, description)
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

  return (
    <PageLayout appInfo={appInfo} maxW="container.xl" customStyles={projectLauncherStyles} showFrequencyBars>
        {/* Header Section */}
        <LauncherHeader />

        {/* Error Message */}
        <ErrorAlert
          error={error}
          onClose={clearError}
          testId="launcher-error"
        />

        {/* Loading State */}
        {isLoading && (
          <Box
            data-testid="launcher-section-loading"
            textAlign="center"
            py={16}
            className="action-section"
          >
            <VStack gap={4}>
              <Spinner
                data-testid="launcher-spinner"
                size="xl"
                color="brand.500"
                borderWidth="3px"
              />
              <Text
                data-testid="launcher-text-loading"
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
              <CreateProjectCard
                onCreateProject={handleCreateProject}
                isLoading={isLoading}
              />
              <OpenProjectCard
                onBrowseProject={handleBrowseProject}
                isLoading={isLoading}
              />
            </SimpleGrid>
          </Box>
        )}

        {/* Active Downloads */}
        {!isLoading && activeTorrents.length > 0 && (
          <Box mb={10}>
            <HStack gap={2} mb={4}>
              <Icon as={FiActivity} boxSize={5} color="green.500" />
              <Text
                fontSize="sm"
                fontWeight="bold"
                fontFamily="monospace"
                letterSpacing="wide"
                color="text.primary"
                textTransform="uppercase"
              >
                Active Downloads
              </Text>
              <Badge colorPalette="green" variant="subtle" fontSize="xs">
                {activeTorrents.length}
              </Badge>
            </HStack>
            <VStack align="stretch" gap={2}>
              {activeTorrents.map((torrent) => (
                <Box
                  key={torrent.id}
                  p={3}
                  borderRadius="md"
                  bg="bg.card"
                  borderWidth="1px"
                  borderColor="border.base"
                >
                  <HStack justify="space-between" gap={4}>
                    <Text fontSize="sm" color="text.primary" lineClamp={1} flex="1" minW={0}>
                      {torrent.name}
                    </Text>
                    <HStack gap={3} flexShrink={0}>
                      {torrent.downloadSpeed > 0 && (
                        <Text fontSize="xs" color="green.500" fontFamily="monospace">
                          {(torrent.downloadSpeed / 1024).toFixed(0)} KB/s
                        </Text>
                      )}
                      <Text fontSize="xs" color="text.muted" fontFamily="monospace" fontWeight="bold">
                        {torrent.progress}%
                      </Text>
                    </HStack>
                  </HStack>
                  <div
                    style={{
                      marginTop: 8,
                      height: 4,
                      background: 'var(--chakra-colors-bg-surface, #1a1a2e)',
                      borderRadius: 9999,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${torrent.progress}%`,
                        background: 'var(--chakra-colors-green-500, #22c55e)',
                        borderRadius: 9999,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {/* Recent Projects */}
        {!isLoading && (
          <RecentProjectsSection
            projects={recentProjects}
            onOpenProject={handleOpenRecent}
            isLoading={isLoading}
          />
        )}

    </PageLayout>
  )
}
