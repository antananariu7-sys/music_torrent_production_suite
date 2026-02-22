import { describe, it, expect, beforeEach } from '@jest/globals'

// Mock the TimelineLayout constants
jest.mock('@/components/features/timeline/TimelineLayout', () => ({
  MIN_ZOOM: 1,
  MAX_ZOOM: 10,
}))

import { useTimelineStore } from './timelineStore'
import type { WaveformData } from '@shared/types/waveform.types'

function makeWaveformData(songId: string): WaveformData {
  return {
    songId,
    peaks: [0.1, 0.5, 0.3],
    duration: 180,
    sampleRate: 44100,
  } as WaveformData
}

describe('timelineStore', () => {
  beforeEach(() => {
    useTimelineStore.setState({
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
    })
  })

  describe('setWaveform', () => {
    it('should add waveform to cache by songId', () => {
      const data = makeWaveformData('song-1')
      useTimelineStore.getState().setWaveform('song-1', data)

      expect(useTimelineStore.getState().waveformCache['song-1']).toEqual(data)
    })

    it('should preserve existing cache entries', () => {
      const d1 = makeWaveformData('song-1')
      const d2 = makeWaveformData('song-2')
      useTimelineStore.getState().setWaveform('song-1', d1)
      useTimelineStore.getState().setWaveform('song-2', d2)

      const cache = useTimelineStore.getState().waveformCache
      expect(cache['song-1']).toEqual(d1)
      expect(cache['song-2']).toEqual(d2)
    })
  })

  describe('setWaveforms', () => {
    it('should replace entire cache with new data', () => {
      useTimelineStore.setState({
        waveformCache: { old: makeWaveformData('old') },
      })

      const data = [makeWaveformData('new-1'), makeWaveformData('new-2')]
      useTimelineStore.getState().setWaveforms(data)

      const cache = useTimelineStore.getState().waveformCache
      expect(cache['old']).toBeUndefined()
      expect(cache['new-1']).toBeDefined()
      expect(cache['new-2']).toBeDefined()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      useTimelineStore.getState().setLoading(true)
      expect(useTimelineStore.getState().isLoadingWaveforms).toBe(true)
    })

    it('should clear progress when loading ends', () => {
      useTimelineStore.setState({
        isLoadingWaveforms: true,
        loadingProgress: { current: 3, total: 5 },
      })

      useTimelineStore.getState().setLoading(false)

      expect(useTimelineStore.getState().isLoadingWaveforms).toBe(false)
      expect(useTimelineStore.getState().loadingProgress).toBeNull()
    })

    it('should preserve progress when loading starts', () => {
      useTimelineStore.setState({
        loadingProgress: { current: 1, total: 5 },
      })

      useTimelineStore.getState().setLoading(true)

      expect(useTimelineStore.getState().loadingProgress).toEqual({
        current: 1,
        total: 5,
      })
    })
  })

  describe('setProgress', () => {
    it('should set loading progress', () => {
      useTimelineStore.getState().setProgress(3, 10)
      expect(useTimelineStore.getState().loadingProgress).toEqual({
        current: 3,
        total: 10,
      })
    })
  })

  describe('setZoomLevel', () => {
    it('should clamp zoom to MIN_ZOOM', () => {
      useTimelineStore.getState().setZoomLevel(0.1)
      expect(useTimelineStore.getState().zoomLevel).toBe(1) // MIN_ZOOM
    })

    it('should clamp zoom to MAX_ZOOM', () => {
      useTimelineStore.getState().setZoomLevel(100)
      expect(useTimelineStore.getState().zoomLevel).toBe(10) // MAX_ZOOM
    })

    it('should set valid zoom level', () => {
      useTimelineStore.getState().setZoomLevel(5)
      expect(useTimelineStore.getState().zoomLevel).toBe(5)
    })
  })

  describe('zoomIn', () => {
    it('should multiply zoom by 1.3', () => {
      useTimelineStore.setState({ zoomLevel: 2 })
      useTimelineStore.getState().zoomIn()
      expect(useTimelineStore.getState().zoomLevel).toBeCloseTo(2.6)
    })

    it('should not exceed MAX_ZOOM', () => {
      useTimelineStore.setState({ zoomLevel: 9 })
      useTimelineStore.getState().zoomIn()
      expect(useTimelineStore.getState().zoomLevel).toBe(10)
    })
  })

  describe('zoomOut', () => {
    it('should divide zoom by 1.3', () => {
      useTimelineStore.setState({ zoomLevel: 2.6 })
      useTimelineStore.getState().zoomOut()
      expect(useTimelineStore.getState().zoomLevel).toBeCloseTo(2)
    })

    it('should not go below MIN_ZOOM', () => {
      useTimelineStore.setState({ zoomLevel: 1 })
      useTimelineStore.getState().zoomOut()
      expect(useTimelineStore.getState().zoomLevel).toBe(1)
    })
  })

  describe('popovers', () => {
    it('opening crossfade popover should close cue point popover', () => {
      useTimelineStore.setState({
        activeCuePointPopover: {
          songId: 's1',
          timestamp: 10,
          position: { x: 0, y: 0 },
        },
      })

      useTimelineStore.getState().openCrossfadePopover('s2', { x: 100, y: 200 })

      const state = useTimelineStore.getState()
      expect(state.activeCrossfadePopover).toEqual({
        songId: 's2',
        position: { x: 100, y: 200 },
      })
      expect(state.activeCuePointPopover).toBeNull()
    })

    it('opening cue point popover should close crossfade popover', () => {
      useTimelineStore.setState({
        activeCrossfadePopover: { songId: 's1', position: { x: 0, y: 0 } },
      })

      useTimelineStore
        .getState()
        .openCuePointPopover('s2', 30, { x: 100, y: 200 })

      const state = useTimelineStore.getState()
      expect(state.activeCuePointPopover).toEqual({
        songId: 's2',
        timestamp: 30,
        cuePoint: undefined,
        position: { x: 100, y: 200 },
      })
      expect(state.activeCrossfadePopover).toBeNull()
    })

    it('closeCrossfadePopover should clear it', () => {
      useTimelineStore.setState({
        activeCrossfadePopover: { songId: 's1', position: { x: 0, y: 0 } },
      })

      useTimelineStore.getState().closeCrossfadePopover()

      expect(useTimelineStore.getState().activeCrossfadePopover).toBeNull()
    })

    it('closeCuePointPopover should clear it', () => {
      useTimelineStore.setState({
        activeCuePointPopover: {
          songId: 's1',
          timestamp: 10,
          position: { x: 0, y: 0 },
        },
      })

      useTimelineStore.getState().closeCuePointPopover()

      expect(useTimelineStore.getState().activeCuePointPopover).toBeNull()
    })
  })

  describe('toggles', () => {
    it('toggleSnapMode should alternate between off and beat', () => {
      expect(useTimelineStore.getState().snapMode).toBe('off')

      useTimelineStore.getState().toggleSnapMode()
      expect(useTimelineStore.getState().snapMode).toBe('beat')

      useTimelineStore.getState().toggleSnapMode()
      expect(useTimelineStore.getState().snapMode).toBe('off')
    })

    it('toggleFrequencyColorMode should toggle boolean', () => {
      expect(useTimelineStore.getState().frequencyColorMode).toBe(false)

      useTimelineStore.getState().toggleFrequencyColorMode()
      expect(useTimelineStore.getState().frequencyColorMode).toBe(true)

      useTimelineStore.getState().toggleFrequencyColorMode()
      expect(useTimelineStore.getState().frequencyColorMode).toBe(false)
    })

    it('toggleBeatGrid should toggle boolean', () => {
      expect(useTimelineStore.getState().showBeatGrid).toBe(false)

      useTimelineStore.getState().toggleBeatGrid()
      expect(useTimelineStore.getState().showBeatGrid).toBe(true)
    })
  })

  describe('clearCache', () => {
    it('should reset waveform cache and related state', () => {
      useTimelineStore.setState({
        waveformCache: { s1: makeWaveformData('s1') },
        isLoadingWaveforms: true,
        loadingProgress: { current: 3, total: 5 },
        selectedTrackId: 's1',
      })

      useTimelineStore.getState().clearCache()

      const state = useTimelineStore.getState()
      expect(state.waveformCache).toEqual({})
      expect(state.isLoadingWaveforms).toBe(false)
      expect(state.loadingProgress).toBeNull()
      expect(state.selectedTrackId).toBeNull()
    })
  })

  describe('dragState', () => {
    it('should set drag state and close popovers', () => {
      useTimelineStore.setState({
        activeCrossfadePopover: { songId: 's1', position: { x: 0, y: 0 } },
        activeCuePointPopover: {
          songId: 's2',
          timestamp: 10,
          position: { x: 50, y: 50 },
        },
      })

      const drag = {
        type: 'trim-start' as const,
        songId: 's1',
        startX: 100,
        initialValue: 5,
      }
      useTimelineStore.getState().setDragState(drag)

      const state = useTimelineStore.getState()
      expect(state.dragState).toEqual(drag)
      expect(state.activeCrossfadePopover).toBeNull()
      expect(state.activeCuePointPopover).toBeNull()
    })

    it('should clear drag state', () => {
      useTimelineStore.getState().setDragState({
        type: 'trim-end',
        songId: 's1',
        startX: 200,
        initialValue: 30,
      })

      useTimelineStore.getState().clearDragState()

      expect(useTimelineStore.getState().dragState).toBeNull()
    })
  })
})
