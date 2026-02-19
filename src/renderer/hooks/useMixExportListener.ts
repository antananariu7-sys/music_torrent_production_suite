import { useEffect } from 'react'
import { useMixExportStore } from '@/store/mixExportStore'

/**
 * Hook that subscribes to mix export progress events from the main process
 * and feeds them into the mix export store.
 *
 * Mount this once at the MixTab component level.
 */
export function useMixExportListener(): void {
  const applyProgress = useMixExportStore((s) => s.applyProgress)

  useEffect(() => {
    const cleanup = window.api.mixExport.onProgress((progress) => {
      applyProgress(progress)
    })

    return cleanup
  }, [applyProgress])
}
