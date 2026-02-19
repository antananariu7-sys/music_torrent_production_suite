import { useCallback } from 'react'
import { toaster } from '@/components/ui/toaster'
import type { MusicBrainzAlbum } from '@shared/types/musicbrainz.types'
import type { SearchResult } from '@shared/types/search.types'
import type { DiscographySearchProgress, PageContentScanResult } from '@shared/types/discography.types'
import { isLikelyDiscography } from '@shared/utils/resultClassifier'

export interface UseDiscographyScanDeps {
  selectedAlbum: MusicBrainzAlbum | null
  ruTrackerResults: SearchResult[]
  isScannningDiscography: boolean
  addActivityLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
  startDiscographyScan: () => void
  stopDiscographyScan: () => void
  setDiscographyScanProgress: (progress: DiscographySearchProgress | null) => void
  setDiscographyScanResults: (results: PageContentScanResult[]) => void
}

/**
 * useDiscographyScan
 *
 * Handles scanning discography pages to find a specific album inside a torrent.
 */
export function useDiscographyScan({
  selectedAlbum,
  ruTrackerResults,
  addActivityLog,
  startDiscographyScan,
  stopDiscographyScan,
  setDiscographyScanProgress,
  setDiscographyScanResults,
}: UseDiscographyScanDeps) {
  const handleStartDiscographyScan = useCallback(async () => {
    if (!selectedAlbum || ruTrackerResults.length === 0) return

    const discographyPages = ruTrackerResults.filter((t) => isLikelyDiscography(t.title))

    if (discographyPages.length === 0) {
      addActivityLog('No discography pages found to scan', 'warning')
      return
    }

    addActivityLog(`Scanning ${discographyPages.length} discography pages for "${selectedAlbum.title}"...`, 'info')
    startDiscographyScan()

    const cleanupProgress = window.api.discography.onProgress((progress) => {
      setDiscographyScanProgress(progress)
    })

    try {
      const response = await window.api.discography.search({
        searchResults: discographyPages,
        albumName: selectedAlbum.title,
        artistName: selectedAlbum.artist,
        maxConcurrent: 3,
        pageTimeout: 30000,
      })

      cleanupProgress()

      if (response.success) {
        setDiscographyScanResults(response.scanResults)
        if (response.matchCount > 0) {
          addActivityLog(
            `Found "${selectedAlbum.title}" in ${response.matchCount} of ${response.totalScanned} pages`,
            'success'
          )
          toaster.create({
            title: 'Album found!',
            description: `"${selectedAlbum.title}" found in ${response.matchCount} discography pages`,
            type: 'success',
            duration: 5000,
          })
        } else {
          addActivityLog(`Album not found in ${response.totalScanned} scanned pages`, 'warning')
        }
      } else {
        addActivityLog(response.error || 'Scan failed', 'error')
        stopDiscographyScan()
      }
    } catch (err) {
      cleanupProgress()
      const errorMsg = err instanceof Error ? err.message : 'Scan failed'
      addActivityLog(errorMsg, 'error')
      stopDiscographyScan()
    }
  }, [
    selectedAlbum,
    ruTrackerResults,
    addActivityLog,
    startDiscographyScan,
    setDiscographyScanProgress,
    setDiscographyScanResults,
    stopDiscographyScan,
  ])

  const handleStopDiscographyScan = useCallback(() => {
    addActivityLog('Discography scan stopped by user', 'warning')
    stopDiscographyScan()
  }, [addActivityLog, stopDiscographyScan])

  return { handleStartDiscographyScan, handleStopDiscographyScan }
}
