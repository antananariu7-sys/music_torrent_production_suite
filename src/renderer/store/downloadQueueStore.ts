import { create } from 'zustand'
import type {
  QueuedTorrent,
  QueuedTorrentProgress,
  AddTorrentRequest,
  WebTorrentSettings,
} from '@shared/types/torrent.types'

interface DownloadQueueState {
  /** Map of id -> QueuedTorrent for O(1) lookup */
  torrents: Record<string, QueuedTorrent>
  /** WebTorrent client settings */
  settings: WebTorrentSettings | null
  /** Loading state */
  isLoading: boolean

  // Actions
  loadAll: () => Promise<void>
  loadSettings: () => Promise<void>
  addTorrent: (request: AddTorrentRequest) => Promise<{ success: boolean; error?: string }>
  pauseTorrent: (id: string) => Promise<void>
  resumeTorrent: (id: string) => Promise<void>
  removeTorrent: (id: string) => Promise<void>
  updateSettings: (settings: Partial<WebTorrentSettings>) => Promise<void>

  // Progress update handlers (called from listener)
  applyProgressUpdates: (updates: QueuedTorrentProgress[]) => void
  applyStatusChange: (torrent: QueuedTorrent) => void
}

export const useDownloadQueueStore = create<DownloadQueueState>((set) => ({
  torrents: {},
  settings: null,
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true })
    try {
      const response = await window.api.webtorrent.getAll()
      if (response.success && response.data) {
        const map: Record<string, QueuedTorrent> = {}
        for (const t of response.data) {
          map[t.id] = t
        }
        set({ torrents: map })
      }
    } catch (err) {
      console.error('[downloadQueueStore] Failed to load queue:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  loadSettings: async () => {
    try {
      const response = await window.api.webtorrent.getSettings()
      if (response.success && response.data) {
        set({ settings: response.data })
      }
    } catch (err) {
      console.error('[downloadQueueStore] Failed to load settings:', err)
    }
  },

  addTorrent: async (request: AddTorrentRequest) => {
    try {
      const response = await window.api.webtorrent.add(request)
      if (response.success && response.torrent) {
        set((state) => ({
          torrents: {
            ...state.torrents,
            [response.torrent!.id]: response.torrent!,
          },
        }))
      }
      return { success: response.success, error: response.error }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to add torrent'
      console.error('[downloadQueueStore] Add failed:', error)
      return { success: false, error }
    }
  },

  pauseTorrent: async (id: string) => {
    const response = await window.api.webtorrent.pause(id)
    if (response.success) {
      set((state) => ({
        torrents: {
          ...state.torrents,
          [id]: { ...state.torrents[id], status: 'paused', downloadSpeed: 0, uploadSpeed: 0 },
        },
      }))
    }
  },

  resumeTorrent: async (id: string) => {
    const response = await window.api.webtorrent.resume(id)
    if (response.success) {
      set((state) => ({
        torrents: {
          ...state.torrents,
          [id]: { ...state.torrents[id], status: 'queued', error: undefined },
        },
      }))
    }
  },

  removeTorrent: async (id: string) => {
    const response = await window.api.webtorrent.remove(id)
    if (response.success) {
      set((state) => {
        const torrents = { ...state.torrents }
        delete torrents[id]
        return { torrents }
      })
    }
  },

  updateSettings: async (settings: Partial<WebTorrentSettings>) => {
    const response = await window.api.webtorrent.updateSettings(settings)
    if (response.success && response.data) {
      set({ settings: response.data })
    }
  },

  applyProgressUpdates: (updates: QueuedTorrentProgress[]) => {
    set((state) => {
      const newTorrents = { ...state.torrents }
      for (const update of updates) {
        const existing = newTorrents[update.id]
        if (existing) {
          newTorrents[update.id] = {
            ...existing,
            status: update.status,
            progress: update.progress,
            downloadSpeed: update.downloadSpeed,
            uploadSpeed: update.uploadSpeed,
            downloaded: update.downloaded,
            uploaded: update.uploaded,
            totalSize: update.totalSize,
            seeders: update.seeders,
            leechers: update.leechers,
            ratio: update.ratio,
            files: update.files,
          }
        }
      }
      return { torrents: newTorrents }
    })
  },

  applyStatusChange: (torrent: QueuedTorrent) => {
    set((state) => ({
      torrents: {
        ...state.torrents,
        [torrent.id]: torrent,
      },
    }))
  },
}))

// Selector hooks

/** Get all queued torrents sorted by addedAt (newest first) */
export const useQueuedTorrents = () => {
  const torrents = useDownloadQueueStore((s) => s.torrents)
  return Object.values(torrents).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  )
}

/** Get only active (downloading/seeding) torrents */
export const useActiveTorrents = () => {
  const all = useQueuedTorrents()
  return all.filter(t => t.status === 'downloading' || t.status === 'seeding')
}

/** Count of downloading + queued torrents */
export const useQueuedCount = () => {
  const torrents = useDownloadQueueStore((s) => s.torrents)
  return Object.values(torrents).filter(
    t => t.status === 'downloading' || t.status === 'queued'
  ).length
}
