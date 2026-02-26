import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  LoadTorrentCollectionRequest,
  SaveTorrentCollectionRequest,
  TorrentCollectionResponse,
} from '@shared/types/torrent.types'

export const torrentCollectionApi = {
  load: (
    request: LoadTorrentCollectionRequest
  ): Promise<TorrentCollectionResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_LOAD, request),

  save: (
    request: SaveTorrentCollectionRequest
  ): Promise<TorrentCollectionResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_SAVE, request),

  clear: (projectDirectory: string): Promise<TorrentCollectionResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_CLEAR, projectDirectory),
}
