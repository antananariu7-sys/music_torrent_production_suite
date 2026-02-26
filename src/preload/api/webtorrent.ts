import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  AddTorrentRequest,
  AddTorrentResponse,
  QueuedTorrent,
  QueuedTorrentProgress,
  WebTorrentSettings,
  SelectTorrentFilesRequest,
  SelectTorrentFilesResponse,
  TorrentContentFile,
  ParseTorrentFilesResponse,
} from '@shared/types/torrent.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const webtorrentApi = {
  add: (request: AddTorrentRequest): Promise<AddTorrentResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_ADD, request),

  pause: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_PAUSE, id),

  resume: (id: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_RESUME, id),

  remove: (
    id: string,
    deleteFiles?: boolean
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_REMOVE, id, deleteFiles),

  getAll: (): Promise<ApiResponse<QueuedTorrent[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_GET_ALL),

  getSettings: (): Promise<ApiResponse<WebTorrentSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_GET_SETTINGS),

  updateSettings: (
    settings: Partial<WebTorrentSettings>
  ): Promise<ApiResponse<WebTorrentSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_UPDATE_SETTINGS, settings),

  onProgress: (
    callback: (updates: QueuedTorrentProgress[]) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      updates: QueuedTorrentProgress[]
    ) => {
      callback(updates)
    }
    ipcRenderer.on(IPC_CHANNELS.WEBTORRENT_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.WEBTORRENT_PROGRESS, handler)
    }
  },

  onStatusChange: (
    callback: (torrent: QueuedTorrent) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      torrent: QueuedTorrent
    ) => {
      callback(torrent)
    }
    ipcRenderer.on(IPC_CHANNELS.WEBTORRENT_STATUS_CHANGE, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.WEBTORRENT_STATUS_CHANGE, handler)
    }
  },

  onFileSelectionNeeded: (
    callback: (data: {
      id: string
      name: string
      files: TorrentContentFile[]
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; name: string; files: TorrentContentFile[] }
    ) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.WEBTORRENT_FILE_SELECTION_NEEDED, handler)
    return () => {
      ipcRenderer.removeListener(
        IPC_CHANNELS.WEBTORRENT_FILE_SELECTION_NEEDED,
        handler
      )
    }
  },

  getDownloadPath: (projectId: string): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_GET_DOWNLOAD_PATH, projectId),

  setDownloadPath: (
    projectId: string,
    downloadPath: string
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.WEBTORRENT_SET_DOWNLOAD_PATH,
      projectId,
      downloadPath
    ),

  selectFiles: (
    request: SelectTorrentFilesRequest
  ): Promise<SelectTorrentFilesResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.WEBTORRENT_SELECT_FILES, request),

  parseTorrentFiles: (
    torrentFilePath: string
  ): Promise<ParseTorrentFilesResponse> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.WEBTORRENT_PARSE_TORRENT_FILES,
      torrentFilePath
    ),

  downloadMoreFiles: (
    id: string,
    fileIndices: number[]
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.WEBTORRENT_DOWNLOAD_MORE_FILES,
      id,
      fileIndices
    ),
}
