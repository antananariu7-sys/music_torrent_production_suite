import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VStack, HStack, Box, Icon, Text, Button } from '@chakra-ui/react'
import { FiSearch, FiDownload, FiMusic, FiActivity } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useCollectionCount } from '@/store/torrentCollectionStore'
import type { AppInfo } from '@shared/types/app.types'
import { PageLayout } from '@/components/common'
import { projectOverviewStyles } from './ProjectOverview.styles'
import { ProjectHeader } from './components/ProjectHeader'
import { StatsGrid } from './components/StatsGrid'
import { SearchTab, TorrentTab, MixTab, TimelineTab } from './components/tabs'
import {
  calculateTotalDuration,
  calculateTotalSize,
  getUniqueFormats,
} from './utils'

type TabValue = 'search' | 'torrent' | 'mix' | 'timeline'

interface ProjectOverviewProps {
  appInfo: AppInfo | null
}

export default function ProjectOverview({ appInfo }: ProjectOverviewProps): JSX.Element | null {
  const navigate = useNavigate()
  const currentProject = useProjectStore((state) => state.currentProject)
  const collectionCount = useCollectionCount()
  const [activeTab, setActiveTab] = useState<TabValue>('search')

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

  const tabs: { value: TabValue; label: string; icon: typeof FiSearch; badge?: number }[] = [
    { value: 'search', label: 'Search', icon: FiSearch },
    { value: 'torrent', label: 'Torrent', icon: FiDownload, badge: collectionCount },
    { value: 'mix', label: 'Mix', icon: FiMusic },
    { value: 'timeline', label: 'Timeline', icon: FiActivity },
  ]

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

        {/* Tab Navigation */}
        <Box>
          <HStack
            gap={1}
            p={1}
            bg="bg.surface"
            borderRadius="md"
            borderWidth="1px"
            borderColor="border.base"
            w="fit-content"
          >
            {tabs.map((tab) => (
              <Button
                key={tab.value}
                variant={activeTab === tab.value ? 'solid' : 'ghost'}
                colorPalette={activeTab === tab.value ? 'blue' : 'gray'}
                size="sm"
                onClick={() => setActiveTab(tab.value)}
                px={4}
              >
                <HStack gap={2}>
                  <Icon as={tab.icon} boxSize={4} />
                  <Text>{tab.label}</Text>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <Text
                      fontSize="xs"
                      bg={activeTab === tab.value ? 'white' : 'interactive.base'}
                      color={activeTab === tab.value ? 'blue.600' : 'white'}
                      px={1.5}
                      py={0.5}
                      borderRadius="full"
                      minW={5}
                      textAlign="center"
                    >
                      {tab.badge}
                    </Text>
                  )}
                </HStack>
              </Button>
            ))}
          </HStack>
        </Box>

        {/* Tab Content */}
        <Box>
          {activeTab === 'search' && <SearchTab />}
          {activeTab === 'torrent' && <TorrentTab />}
          {activeTab === 'mix' && <MixTab />}
          {activeTab === 'timeline' && <TimelineTab />}
        </Box>
      </VStack>
    </PageLayout>
  )
}
