import { contextBridge } from 'electron'
import { appApi } from './api/app'
import { projectApi } from './api/project'
import { authApi } from './api/auth'
import { searchApi } from './api/search'
import { discographyApi } from './api/discography'
import { musicBrainzApi } from './api/musicBrainz'
import { torrentApi } from './api/torrent'
import { searchHistoryApi } from './api/searchHistory'
import { torrentCollectionApi } from './api/torrentCollection'
import { webtorrentApi } from './api/webtorrent'
import { torrentMetadataApi } from './api/torrentMetadata'
import { mixExportApi } from './api/mixExport'
import { audioApi } from './api/audio'
import { waveformApi } from './api/waveform'
import { bpmApi } from './api/bpm'
import { keyApi } from './api/key'
import { streamPreviewApi } from './api/streamPreview'
import { mixApi } from './api/mix'
import { duplicateApi } from './api/duplicate'

// Assemble the full API from domain modules
const api = {
  ...appApi,
  ...projectApi,
  auth: authApi,
  search: searchApi,
  discography: discographyApi,
  musicBrainz: musicBrainzApi,
  torrent: torrentApi,
  searchHistory: searchHistoryApi,
  torrentCollection: torrentCollectionApi,
  webtorrent: webtorrentApi,
  torrentMetadata: torrentMetadataApi,
  mixExport: mixExportApi,
  audio: audioApi,
  waveform: waveformApi,
  bpm: bpmApi,
  key: keyApi,
  streamPreview: streamPreviewApi,
  mix: mixApi,
  duplicate: duplicateApi,
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Type declaration for TypeScript
export type ElectronAPI = typeof api
