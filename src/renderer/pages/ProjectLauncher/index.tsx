import { useEffect } from 'react'
import { Box, SimpleGrid, VStack, Spinner, Text } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
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

  useEffect(() => {
    // Load recent projects on mount
    loadRecentProjects()
  }, [loadRecentProjects])

  useEffect(() => {
    // Navigate to main app when project is loaded
    if (currentProject) {
      // TODO: Navigate to main project view
    }
  }, [currentProject])

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
