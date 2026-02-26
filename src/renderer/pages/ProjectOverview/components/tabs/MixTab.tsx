import { useState } from 'react'
import { VStack } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import { useMixExportStore } from '@/store/mixExportStore'
import { useMixExportListener } from '@/hooks/useMixExportListener'
import { MetadataSection } from '../MetadataSection'
import { MixPrepView } from '@/components/features/mix-prep/MixPrepView'
import { ExportConfigModal } from '@/components/features/mix/ExportConfigModal'
import { ExportProgressBar } from '@/components/features/mix/ExportProgressBar'

export function MixTab(): JSX.Element {
  const currentProject = useProjectStore((state) => state.currentProject)
  const progress = useMixExportStore((s) => s.progress)
  const cancelExport = useMixExportStore((s) => s.cancelExport)

  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  useMixExportListener()

  if (!currentProject) {
    return <></>
  }

  const songs = [...currentProject.songs].sort((a, b) => a.order - b.order)

  return (
    <VStack align="stretch" gap={4} h="full">
      {/* Export Progress — visible during export AND after completion/error */}
      {progress && (
        <ExportProgressBar progress={progress} onCancel={cancelExport} />
      )}

      {/* Mix Preparation View (split-panel layout) */}
      <MixPrepView onOpenExportModal={() => setIsExportModalOpen(true)} />

      {/* Metadata Section */}
      <MetadataSection
        genre={currentProject.mixMetadata?.genre}
        tags={currentProject.mixMetadata?.tags || []}
        directory={currentProject.projectDirectory}
      />

      {/* Export Config Modal */}
      <ExportConfigModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectId={currentProject.id}
        songs={songs}
        defaultCrossfade={
          currentProject.mixMetadata?.exportConfig?.defaultCrossfadeDuration ??
          5
        }
        exportConfig={currentProject.mixMetadata?.exportConfig}
        projectName={currentProject.name}
        mixMetadata={currentProject.mixMetadata}
      />
    </VStack>
  )
}
