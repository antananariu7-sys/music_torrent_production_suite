import { describe, it, expect, beforeEach } from '@jest/globals'

import { useTorrentActivityStore } from './torrentActivityStore'

describe('torrentActivityStore', () => {
  beforeEach(() => {
    useTorrentActivityStore.setState({ log: [] })
  })

  describe('addLog', () => {
    it('should append log entry with id, timestamp, message, and type', () => {
      useTorrentActivityStore.getState().addLog('Download started', 'info')

      const log = useTorrentActivityStore.getState().log
      expect(log).toHaveLength(1)
      expect(log[0].message).toBe('Download started')
      expect(log[0].type).toBe('info')
      expect(log[0].id).toBeDefined()
      expect(log[0].timestamp).toBeDefined()
    })

    it('should append multiple entries in order', () => {
      const { addLog } = useTorrentActivityStore.getState()
      addLog('First', 'info')

      useTorrentActivityStore.getState().addLog('Second', 'error')

      const log = useTorrentActivityStore.getState().log
      expect(log).toHaveLength(2)
      expect(log[0].message).toBe('First')
      expect(log[1].message).toBe('Second')
    })

    it('should generate unique ids', () => {
      useTorrentActivityStore.getState().addLog('A', 'info')
      useTorrentActivityStore.getState().addLog('B', 'info')

      const log = useTorrentActivityStore.getState().log
      expect(log[0].id).not.toBe(log[1].id)
    })
  })

  describe('clearLog', () => {
    it('should empty the log', () => {
      useTorrentActivityStore.getState().addLog('entry', 'info')
      expect(useTorrentActivityStore.getState().log).toHaveLength(1)

      useTorrentActivityStore.getState().clearLog()

      expect(useTorrentActivityStore.getState().log).toEqual([])
    })
  })
})
