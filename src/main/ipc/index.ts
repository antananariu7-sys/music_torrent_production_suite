import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import { ProjectService } from '../services/ProjectService'
import { ConfigService } from '../services/ConfigService'
import { FileSystemService } from '../services/FileSystemService'
import { LockService } from '../services/LockService'
import { AuthService } from '../services/AuthService'
import { RuTrackerSearchService } from '../services/RuTrackerSearchService'
import { TorrentDownloadService } from '../services/TorrentDownloadService'
import { MusicBrainzService } from '../services/MusicBrainzService'
import { DiscographySearchService } from '../services/DiscographySearchService'
import { searchHistoryService } from '../services/SearchHistoryService'
import { torrentCollectionService } from '../services/TorrentCollectionService'
import type { CreateProjectRequest, OpenProjectRequest } from '@shared/types/project.types'
import type {
  SaveSearchHistoryRequest,
  LoadSearchHistoryRequest,
  SearchHistoryResponse,
} from '@shared/types/searchHistory.types'
import type { LoginCredentials } from '@shared/types/auth.types'
import type { SearchRequest, ProgressiveSearchRequest } from '@shared/types/search.types'
import type {
  TorrentDownloadRequest,
  TorrentSettings,
  LoadTorrentCollectionRequest,
  SaveTorrentCollectionRequest,
  TorrentCollectionResponse,
} from '@shared/types/torrent.types'
import type {
  AlbumSearchRequest,
  SearchClassificationRequest,
  ArtistAlbumsRequest,
} from '@shared/types/musicbrainz.types'
import type { DiscographySearchRequest } from '@shared/types/discography.types'

// Initialize services
const fileSystemService = new FileSystemService()
const configService = new ConfigService()
const lockService = new LockService()
const authService = new AuthService()
const searchService = new RuTrackerSearchService(authService)
const torrentService = new TorrentDownloadService(authService)
const musicBrainzService = new MusicBrainzService()
const discographySearchService = new DiscographySearchService(authService)
const projectService = new ProjectService(
  fileSystemService,
  configService,
  lockService
)

