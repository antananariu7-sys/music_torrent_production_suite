import { useState, useCallback } from 'react'
import type { TorrentPageMetadata } from '@shared/types/torrentMetadata.types'

interface UseCollectedItemPreviewReturn {
  previewState: 'idle' | 'loading' | 'loaded' | 'error'
  previewMetadata: TorrentPageMetadata | null
  previewError: string
  isPreviewExpanded: boolean
  handlePreviewClick: () => Promise<void>
}

/**
 * useCollectedItemPreview
 *
 * Manages lazy-loading and toggling of the torrent track list preview.
 */
export function useCollectedItemPreview(torrentPageUrl: string, torrentId: string): UseCollectedItemPreviewReturn {
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [previewMetadata, setPreviewMetadata] = useState<TorrentPageMetadata | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const handlePreviewClick = useCallback(async () => {
    if (previewState === 'loaded') {
      setIsPreviewExpanded(!isPreviewExpanded)
      return
    }

    setPreviewState('loading')
    setIsPreviewExpanded(true)

    try {
      const response = await window.api.torrentMetadata.parse({
        torrentUrl: torrentPageUrl,
        torrentId,
      })
      if (response.success && response.metadata) {
        setPreviewMetadata(response.metadata)
        setPreviewState('loaded')
      } else {
        setPreviewError(response.error || 'Unknown error')
        setPreviewState('error')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load')
      setPreviewState('error')
    }
  }, [torrentPageUrl, torrentId, previewState, isPreviewExpanded])

  return { previewState, previewMetadata, previewError, isPreviewExpanded, handlePreviewClick }
}
