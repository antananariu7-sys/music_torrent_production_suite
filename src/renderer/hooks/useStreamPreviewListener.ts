import { useEffect } from 'react'
import { useStreamPreviewStore } from '@/store/streamPreviewStore'

/**
 * Hook that subscribes to stream preview IPC events from the main process
 * and feeds them into the streamPreviewStore.
 *
 * Mount this once at App level for cross-page access.
 */
export function useStreamPreviewListener(): void {
  const setBuffering = useStreamPreviewStore((s) => s.setBuffering)
  const setReady = useStreamPreviewStore((s) => s.setReady)
  const setFullReady = useStreamPreviewStore((s) => s.setFullReady)
  const setError = useStreamPreviewStore((s) => s.setError)

  useEffect(() => {
    const cleanupReady = window.api.streamPreview.onReady((event) => {
      setReady(
        event.dataUrl,
        event.trackName,
        !!event.isPartial,
        event.bufferFraction
      )
    })

    const cleanupFullReady = window.api.streamPreview.onFullReady((event) => {
      setFullReady(event.dataUrl)
    })

    const cleanupBuffering = window.api.streamPreview.onBuffering((event) => {
      setBuffering(event.progress)
    })

    const cleanupError = window.api.streamPreview.onError((event) => {
      setError(event.error)
    })

    return () => {
      cleanupReady()
      cleanupFullReady()
      cleanupBuffering()
      cleanupError()
    }
  }, [setBuffering, setReady, setFullReady, setError])
}
