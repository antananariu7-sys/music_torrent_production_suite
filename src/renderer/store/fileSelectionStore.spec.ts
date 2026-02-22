import { describe, it, expect, beforeEach } from '@jest/globals'

import { useFileSelectionStore } from './fileSelectionStore'

describe('fileSelectionStore', () => {
  beforeEach(() => {
    useFileSelectionStore.setState({
      isOpen: false,
      torrentId: null,
      torrentName: '',
      files: [],
    })
  })

  describe('openFileSelection', () => {
    it('should populate state and set isOpen', () => {
      const files = [{ path: 'track1.flac', size: 50000 }] as any[]

      useFileSelectionStore
        .getState()
        .openFileSelection('t1', 'My Torrent', files)

      const state = useFileSelectionStore.getState()
      expect(state.isOpen).toBe(true)
      expect(state.torrentId).toBe('t1')
      expect(state.torrentName).toBe('My Torrent')
      expect(state.files).toEqual(files)
    })
  })

  describe('closeFileSelection', () => {
    it('should reset all fields', () => {
      useFileSelectionStore.setState({
        isOpen: true,
        torrentId: 't1',
        torrentName: 'Torrent',
        files: [{ path: 'file.flac' }] as any[],
      })

      useFileSelectionStore.getState().closeFileSelection()

      const state = useFileSelectionStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.torrentId).toBeNull()
      expect(state.torrentName).toBe('')
      expect(state.files).toEqual([])
    })
  })
})
