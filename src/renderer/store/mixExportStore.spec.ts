import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockWindowApi = {
  mixExport: {
    start: jest.fn<() => Promise<any>>(),
    cancel: jest.fn<() => Promise<any>>(),
  },
}

;(globalThis as any).window = { api: mockWindowApi }

import { useMixExportStore } from './mixExportStore'
import type { MixExportProgress } from '@shared/types/mixExport.types'

function makeProgress(
  overrides: Partial<MixExportProgress> = {}
): MixExportProgress {
  return {
    phase: 'analyzing',
    currentTrackIndex: 1,
    currentTrackName: 'Track 1',
    totalTracks: 5,
    percentage: 20,
    ...overrides,
  } as MixExportProgress
}

describe('mixExportStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    useMixExportStore.setState({
      isExporting: false,
      progress: null,
    })
  })

  describe('startExport', () => {
    it('should set isExporting on start', async () => {
      mockWindowApi.mixExport.start.mockResolvedValue({
        success: true,
      } as never)

      await useMixExportStore
        .getState()
        .startExport({ outputPath: '/out' } as any)

      expect(useMixExportStore.getState().isExporting).toBe(true)
    })

    it('should set error progress on API failure response', async () => {
      mockWindowApi.mixExport.start.mockResolvedValue({
        success: false,
        error: 'No tracks',
      } as never)

      await useMixExportStore
        .getState()
        .startExport({ outputPath: '/out' } as any)

      const state = useMixExportStore.getState()
      expect(state.isExporting).toBe(false)
      expect(state.progress?.phase).toBe('error')
      expect(state.progress?.error).toBe('No tracks')
    })

    it('should set error progress on exception', async () => {
      mockWindowApi.mixExport.start.mockRejectedValue(
        new Error('Crash') as never
      )

      await useMixExportStore
        .getState()
        .startExport({ outputPath: '/out' } as any)

      const state = useMixExportStore.getState()
      expect(state.isExporting).toBe(false)
      expect(state.progress?.phase).toBe('error')
      expect(state.progress?.error).toBe('Crash')
    })
  })

  describe('cancelExport', () => {
    it('should call IPC cancel', async () => {
      mockWindowApi.mixExport.cancel.mockResolvedValue(undefined as never)

      await useMixExportStore.getState().cancelExport()

      expect(mockWindowApi.mixExport.cancel).toHaveBeenCalled()
    })

    it('should handle cancel failure gracefully', async () => {
      mockWindowApi.mixExport.cancel.mockRejectedValue(
        new Error('fail') as never
      )

      // Should not throw
      await useMixExportStore.getState().cancelExport()
    })
  })

  describe('applyProgress', () => {
    it('should keep isExporting true for non-terminal phases', () => {
      useMixExportStore.setState({ isExporting: true })

      useMixExportStore
        .getState()
        .applyProgress(makeProgress({ phase: 'analyzing' }))

      expect(useMixExportStore.getState().isExporting).toBe(true)
      expect(useMixExportStore.getState().progress?.phase).toBe('analyzing')
    })

    it('should set isExporting false for "complete" phase', () => {
      useMixExportStore.setState({ isExporting: true })

      useMixExportStore
        .getState()
        .applyProgress(makeProgress({ phase: 'complete' }))

      expect(useMixExportStore.getState().isExporting).toBe(false)
    })

    it('should set isExporting false for "error" phase', () => {
      useMixExportStore.setState({ isExporting: true })

      useMixExportStore
        .getState()
        .applyProgress(makeProgress({ phase: 'error' }))

      expect(useMixExportStore.getState().isExporting).toBe(false)
    })

    it('should set isExporting false for "cancelled" phase', () => {
      useMixExportStore.setState({ isExporting: true })

      useMixExportStore
        .getState()
        .applyProgress(makeProgress({ phase: 'cancelled' }))

      expect(useMixExportStore.getState().isExporting).toBe(false)
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      useMixExportStore.setState({
        isExporting: true,
        progress: makeProgress(),
      })

      useMixExportStore.getState().reset()

      expect(useMixExportStore.getState().isExporting).toBe(false)
      expect(useMixExportStore.getState().progress).toBeNull()
    })
  })
})
