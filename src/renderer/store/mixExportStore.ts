import { create } from 'zustand'
import type { MixExportRequest, MixExportProgress } from '@shared/types/mixExport.types'

const TERMINAL_PHASES = new Set(['complete', 'error', 'cancelled'])

interface MixExportState {
  isExporting: boolean
  progress: MixExportProgress | null

  // Actions
  startExport: (request: MixExportRequest) => Promise<void>
  cancelExport: () => Promise<void>
  applyProgress: (progress: MixExportProgress) => void
  reset: () => void
}

export const useMixExportStore = create<MixExportState>((set) => ({
  isExporting: false,
  progress: null,

  startExport: async (request: MixExportRequest) => {
    set({ isExporting: true, progress: null })
    try {
      const response = await window.api.mixExport.start(request)
      if (!response.success) {
        set({
          isExporting: false,
          progress: {
            phase: 'error',
            currentTrackIndex: 0,
            currentTrackName: '',
            totalTracks: 0,
            percentage: 0,
            error: response.error ?? 'Failed to start export',
          },
        })
      }
    } catch (err) {
      console.error('[mixExportStore] Start failed:', err)
      set({
        isExporting: false,
        progress: {
          phase: 'error',
          currentTrackIndex: 0,
          currentTrackName: '',
          totalTracks: 0,
          percentage: 0,
          error: err instanceof Error ? err.message : 'Failed to start export',
        },
      })
    }
  },

  cancelExport: async () => {
    try {
      await window.api.mixExport.cancel()
    } catch (err) {
      console.error('[mixExportStore] Cancel failed:', err)
    }
  },

  applyProgress: (progress: MixExportProgress) => {
    set({
      progress,
      isExporting: !TERMINAL_PHASES.has(progress.phase),
    })
  },

  reset: () => {
    set({ isExporting: false, progress: null })
  },
}))
