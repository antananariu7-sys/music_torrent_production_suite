import { Box, Heading, HStack, VStack, Text, SimpleGrid } from '@chakra-ui/react'
import { FiClock } from 'react-icons/fi'
import type { RecentProject } from '@shared/types/project.types'
import { RecentProjectCard } from './RecentProjectCard'

interface RecentProjectsSectionProps {
  /**
   * List of recent projects from store
   */
  projects: RecentProject[]

  /**
   * Callback when user clicks a project card
   * @param projectDirectory - Full path to project directory
   */
  onOpenProject: (projectDirectory: string) => Promise<void>

  /**
   * Whether loading is in progress (optional)
   */
  isLoading?: boolean
}

export function RecentProjectsSection({
  projects,
  onOpenProject,
}: RecentProjectsSectionProps): JSX.Element | null {
  // Don't render if no projects
  if (projects.length === 0) {
    return null
  }

  return (
    <Box data-testid="launcher-section-recent" className="recent-section" mb={12}>
      <HStack mb={6} gap={3}>
        <Box fontSize="2xl">
          <FiClock />
        </Box>
        <VStack align="start" gap={0}>
          <Heading
            data-testid="launcher-heading-recent"
            size="lg"
            fontWeight="800"
            letterSpacing="-0.01em"
          >
            Recent Projects
          </Heading>
          <Text fontSize="xs" fontFamily="monospace" color="accent.400" fontWeight="bold">
            QUICK_ACCESS
          </Text>
        </VStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        {projects.map((project) => (
          <RecentProjectCard
            key={project.projectId}
            project={project}
            onOpenProject={onOpenProject}
          />
        ))}
      </SimpleGrid>
    </Box>
  )
}
