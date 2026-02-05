import { VStack } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import { MetadataSection } from '../MetadataSection'
import { SongsList } from '../SongsList'

export function MixTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)

  if (!currentProject) {
    return <></>
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Metadata Section */}
      <MetadataSection
        genre={currentProject.mixMetadata?.genre}
        tags={currentProject.mixMetadata?.tags || []}
        directory={currentProject.projectDirectory}
      />

      {/* Songs List */}
      <SongsList songs={currentProject.songs} maxDisplay={10} />
    </VStack>
  )
}
