import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AppInfo, AppSettings } from '@shared/types/app.types'
import type {
  CreateProjectRequest,
  OpenProjectRequest,
  Project,
  RecentProject,
  AddSongFromFileRequest,
  UpdateSongRequest,
  AudioMetadata,
} from '@shared/types/project.types'
import type {
  LoginCredentials,
  LoginResult,
  AuthState,
} from '@shared/types/auth.types'
import type {
  SearchRequest,
  SearchResponse,
  ProgressiveSearchRequest,
  SearchProgressEvent,
  LoadMoreRequest,
  LoadMoreResponse,
} from '@shared/types/search.types'
import type {
  AlbumSearchRequest,
  AlbumSearchResponse,
  SearchClassificationRequest,
  SearchClassificationResponse,
  ArtistAlbumsRequest,
  ArtistAlbumsResponse,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'
import type {
  TorrentDownloadRequest,
  TorrentDownloadResponse,
  TorrentFile,
  TorrentSettings,
  LoadTorrentCollectionRequest,
  SaveTorrentCollectionRequest,
  TorrentCollectionResponse,
  AddTorrentRequest,
  AddTorrentResponse,
  QueuedTorrent,
  QueuedTorrentProgress,
  WebTorrentSettings,
  CheckLocalTorrentRequest,
  CheckLocalTorrentResponse,
  SelectTorrentFilesRequest,
  SelectTorrentFilesResponse,
  TorrentContentFile,
  ParseTorrentFilesResponse,
} from '@shared/types/torrent.types'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'
import type {
  DiscographySearchRequest,
  DiscographySearchResponse,
  DiscographySearchProgress,
} from '@shared/types/discography.types'
import type {
  TorrentMetadataRequest,
  TorrentMetadataResponse,
} from '@shared/types/torrentMetadata.types'
import type {
  FfmpegCheckResult,
  MixExportRequest,
  MixExportProgress,
} from '@shared/types/mixExport.types'
import type {
  WaveformData,
  WaveformGenerateRequest,
  WaveformBatchRequest,
  WaveformProgressEvent,
  BpmData,
  BpmDetectRequest,
  BpmBatchRequest,
  BpmDetectSongRequest,
  BpmProgressEvent,
} from '@shared/types/waveform.types'
import type {
  StreamPreviewStartRequest,
  StreamPreviewReadyEvent,
  StreamPreviewBufferingEvent,
  StreamPreviewErrorEvent,
} from '@shared/types/streamPreview.types'

// API response wrapper
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Define the API that will be exposed to the renderer process
const api = {
  // App methods
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_READY),

  // Settings methods
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Project methods
  createProject: (
    request: CreateProjectRequest
  ): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),

  openProject: (request: OpenProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, request),

  closeProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE, projectId),

  getRecentProjects: (): Promise<ApiResponse<RecentProject[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  deleteProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),

  deleteProjectFromDisk: (
    projectId: string,
    projectDirectory: string
  ): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
      projectId,
      projectDirectory
    ),

  // File operations
  selectDirectory: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY, title),

  selectAudioFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_AUDIO_FILES),

  openPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PATH, filePath),

  // Authentication methods
  auth: {
    login: (credentials: LoginCredentials): Promise<LoginResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),

    logout: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),

    getStatus: (): Promise<ApiResponse<AuthState>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),

    getDebugInfo: (): Promise<
      ApiResponse<{
        cookies: Array<{
          name: string
          value: string
          domain: string
          path: string
          expires: number
        }>
        cookieCount: number
      }>
    > => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DEBUG),
  },

  // Search methods
  search: {
    start: (request: SearchRequest): Promise<SearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START, request),

    startProgressive: (
      request: ProgressiveSearchRequest
    ): Promise<SearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START_PROGRESSIVE, request),

    onProgress: (
      callback: (progress: SearchProgressEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: SearchProgressEvent
      ) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.SEARCH_PROGRESS, handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SEARCH_PROGRESS, handler)
      }
    },

    openUrl: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_OPEN_URL, url),

    loadMore: (request: LoadMoreRequest): Promise<LoadMoreResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_LOAD_MORE, request),
  },

  // Discography search methods
  discography: {
    search: (
      request: DiscographySearchRequest
    ): Promise<DiscographySearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.DISCOGRAPHY_SEARCH, request),

    onProgress: (
      callback: (progress: DiscographySearchProgress) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: DiscographySearchProgress
      ) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS, handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS,
          handler
        )
      }
    },
  },

  // MusicBrainz methods
  musicBrainz: {
    classifySearch: (
      request: SearchClassificationRequest
    ): Promise<SearchClassificationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CLASSIFY_SEARCH, request),

    findAlbumsBySong: (
      request: AlbumSearchRequest
    ): Promise<AlbumSearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_FIND_ALBUMS, request),

    getAlbumDetails: (
      albumId: string
    ): Promise<ApiResponse<MusicBrainzAlbum | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ALBUM, albumId),

    getArtistAlbums: (
      request: ArtistAlbumsRequest
    ): Promise<ArtistAlbumsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ARTIST_ALBUMS, request),

    createRuTrackerQuery: (albumId: string): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CREATE_QUERY, albumId),
  },

  // Torrent methods
  torrent: {
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
  },

  // Search history methods
  searchHistory: {
    load: (
      request: LoadSearchHistoryRequest & { projectDirectory: string }
    ): Promise<SearchHistoryResponse> =>
      ipcRenderer.invoke('searchHistory:load', request),

    save: (
      request: SaveSearchHistoryRequest & { projectDirectory: string }
    ): Promise<SearchHistoryResponse> =>
      ipcRenderer.invoke('searchHistory:save', request),
  },

  // Torrent collection methods
  torrentCollection: {
    load: (
      request: LoadTorrentCollectionRequest
    ): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_LOAD, request),

    save: (
      request: SaveTorrentCollectionRequest
    ): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_SAVE, request),

    clear: (projectDirectory: string): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.TORRENT_COLLECTION_CLEAR,
        projectDirectory
      ),
  },

  // WebTorrent download queue methods
  webtorrent: {
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
        ipcRenderer.removeListener(
          IPC_CHANNELS.WEBTORRENT_STATUS_CHANGE,
          handler
        )
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
  },

  // Torrent metadata parsing
  torrentMetadata: {
    parse: (
      request: TorrentMetadataRequest
    ): Promise<TorrentMetadataResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_PARSE_METADATA, request),
  },

  // Audio mix export
  mixExport: {
    checkFfmpeg: (): Promise<ApiResponse<FfmpegCheckResult>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_FFMPEG_CHECK),

    start: (
      request: MixExportRequest
    ): Promise<ApiResponse<{ jobId: string }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_START, request),

    cancel: (): Promise<ApiResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_CANCEL),

    onProgress: (
      callback: (progress: MixExportProgress) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: MixExportProgress
      ) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
      }
    },
  },

  // Audio playback
  audio: {
    readFile: (
      filePath: string
    ): Promise<{ success: boolean; url?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_READ_FILE, filePath),

    readMetadata: (
      filePath: string
    ): Promise<{ success: boolean; data?: AudioMetadata; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUDIO_READ_METADATA, filePath),
  },

  // Waveform extraction
  waveform: {
    generate: (
      request: WaveformGenerateRequest
    ): Promise<{ success: boolean; data?: WaveformData; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_GENERATE, request),

    generateBatch: (
      request: WaveformBatchRequest
    ): Promise<{ success: boolean; data?: WaveformData[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_GENERATE_BATCH, request),

    rebuildBatch: (
      request: WaveformBatchRequest
    ): Promise<{ success: boolean; data?: WaveformData[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WAVEFORM_REBUILD_BATCH, request),

    onProgress: (
      callback: (progress: WaveformProgressEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: WaveformProgressEvent
      ) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.WAVEFORM_PROGRESS, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WAVEFORM_PROGRESS, handler)
      }
    },
  },

  // BPM detection
  bpm: {
    detect: (
      request: BpmDetectRequest
    ): Promise<{ success: boolean; data?: BpmData; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT, request),

    detectBatch: (
      request: BpmBatchRequest
    ): Promise<{ success: boolean; data?: BpmData[]; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT_BATCH, request),

    detectSong: (
      request: BpmDetectSongRequest
    ): Promise<{ success: boolean; data?: BpmData; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.BPM_DETECT_SONG, request),

    onProgress: (
      callback: (progress: BpmProgressEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: BpmProgressEvent
      ) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.BPM_PROGRESS, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.BPM_PROGRESS, handler)
      }
    },
  },

  // Stream preview
  streamPreview: {
    start: (
      request: StreamPreviewStartRequest
    ): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.STREAM_PREVIEW_START, request),

    stop: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.STREAM_PREVIEW_STOP),

    onReady: (
      callback: (event: StreamPreviewReadyEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: StreamPreviewReadyEvent
      ) => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_READY, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PREVIEW_READY, handler)
      }
    },

    onFullReady: (
      callback: (event: StreamPreviewReadyEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: StreamPreviewReadyEvent
      ) => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_FULL_READY, handler)
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.STREAM_PREVIEW_FULL_READY,
          handler
        )
      }
    },

    onBuffering: (
      callback: (event: StreamPreviewBufferingEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: StreamPreviewBufferingEvent
      ) => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_BUFFERING, handler)
      return () => {
        ipcRenderer.removeListener(
          IPC_CHANNELS.STREAM_PREVIEW_BUFFERING,
          handler
        )
      }
    },

    onError: (
      callback: (event: StreamPreviewErrorEvent) => void
    ): (() => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        data: StreamPreviewErrorEvent
      ) => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.STREAM_PREVIEW_ERROR, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.STREAM_PREVIEW_ERROR, handler)
      }
    },
  },

  // Mix / song management
  mix: {
    addSong: (
      request: AddSongFromFileRequest
    ): Promise<{ success: boolean; data?: Project; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD_SONG, request),

    removeSong: (
      projectId: string,
      songId: string
    ): Promise<{ success: boolean; data?: Project; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE_SONG, projectId, songId),

    updateSong: (
      request: UpdateSongRequest
    ): Promise<{ success: boolean; data?: Project; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE_SONG, request),

    reorderSongs: (
      projectId: string,
      orderedSongIds: string[]
    ): Promise<{ success: boolean; data?: Project; error?: string }> =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PROJECT_REORDER_SONGS,
        projectId,
        orderedSongIds
      ),

    syncAudioFolder: (
      projectId: string
    ): Promise<{
      success: boolean
      data?: Project
      newCount?: number
      error?: string
    }> => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SYNC_AUDIO_FOLDER, projectId),
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Type declaration for TypeScript
export type ElectronAPI = typeof api
