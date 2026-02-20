import { create } from 'zustand'
import type { WaveformData } from '@shared/types/waveform.types'

interface TimelineState {
  // Waveform data cache
  waveformCache: Record<string, WaveformData>
  isLoadingWaveforms: boolean
  loadingProgress: { current: number; total: number } | null

  // Selection & navigation
  selectedTrackId: string | null
  zoomLevel: number
  scrollPosition: number
  viewportWidth: number

  // Actions
  setWaveform: (songId: string, data: WaveformData) => void
  setWaveforms: (data: WaveformData[]) => void
  setLoading: (loading: boolean) => void
  setProgress: (current: number, total: number) => void
  setSelectedTrack: (songId: string | null) => void
  setZoomLevel: (level: number) => void
  setScrollPosition: (pos: number) => void
  setViewportWidth: (width: number) => void
  zoomIn: () => void
  zoomOut: () => void
  clearCache: () => void
}

export const useTimelineStore = create<TimelineState>((set) => ({
  waveformCache: {},
  isLoadingWaveforms: false,
  loadingProgress: null,
  selectedTrackId: null,
  zoomLevel: 1,
  scrollPosition: 0,
  viewportWidth: 0,

  setWaveform: (songId, data) =>
    set((state) => ({
      waveformCache: { ...state.waveformCache, [songId]: data },
    })),

  setWaveforms: (data) =>
    set(() => {
      const cache: Record<string, WaveformData> = {}
      for (const d of data) {
        cache[d.songId] = d
      }
      return { waveformCache: cache }
    }),

  setLoading: (loading) =>
    set({ isLoadingWaveforms: loading, ...(loading ? {} : { loadingProgress: null }) }),

  setProgress: (current, total) =>
    set({ loadingProgress: { current, total } }),

  setSelectedTrack: (songId) => set({ selectedTrackId: songId }),
  setZoomLevel: (level) => set({ zoomLevel: Math.max(1, Math.min(50, level)) }),
  setScrollPosition: (pos) => set({ scrollPosition: pos }),
  setViewportWidth: (width) => set({ viewportWidth: width }),
  zoomIn: () => set((s) => ({ zoomLevel: Math.min(50, s.zoomLevel * 1.3) })),
  zoomOut: () => set((s) => ({ zoomLevel: Math.max(1, s.zoomLevel / 1.3) })),

  clearCache: () =>
    set({
      waveformCache: {},
      isLoadingWaveforms: false,
      loadingProgress: null,
      selectedTrackId: null,
    }),
}))
