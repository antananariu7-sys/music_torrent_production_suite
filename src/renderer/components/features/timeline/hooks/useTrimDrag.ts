import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '@/store/useProjectStore'

export function useTrimDrag() {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)

  const [previewTrims, setPreviewTrims] = useState<
    Record<string, { trimStart?: number; trimEnd?: number }>
  >({})
  const previewTrimsRef = useRef(previewTrims)
  previewTrimsRef.current = previewTrims

  const trimPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (trimPersistRef.current) clearTimeout(trimPersistRef.current)
    }
  }, [])

  const handleTrimStartDrag = useCallback(
    (songId: string, newTimestamp: number) => {
      setPreviewTrims((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], trimStart: newTimestamp },
      }))
    },
    []
  )

  const handleTrimEndDrag = useCallback(
    (songId: string, newTimestamp: number) => {
      setPreviewTrims((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], trimEnd: newTimestamp },
      }))
    },
    []
  )

  const handleTrimDragEnd = useCallback(
    (songId: string) => {
      const preview = previewTrimsRef.current[songId]
      if (!preview || !currentProject) return

      // Clear preview state
      setPreviewTrims((prev) => {
        const next = { ...prev }
        delete next[songId]
        return next
      })

      // Debounced persistence
      if (trimPersistRef.current) clearTimeout(trimPersistRef.current)
      const updates: Partial<{ trimStart: number; trimEnd: number }> = {}
      if (preview.trimStart !== undefined) updates.trimStart = preview.trimStart
      if (preview.trimEnd !== undefined) updates.trimEnd = preview.trimEnd

      trimPersistRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId: currentProject.id,
          songId,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, 300)
    },
    [currentProject, setCurrentProject]
  )

  const clearTrimPreview = useCallback((songId: string) => {
    setPreviewTrims((prev) => {
      const next = { ...prev }
      delete next[songId]
      return next
    })
  }, [])

  return {
    previewTrims,
    handleTrimStartDrag,
    handleTrimEndDrag,
    handleTrimDragEnd,
    clearTrimPreview,
  }
}
