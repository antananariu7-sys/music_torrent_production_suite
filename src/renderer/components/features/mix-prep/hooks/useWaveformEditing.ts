import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { AudioRegion } from '@shared/types/project.types'
import { useProjectStore } from '@/store/useProjectStore'

const SAVE_DEBOUNCE_MS = 400

interface UseWaveformEditingOptions {
  projectId: string
  songId: string | undefined
  initialRegions?: AudioRegion[]
}

interface UseWaveformEditingReturn {
  regions: AudioRegion[]
  addRegion: (startTime: number, endTime: number) => void
  deleteRegion: (regionId: string) => void
  toggleRegion: (regionId: string) => void
  clearAllRegions: () => void
  /** Only enabled regions, sorted by startTime */
  activeRegions: AudioRegion[]
}

/**
 * Merge overlapping enabled regions into non-overlapping set.
 * Keeps disabled regions unchanged.
 */
function mergeOverlapping(regions: AudioRegion[]): AudioRegion[] {
  const enabled = regions
    .filter((r) => r.enabled)
    .sort((a, b) => a.startTime - b.startTime)
  const disabled = regions.filter((r) => !r.enabled)

  const merged: AudioRegion[] = []
  for (const r of enabled) {
    const last = merged[merged.length - 1]
    if (last && r.startTime <= last.endTime) {
      last.endTime = Math.max(last.endTime, r.endTime)
    } else {
      merged.push({ ...r })
    }
  }

  return [...merged, ...disabled]
}

/**
 * Manages non-destructive waveform editing regions with debounced persistence.
 */
export function useWaveformEditing({
  projectId,
  songId,
  initialRegions,
}: UseWaveformEditingOptions): UseWaveformEditingReturn {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)

  const [regions, setRegionsState] = useState<AudioRegion[]>(
    initialRegions ?? []
  )

  // Sync from props when song changes
  useEffect(() => {
    setRegionsState(initialRegions ?? [])
  }, [songId, initialRegions])

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(
    (nextRegions: AudioRegion[]) => {
      if (!songId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)

      saveTimer.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId,
          songId,
          updates: { regions: nextRegions },
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, SAVE_DEBOUNCE_MS)
    },
    [projectId, songId, setCurrentProject]
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  const addRegion = useCallback(
    (startTime: number, endTime: number) => {
      if (startTime >= endTime) return
      const newRegion: AudioRegion = {
        id: crypto.randomUUID(),
        startTime,
        endTime,
        enabled: true,
      }
      const next = mergeOverlapping([...regions, newRegion])
      setRegionsState(next)
      persist(next)
    },
    [regions, persist]
  )

  const deleteRegion = useCallback(
    (regionId: string) => {
      const next = regions.filter((r) => r.id !== regionId)
      setRegionsState(next)
      persist(next)
    },
    [regions, persist]
  )

  const toggleRegion = useCallback(
    (regionId: string) => {
      const next = regions.map((r) =>
        r.id === regionId ? { ...r, enabled: !r.enabled } : r
      )
      setRegionsState(next)
      persist(next)
    },
    [regions, persist]
  )

  const clearAllRegions = useCallback(() => {
    setRegionsState([])
    persist([])
  }, [persist])

  const activeRegions = useMemo(
    () =>
      regions
        .filter((r) => r.enabled)
        .sort((a, b) => a.startTime - b.startTime),
    [regions]
  )

  return {
    regions,
    addRegion,
    deleteRegion,
    toggleRegion,
    clearAllRegions,
    activeRegions,
  }
}
