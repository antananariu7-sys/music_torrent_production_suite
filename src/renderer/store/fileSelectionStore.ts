import { create } from 'zustand'
import type { TorrentContentFile } from '@shared/types/torrent.types'

interface FileSelectionState {
  isOpen: boolean
  torrentId: string | null
  torrentName: string
  files: TorrentContentFile[]
  openFileSelection: (torrentId: string, torrentName: string, files: TorrentContentFile[]) => void
  closeFileSelection: () => void
}

export const useFileSelectionStore = create<FileSelectionState>((set) => ({
  isOpen: false,
  torrentId: null,
  torrentName: '',
  files: [],

  openFileSelection: (torrentId, torrentName, files) =>
    set({
      isOpen: true,
      torrentId,
      torrentName,
      files,
    }),

  closeFileSelection: () =>
    set({
      isOpen: false,
      torrentId: null,
      torrentName: '',
      files: [],
    }),
}))
