import { useEffect } from 'react'
import { useDownloadQueueStore } from '@/store/downloadQueueStore'

/**
 * Hook that subscribes to WebTorrent progress and status change events
 * from the main process and feeds them into the download queue store.
 *
 * Mount this once at the DownloadQueue component level.
 */
export function useDownloadQueueListener(): void {
  const applyProgressUpdates = useDownloadQueueStore((s) => s.applyProgressUpdates)
  const applyStatusChange = useDownloadQueueStore((s) => s.applyStatusChange)

  useEffect(() => {
    const cleanupProgress = window.api.webtorrent.onProgress((updates) => {
      applyProgressUpdates(updates)
    })

    const cleanupStatus = window.api.webtorrent.onStatusChange((torrent) => {
      applyStatusChange(torrent)
    })

    return () => {
      cleanupProgress()
      cleanupStatus()
    }
  }, [applyProgressUpdates, applyStatusChange])
}
