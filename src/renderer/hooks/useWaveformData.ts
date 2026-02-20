import { useEffect, useRef } from 'react'
import { useTimelineStore } from '@/store/timelineStore'

/**
 * Hook that loads waveform data for all songs in the active project.
 * Subscribes to progress events and caches results in timelineStore.
 */
export function useWaveformData(projectId: string | undefined): void {
  const setWaveforms = useTimelineStore((s) => s.setWaveforms)
  const setLoading = useTimelineStore((s) => s.setLoading)
  const setProgress = useTimelineStore((s) => s.setProgress)
  const loadedProjectRef = useRef<string | null>(null)

  useEffect(() => {
    if (!projectId || loadedProjectRef.current === projectId) return

    loadedProjectRef.current = projectId
    setLoading(true)

    // Subscribe to progress events
    const cleanupProgress = window.api.waveform.onProgress((progress) => {
      setProgress(progress.index + 1, progress.total)
    })

    // Start batch generation
    window.api.waveform.generateBatch({ projectId }).then((response) => {
      if (response.success && response.data) {
        setWaveforms(response.data)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    return () => {
      cleanupProgress()
    }
  }, [projectId, setWaveforms, setLoading, setProgress])
}