export function registerIpcHandlers(): void {
  console.log('Registering IPC handlers...')

  // App handlers
  ipcMain.handle(IPC_CHANNELS.APP_READY, async () => {
    return {
      name: 'Music Production Suite',
      version: '0.1.0',
      platform: process.platform,
      arch: process.arch,
    }
  })

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    // TODO: Implement settings service
    return {
      theme: 'system',
      downloadDirectory: '',
      autoStart: false,
      minimizeToTray: false,
      notifications: true,
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, settings) => {
    // TODO: Implement settings service
    console.log('Settings updated:', settings)
    return settings
  })

  // Authentication handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, credentials: LoginCredentials) => {
    try {
      const result = await authService.login(credentials)
      return result
    } catch (error) {
      console.error('Auth login failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    try {
      await authService.logout()
      return { success: true }
    } catch (error) {
      console.error('Auth logout failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, async () => {
    try {
      const authState = authService.getAuthStatus()
      return { success: true, data: authState }
    } catch (error) {
      console.error('Get auth status failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get auth status',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_DEBUG, async () => {
    try {
      const debugInfo = authService.getDebugInfo()
      return { success: true, data: debugInfo }
    } catch (error) {
      console.error('Get auth debug info failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get debug info',
      }
    }
  })

  // Search handlers
  ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, request: SearchRequest) => {
    try {
      const response = await searchService.search(request)
      return response
    } catch (error) {
      console.error('Search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SEARCH_OPEN_URL, async (_event, url: string) => {
    try {
      const response = await searchService.openUrlWithSession(url)
      return response
    } catch (error) {
      console.error('Failed to open URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open URL',
      }
    }
  })

  // Progressive search handler (multi-page with progress updates)
  ipcMain.handle(
    IPC_CHANNELS.SEARCH_START_PROGRESSIVE,
    async (event, request: ProgressiveSearchRequest) => {
      try {
        const response = await searchService.searchProgressive(request, (progress) => {
          // Send progress updates to renderer
          event.sender.send(IPC_CHANNELS.SEARCH_PROGRESS, progress)
        })
        return response
      } catch (error) {
        console.error('Progressive search failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Progressive search failed',
        }
      }
    }
  )

  // Project handlers
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, request: CreateProjectRequest) => {
    try {
      const project = await projectService.createProject(
        request.name,
        request.location,
        request.description
      )
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to create project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, async (_event, request: OpenProjectRequest) => {
    try {
      const project = await projectService.openProject(request.filePath)
      return { success: true, data: project }
    } catch (error) {
      console.error('Failed to open project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_CLOSE, async (_event, projectId: string) => {
    try {
      await projectService.closeProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to close project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close project',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    try {
      const recentProjects = configService.getRecentProjects()
      return { success: true, data: recentProjects }
    } catch (error) {
      console.error('Failed to get recent projects:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent projects',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_event, projectId: string) => {
    try {
      configService.removeRecentProject(projectId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
    async (_event, projectId: string, projectDirectory: string) => {
      try {
        // First remove from recent projects
        configService.removeRecentProject(projectId)

        // Then delete the directory from disk
        await fileSystemService.deleteDirectory(projectDirectory)

        return { success: true }
      } catch (error) {
        console.error('Failed to delete project from disk:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete project from disk',
        }
      }
    }
  )

  // File operation handlers
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_DIRECTORY, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Project Location',
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      return result.filePaths[0]
    } catch (error) {
      console.error('Failed to select directory:', error)
      return null
    }
  })

  // Torrent download handlers
  ipcMain.handle(IPC_CHANNELS.TORRENT_DOWNLOAD, async (_event, request: TorrentDownloadRequest) => {
    try {
      const response = await torrentService.downloadTorrent(request)
      return response
    } catch (error) {
      console.error('Torrent download failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Torrent download failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_GET_HISTORY, async () => {
    try {
      const history = torrentService.getHistory()
      return { success: true, data: history }
    } catch (error) {
      console.error('Failed to get torrent history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get torrent history',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_CLEAR_HISTORY, async () => {
    try {
      torrentService.clearHistory()
      return { success: true }
    } catch (error) {
      console.error('Failed to clear torrent history:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear torrent history',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_GET_SETTINGS, async () => {
    try {
      const settings = torrentService.getSettings()
      return { success: true, data: settings }
    } catch (error) {
      console.error('Failed to get torrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get torrent settings',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.TORRENT_UPDATE_SETTINGS, async (_event, settings: TorrentSettings) => {
    try {
      torrentService.updateSettings(settings)
      return { success: true, data: torrentService.getSettings() }
    } catch (error) {
      console.error('Failed to update torrent settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update torrent settings',
      }
    }
  })

  // MusicBrainz handlers
  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_FIND_ALBUMS, async (_event, request: AlbumSearchRequest) => {
    try {
      const response = await musicBrainzService.findAlbumsBySong(request)
      return response
    } catch (error) {
      console.error('MusicBrainz album search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Album search failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_GET_ALBUM, async (_event, albumId: string) => {
    try {
      const album = await musicBrainzService.getAlbumDetails(albumId)
      return { success: true, data: album }
    } catch (error) {
      console.error('Failed to get album details:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get album details',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_CREATE_QUERY, async (_event, albumId: string) => {
    try {
      const album = await musicBrainzService.getAlbumDetails(albumId)
      if (!album) {
        return {
          success: false,
          error: 'Album not found',
        }
      }
      const query = musicBrainzService.createRuTrackerQuery(album)
      return { success: true, data: query }
    } catch (error) {
      console.error('Failed to create RuTracker query:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create query',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.MUSICBRAINZ_CLASSIFY_SEARCH,
    async (_event, request: SearchClassificationRequest) => {
      try {
        const response = await musicBrainzService.classifySearch(request)
        return response
      } catch (error) {
        console.error('Search classification failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search classification failed',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MUSICBRAINZ_GET_ARTIST_ALBUMS,
    async (_event, request: ArtistAlbumsRequest) => {
      try {
        const response = await musicBrainzService.getArtistAlbums(request)
        return response
      } catch (error) {
        console.error('Failed to get artist albums:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get artist albums',
        }
      }
    }
  )

  // Discography search handlers
  ipcMain.handle(
    IPC_CHANNELS.DISCOGRAPHY_SEARCH,
    async (event, request: DiscographySearchRequest) => {
      try {
        const response = await discographySearchService.searchInPages(request, (progress) => {
          // Send progress updates to renderer
          event.sender.send(IPC_CHANNELS.DISCOGRAPHY_SEARCH_PROGRESS, progress)
        })
        return response
      } catch (error) {
        console.error('Discography search failed:', error)
        return {
          success: false,
          scanResults: [],
          matchedPages: [],
          totalScanned: 0,
          matchCount: 0,
          error: error instanceof Error ? error.message : 'Discography search failed',
        }
      }
    }
  )

  // Search history handlers
  ipcMain.handle(
    'searchHistory:load',
    async (_event, request: LoadSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> => {
      try {
        const { projectId, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        const history = await searchHistoryService.loadHistory(projectId, projectDirectory)

        return {
          success: true,
          history,
        }
      } catch (error) {
        console.error('Error loading search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load search history',
        }
      }
    }
  )

  ipcMain.handle(
    'searchHistory:save',
    async (_event, request: SaveSearchHistoryRequest & { projectDirectory: string }): Promise<SearchHistoryResponse> => {
      try {
        const { projectId, projectName, history, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        await searchHistoryService.saveHistory(
          projectId,
          projectName,
          projectDirectory,
          history
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error saving search history:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save search history',
        }
      }
    }
  )

  // Torrent collection handlers
  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_LOAD,
    async (_event, request: LoadTorrentCollectionRequest): Promise<TorrentCollectionResponse> => {
      try {
        const { projectId, projectDirectory } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        const torrents = await torrentCollectionService.loadCollection(projectId, projectDirectory)

        return {
          success: true,
          torrents,
        }
      } catch (error) {
        console.error('Error loading torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load torrent collection',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_SAVE,
    async (_event, request: SaveTorrentCollectionRequest): Promise<TorrentCollectionResponse> => {
      try {
        const { projectId, projectName, projectDirectory, torrents } = request

        if (!projectDirectory) {
          return {
            success: false,
            error: 'Project directory not provided',
          }
        }

        await torrentCollectionService.saveCollection(
          projectId,
          projectName,
          projectDirectory,
          torrents
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error saving torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save torrent collection',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.TORRENT_COLLECTION_CLEAR,
    async (_event, projectDirectory: string): Promise<TorrentCollectionResponse> => {
      try {
        await torrentCollectionService.clearCollection(projectDirectory)

        return {
          success: true,
        }
      } catch (error) {
        console.error('Error clearing torrent collection:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear torrent collection',
        }
      }
    }
  )

  console.log('IPC handlers registered successfully')
}

/**
 * Cleanup services before app shutdown
 */
export async function cleanupServices(): Promise<void> {
  console.log('Cleaning up services...')
  await authService.cleanup()
  await torrentService.closeBrowser()
  await discographySearchService.closeBrowser()
  console.log('Services cleaned up successfully')
}
