import React from 'react'
import { useSmartSearchWorkflow } from './useSmartSearchWorkflow'
import { InlineSearchResults } from './InlineSearchResults'
import { SearchLoadingIndicator } from './SearchLoadingIndicator'
import { SearchCompletionNotice } from './SearchCompletionNotice'
import { SearchErrorNotice } from './SearchErrorNotice'

interface SmartSearchProps {
  /** Optional callback when workflow completes */
  onComplete?: (filePath: string) => void
  /** Optional callback when workflow is cancelled */
  onCancel?: () => void
}

export const SmartSearch: React.FC<SmartSearchProps> = ({ onComplete, onCancel }) => {
  const {
    step,
    error,
    classificationResults,
    selectedClassification,
    albums,
    selectedAlbum,
    ruTrackerResults,
    isScannningDiscography,
    discographyScanProgress,
    discographyScanResults,
    inlineStep,
    loadingMessage,
    searchProgress,
    handleSelectClassification,
    handleSelectAlbum,
    handleSelectDiscography,
    handleStartDiscographyScan,
    handleStopDiscographyScan,
    handleSelectTorrent,
    handleCancel,
  } = useSmartSearchWorkflow({ onComplete, onCancel })

  return (
    <>
      {loadingMessage && <SearchLoadingIndicator message={loadingMessage} progress={searchProgress} />}

      {inlineStep && (
        <InlineSearchResults
          step={inlineStep}
          classificationResults={classificationResults}
          onSelectClassification={handleSelectClassification}
          albums={albums}
          onSelectAlbum={handleSelectAlbum}
          onSelectDiscography={
            selectedClassification?.type === 'artist' ? handleSelectDiscography : undefined
          }
          selectedClassification={selectedClassification}
          torrents={ruTrackerResults}
          onSelectTorrent={handleSelectTorrent}
          isDownloading={step === 'downloading'}
          onCancel={handleCancel}
          selectedAlbum={selectedAlbum}
          isScannningDiscography={isScannningDiscography}
          discographyScanProgress={discographyScanProgress}
          discographyScanResults={discographyScanResults}
          onStartDiscographyScan={selectedAlbum ? handleStartDiscographyScan : undefined}
          onStopDiscographyScan={handleStopDiscographyScan}
        />
      )}

      {step === 'completed' && <SearchCompletionNotice />}

      {step === 'error' && error && (
        <SearchErrorNotice error={error} onClose={handleCancel} />
      )}
    </>
  )
}
