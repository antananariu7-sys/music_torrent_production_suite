import { create } from 'zustand'
import type { CollectedTorrent } from '@shared/types/torrent.types'
import type { SearchResult } from '@shared/types/search.types'

interface TorrentCollectionState {
  // Collection of torrents per project
  collections: Record<string, CollectedTorrent[]>

  // Project context for persistence
  projectId?: string
  projectName?: string
  projectDirectory?: string

  // Actions
  setProjectContext: (projectId: string, projectName: string, projectDirectory: string) => void
  loadCollectionFromProject: (projectId: string, projectDirectory: string) => Promise<void>
  addToCollection: (torrent: SearchResult) => void
  removeFromCollection: (torrentId: string) => void
  clearCollection: () => void
  getCollection: () => CollectedTorrent[]
}

/**
 * Helper function to save collection to disk via IPC
 */
async function saveCollectionToDisk(
  collection: CollectedTorrent[],
  projectId?: string,
  projectName?: string,
  projectDirectory?: string
): Promise<void> {
  if (!projectId || !projectName || !projectDirectory) {
    console.warn('[torrentCollectionStore] Cannot save: missing project info')
    return
  }

  try {
    await window.api.torrentCollection.save({
      projectId,
      projectName,
      projectDirectory,
      torrents: collection,
    })

    console.log(`[torrentCollectionStore] Saved ${collection.length} torrents to ${projectDirectory}`)
  } catch (error) {
    console.error('[torrentCollectionStore] Failed to save collection:', error)
  }
}

/**
 * Helper function to load collection from disk via IPC
 */
async function loadCollectionFromDisk(
  projectId: string,
  projectDirectory: string
): Promise<CollectedTorrent[]> {
  try {
    const response = await window.api.torrentCollection.load({
      projectId,
      projectDirectory,
    })

    if (response.success && response.torrents) {
      return response.torrents
    }

    return []
  } catch (error) {
    console.error('[torrentCollectionStore] Failed to load collection:', error)
    return []
  }
}

export const useTorrentCollectionStore = create<TorrentCollectionState>((set, get) => ({
  collections: {},
  projectId: undefined,
  projectName: undefined,
  projectDirectory: undefined,

  setProjectContext: (projectId: string, projectName: string, projectDirectory: string) =>
    set({ projectId, projectName, projectDirectory }),

  loadCollectionFromProject: async (projectId: string, projectDirectory: string) => {
    const collection = await loadCollectionFromDisk(projectId, projectDirectory)
    set((state) => ({
      collections: {
        ...state.collections,
        [projectId]: collection,
      },
    }))
  },

  addToCollection: (torrent: SearchResult) => {
    const { projectId, projectName, projectDirectory, collections } = get()

    if (!projectId) {
      console.warn('[torrentCollectionStore] Cannot add: no project context')
      return
    }

    const currentCollection = collections[projectId] || []

    // Check for duplicates
    if (currentCollection.some((t) => t.torrentId === torrent.id)) {
      console.warn('[torrentCollectionStore] Torrent already in collection')
      return
    }

    const collectedTorrent: CollectedTorrent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      torrentId: torrent.id,
      magnetLink: '', // Magnet link will be fetched during download
      title: torrent.title,
      pageUrl: torrent.url,
      addedAt: new Date().toISOString(),
      metadata: {
        size: torrent.size,
        sizeBytes: torrent.sizeBytes,
        seeders: torrent.seeders,
        leechers: torrent.leechers,
        category: torrent.category,
      },
      projectId,
    }

    const newCollection = [collectedTorrent, ...currentCollection]

    set((state) => ({
      collections: {
        ...state.collections,
        [projectId]: newCollection,
      },
    }))

    // Auto-save to disk
    saveCollectionToDisk(newCollection, projectId, projectName, projectDirectory)
  },

  removeFromCollection: (torrentId: string) => {
    const { projectId, projectName, projectDirectory, collections } = get()

    if (!projectId) {
      return
    }

    const currentCollection = collections[projectId] || []
    const newCollection = currentCollection.filter((t) => t.id !== torrentId)

    set((state) => ({
      collections: {
        ...state.collections,
        [projectId]: newCollection,
      },
    }))

    // Auto-save to disk
    saveCollectionToDisk(newCollection, projectId, projectName, projectDirectory)
  },

  clearCollection: () => {
    const { projectId, projectName, projectDirectory } = get()

    if (!projectId) {
      return
    }

    set((state) => ({
      collections: {
        ...state.collections,
        [projectId]: [],
      },
    }))

    // Auto-save to disk (empty collection)
    saveCollectionToDisk([], projectId, projectName, projectDirectory)
  },

  getCollection: () => {
    const { projectId, collections } = get()
    if (!projectId) {
      return []
    }
    return collections[projectId] || []
  },
}))

// Selector hooks
export const useCollection = () => {
  const projectId = useTorrentCollectionStore((state) => state.projectId)
  const collections = useTorrentCollectionStore((state) => state.collections)
  return projectId ? collections[projectId] || [] : []
}

export const useCollectionCount = () => {
  const collection = useCollection()
  return collection.length
}
