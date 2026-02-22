import { create } from 'zustand'
import type { WaveformData, CuePoint } from '@shared/types/waveform.types'
import {
  MIN_ZOOM,
  MAX_ZOOM,
} from '@/components/features/timeline/TimelineLayout'

interface PopoverPosition {
  x: number
  y: number
}

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

  // Snap mode
  snapMode: 'off' | 'beat'

  // Waveform display options
  frequencyColorMode: boolean
  showBeatGrid: boolean

  // Drag interaction tracking
  dragState: {
    type: 'trim-start' | 'trim-end' | 'cue-point'
    songId: string
    startX: number
    initialValue: number
  } | null

  // Editing popovers
  activeCrossfadePopover: { songId: string; position: PopoverPosition } | null
  activeCuePointPopover: {
    songId: string
    timestamp: number
    cuePoint?: CuePoint
    position: PopoverPosition
  } | null

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
  openCrossfadePopover: (songId: string, position: PopoverPosition) => void
  closeCrossfadePopover: () => void
  openCuePointPopover: (
    songId: string,
    timestamp: number,
    position: PopoverPosition,
    cuePoint?: CuePoint
  ) => void
  closeCuePointPopover: () => void
  setDragState: (state: TimelineState['dragState']) => void
  clearDragState: () => void
  toggleSnapMode: () => void
  toggleFrequencyColorMode: () => void
  toggleBeatGrid: () => void
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
  snapMode: 'off',
  dragState: null,
  frequencyColorMode: false,
  showBeatGrid: false,
  activeCrossfadePopover: null,
  activeCuePointPopover: null,

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
    set({
      isLoadingWaveforms: loading,
      ...(loading ? {} : { loadingProgress: null }),
    }),

  setProgress: (current, total) => set({ loadingProgress: { current, total } }),

  setSelectedTrack: (songId) => set({ selectedTrackId: songId }),
  setZoomLevel: (level) =>
    set({ zoomLevel: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level)) }),
  setScrollPosition: (pos) => set({ scrollPosition: pos }),
  setViewportWidth: (width) => set({ viewportWidth: width }),
  zoomIn: () =>
    set((s) => ({ zoomLevel: Math.min(MAX_ZOOM, s.zoomLevel * 1.3) })),
  zoomOut: () =>
    set((s) => ({ zoomLevel: Math.max(MIN_ZOOM, s.zoomLevel / 1.3) })),

  openCrossfadePopover: (songId, position) =>
    set({
      activeCrossfadePopover: { songId, position },
      activeCuePointPopover: null,
    }),
  closeCrossfadePopover: () => set({ activeCrossfadePopover: null }),
  openCuePointPopover: (songId, timestamp, position, cuePoint) =>
    set({
      activeCuePointPopover: { songId, timestamp, cuePoint, position },
      activeCrossfadePopover: null,
    }),
  closeCuePointPopover: () => set({ activeCuePointPopover: null }),

  setDragState: (dragState) =>
    set({
      dragState,
      activeCrossfadePopover: null,
      activeCuePointPopover: null,
    }),
  clearDragState: () => set({ dragState: null }),

  toggleSnapMode: () =>
    set((s) => ({ snapMode: s.snapMode === 'off' ? 'beat' : 'off' })),
  toggleFrequencyColorMode: () =>
    set((s) => ({ frequencyColorMode: !s.frequencyColorMode })),
  toggleBeatGrid: () => set((s) => ({ showBeatGrid: !s.showBeatGrid })),

  clearCache: () =>
    set({
      waveformCache: {},
      isLoadingWaveforms: false,
      loadingProgress: null,
      selectedTrackId: null,
    }),
}))
