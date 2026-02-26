import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import type { CuePoint } from '@shared/types/waveform.types'
import type { Song } from '@shared/types/project.types'

interface UseCuePointDragOptions {
  songs: Song[]
  handleTrimStartDrag: (songId: string, newTimestamp: number) => void
  handleTrimEndDrag: (songId: string, newTimestamp: number) => void
  clearTrimPreview: (songId: string) => void
}

export function useCuePointDrag({
  songs,
  handleTrimStartDrag,
  handleTrimEndDrag,
  clearTrimPreview,
}: UseCuePointDragOptions) {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)

  // Maps songId → cuePointId → preview timestamp
  const [previewCuePoints, setPreviewCuePoints] = useState<
    Record<string, Record<string, number>>
  >({})

  const cuePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (cuePersistRef.current) clearTimeout(cuePersistRef.current)
    }
  }, [])

  const handleCuePointDrag = useCallback(
    (songId: string, cuePoint: CuePoint, newTimestamp: number) => {
      setPreviewCuePoints((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], [cuePoint.id]: newTimestamp },
      }))

      // If trim-type, also update trim preview
      if (cuePoint.type === 'trim-start') {
        handleTrimStartDrag(songId, newTimestamp)
      } else if (cuePoint.type === 'trim-end') {
        handleTrimEndDrag(songId, newTimestamp)
      }
    },
    [handleTrimStartDrag, handleTrimEndDrag]
  )

  const handleCuePointDragEnd = useCallback(
    (songId: string, cuePoint: CuePoint, newTimestamp: number) => {
      // Clear cue point preview
      setPreviewCuePoints((prev) => {
        const next = { ...prev }
        if (next[songId]) {
          const songCues = { ...next[songId] }
          delete songCues[cuePoint.id]
          if (Object.keys(songCues).length === 0) {
            delete next[songId]
          } else {
            next[songId] = songCues
          }
        }
        return next
      })

      // Clear trim preview if trim-type
      if (cuePoint.type === 'trim-start' || cuePoint.type === 'trim-end') {
        clearTrimPreview(songId)
      }

      if (!currentProject) return

      // Build updated cue points + trim fields
      const song = songs.find((s) => s.id === songId)
      if (!song) return

      const updatedCuePoints = (song.cuePoints ?? []).map((cp) =>
        cp.id === cuePoint.id ? { ...cp, timestamp: newTimestamp } : cp
      )

      const updates: Partial<Song> = { cuePoints: updatedCuePoints }
      // Sync trim fields for trim-type cue points
      if (cuePoint.type === 'trim-start') {
        updates.trimStart = newTimestamp
      } else if (cuePoint.type === 'trim-end') {
        updates.trimEnd = newTimestamp
      }

      if (cuePersistRef.current) clearTimeout(cuePersistRef.current)
      cuePersistRef.current = setTimeout(async () => {
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
    [currentProject, setCurrentProject, songs, clearTrimPreview]
  )

  return {
    previewCuePoints,
    handleCuePointDrag,
    handleCuePointDragEnd,
  }
}
