import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  TorrentDownloadRequest,
  TorrentDownloadResponse,
  TorrentFile,
  TorrentSettings,
  CheckLocalTorrentRequest,
  CheckLocalTorrentResponse,
} from '@shared/types/torrent.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const torrentApi = {
  download: (
    request: TorrentDownloadRequest
  ): Promise<TorrentDownloadResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_DOWNLOAD, request),

  getHistory: (
    projectDirectory?: string
  ): Promise<ApiResponse<TorrentFile[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_GET_HISTORY, projectDirectory),

  clearHistory: (projectDirectory?: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_CLEAR_HISTORY, projectDirectory),

  getSettings: (): Promise<ApiResponse<TorrentSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_GET_SETTINGS),

  updateSettings: (
    settings: TorrentSettings
  ): Promise<ApiResponse<TorrentSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_UPDATE_SETTINGS, settings),

  checkLocalFile: (
    request: CheckLocalTorrentRequest
  ): Promise<CheckLocalTorrentResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_CHECK_LOCAL_FILE, request),
}
