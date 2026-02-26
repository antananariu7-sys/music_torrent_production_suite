import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  TorrentMetadataRequest,
  TorrentMetadataResponse,
} from '@shared/types/torrentMetadata.types'

export const torrentMetadataApi = {
  parse: (request: TorrentMetadataRequest): Promise<TorrentMetadataResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.TORRENT_PARSE_METADATA, request),
}
