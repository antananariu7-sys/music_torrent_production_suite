import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { VStack } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import type { AppInfo } from '@shared/types/app.types'
import { PageLayout } from '@/components/common'
import { projectOverviewStyles } from './ProjectOverview.styles'
import { ProjectHeader } from './components/ProjectHeader'
import { StatsGrid } from './components/StatsGrid'
import { MetadataSection } from './components/MetadataSection'
import { SongsList } from './components/SongsList'
import { SearchSection } from './components/SearchSection'
import {
  calculateTotalDuration,
  calculateTotalSize,
  getUniqueFormats,
} from './utils'

interface ProjectOverviewProps {
  appInfo: AppInfo | null
}

export default function ProjectOverview({ appInfo }: ProjectOverviewProps): JSX.Element | null {
  const navigate = useNavigate()
  const currentProject = useProjectStore((state) => state.currentProject)

  // Route guard: redirect to launcher if no project loaded
  useEffect(() => {
    if (!currentProject) {
      navigate('/', { replace: true })
    }
  }, [currentProject, navigate])

  // Return null while redirecting
  if (!currentProject) {
    return null
  }

  // Calculate statistics
  const totalDuration = calculateTotalDuration(currentProject.songs)
  const totalSize = calculateTotalSize(currentProject.songs)
  const formats = getUniqueFormats(currentProject.songs)

  return (
    <PageLayout appInfo={appInfo} maxW="container.xl" customStyles={projectOverviewStyles}>
      <VStack gap={6} align="stretch">
        {/* Project Header */}
        <ProjectHeader
          name={currentProject.name}
          description={currentProject.description}
          isActive={currentProject.isActive}
        />

        {/* Statistics Grid */}
        <StatsGrid
          songCount={currentProject.songs.length}
          totalDuration={totalDuration}
          totalSize={totalSize}
          formats={formats}
          createdAt={currentProject.createdAt}
          updatedAt={currentProject.updatedAt}
        />

        {/* Metadata Section */}
        <MetadataSection
          genre={currentProject.mixMetadata?.genre}
          tags={currentProject.mixMetadata?.tags || []}
          directory={currentProject.projectDirectory}
        />

        {/* Search Section */}
        <SearchSection />

        {/* Songs List */}
        <SongsList songs={currentProject.songs} maxDisplay={10} />
      </VStack>
    </PageLayout>
  )
}
