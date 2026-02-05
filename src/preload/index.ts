import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AppInfo, AppSettings } from '@shared/types/app.types'
import type {
  CreateProjectRequest,
  OpenProjectRequest,
  Project,
  RecentProject,
} from '@shared/types/project.types'
import type { LoginCredentials, LoginResult, AuthState } from '@shared/types/auth.types'
import type { SearchRequest, SearchResponse } from '@shared/types/search.types'
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
} from '@shared/types/torrent.types'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'

// API response wrapper
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Define the API that will be exposed to the renderer process
const api = {
  // App methods
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.APP_READY),

  // Settings methods
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

  // Project methods
  createProject: (request: CreateProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),

  openProject: (request: OpenProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, request),

  closeProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE, projectId),

  getRecentProjects: (): Promise<ApiResponse<RecentProject[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  // File operations
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY),

  // Authentication methods
  auth: {
    login: (credentials: LoginCredentials): Promise<LoginResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, credentials),

    logout: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),

    getStatus: (): Promise<ApiResponse<AuthState>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),

    getDebugInfo: (): Promise<ApiResponse<{ cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number }>; cookieCount: number }>> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_DEBUG),
  },

  // Search methods
  search: {
    start: (request: SearchRequest): Promise<SearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_START, request),

    openUrl: (url: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SEARCH_OPEN_URL, url),
  },

  // MusicBrainz methods
  musicBrainz: {
    classifySearch: (request: SearchClassificationRequest): Promise<SearchClassificationResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CLASSIFY_SEARCH, request),

    findAlbumsBySong: (request: AlbumSearchRequest): Promise<AlbumSearchResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_FIND_ALBUMS, request),

    getAlbumDetails: (albumId: string): Promise<ApiResponse<MusicBrainzAlbum | null>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ALBUM, albumId),

    getArtistAlbums: (request: ArtistAlbumsRequest): Promise<ArtistAlbumsResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ARTIST_ALBUMS, request),

    createRuTrackerQuery: (albumId: string): Promise<ApiResponse<string>> =>
      ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CREATE_QUERY, albumId),
  },

  // Torrent methods
  torrent: {
    download: (request: TorrentDownloadRequest): Promise<TorrentDownloadResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_DOWNLOAD, request),

    getHistory: (): Promise<ApiResponse<TorrentFile[]>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_GET_HISTORY),

    clearHistory: (): Promise<ApiResponse<void>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_CLEAR_HISTORY),

    getSettings: (): Promise<ApiResponse<TorrentSettings>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_GET_SETTINGS),

    updateSettings: (settings: TorrentSettings): Promise<ApiResponse<TorrentSettings>> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_UPDATE_SETTINGS, settings),
  },

  // Search history methods
  searchHistory: {
    load: (request: LoadSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> =>
      ipcRenderer.invoke('searchHistory:load', request),

    save: (request: SaveSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> =>
      ipcRenderer.invoke('searchHistory:save', request),
  },

  // Torrent collection methods
  torrentCollection: {
    load: (request: LoadTorrentCollectionRequest): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_LOAD, request),

    save: (request: SaveTorrentCollectionRequest): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_SAVE, request),

    clear: (projectDirectory: string): Promise<TorrentCollectionResponse> =>
      ipcRenderer.invoke(IPC_CHANNELS.TORRENT_COLLECTION_CLEAR, projectDirectory),
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)

// Type declaration for TypeScript
export type ElectronAPI = typeof api
