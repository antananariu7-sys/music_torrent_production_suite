import { useState, useCallback, useRef, useEffect } from 'react'
import type { VolumePoint } from '@shared/types/project.types'
import { useProjectStore } from '@/store/useProjectStore'

const DEFAULT_ENVELOPE: VolumePoint[] = [{ time: 0, value: 1 }]
const SAVE_DEBOUNCE_MS = 400

interface UseVolumeEnvelopeOptions {
  projectId: string
  songId: string | undefined
  initialEnvelope?: VolumePoint[]
  initialGainDb?: number
}

interface UseVolumeEnvelopeReturn {
  envelope: VolumePoint[]
  gainDb: number
  setEnvelope: (envelope: VolumePoint[]) => void
  setGainDb: (db: number) => void
  resetEnvelope: () => void
}

/**
 * Manages per-track volume envelope and static gain with debounced persistence.
 */
export function useVolumeEnvelope({
  projectId,
  songId,
  initialEnvelope,
  initialGainDb,
}: UseVolumeEnvelopeOptions): UseVolumeEnvelopeReturn {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)

  const [envelope, setEnvelopeState] = useState<VolumePoint[]>(
    initialEnvelope ?? DEFAULT_ENVELOPE
  )
  const [gainDb, setGainDbState] = useState<number>(initialGainDb ?? 0)

  // Sync from props when song changes
  useEffect(() => {
    setEnvelopeState(initialEnvelope ?? DEFAULT_ENVELOPE)
  }, [songId, initialEnvelope])

  useEffect(() => {
    setGainDbState(initialGainDb ?? 0)
  }, [songId, initialGainDb])

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(
    (updates: { volumeEnvelope?: VolumePoint[]; gainDb?: number }) => {
      if (!songId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)

      saveTimer.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId,
          songId,
          updates,
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

  const setEnvelope = useCallback(
    (next: VolumePoint[]) => {
      setEnvelopeState(next)
      persist({ volumeEnvelope: next })
    },
    [persist]
  )

  const setGainDb = useCallback(
    (db: number) => {
      setGainDbState(db)
      persist({ gainDb: db })
    },
    [persist]
  )

  const resetEnvelope = useCallback(() => {
    setEnvelopeState(DEFAULT_ENVELOPE)
    setGainDbState(0)
    persist({ volumeEnvelope: DEFAULT_ENVELOPE, gainDb: 0 })
  }, [persist])

  return { envelope, gainDb, setEnvelope, setGainDb, resetEnvelope }
}
