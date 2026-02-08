import { create } from 'zustand'
import type { TorrentActivityLogEntry } from '@shared/types/torrent.types'

interface TorrentActivityState {
  log: TorrentActivityLogEntry[]
  addLog: (message: string, type: TorrentActivityLogEntry['type']) => void
  clearLog: () => void
}

export const useTorrentActivityStore = create<TorrentActivityState>((set) => ({
  log: [],

  addLog: (message, type) =>
    set((state) => ({
      log: [
        ...state.log,
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          message,
          type,
        },
      ],
    })),

  clearLog: () => set({ log: [] }),
}))

/** Selector hook for the activity log array */
export const useTorrentActivityLog = () =>
  useTorrentActivityStore((state) => state.log)
