import { FileSystemService } from '../services/FileSystemService'
import { ConfigService } from '../services/ConfigService'
import { LockService } from '../services/LockService'
import { AuthService } from '../services/AuthService'
import { RuTrackerSearchService } from '../services/RuTrackerSearchService'
import { TorrentDownloadService } from '../services/TorrentDownloadService'
import { MusicBrainzService } from '../services/MusicBrainzService'
import { DiscographySearchService } from '../services/DiscographySearchService'
import { ProjectService } from '../services/ProjectService'
import { registerAppHandlers } from './appHandlers'
import { registerAuthHandlers } from './authHandlers'
import { registerSearchHandlers } from './searchHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerTorrentHandlers } from './torrentHandlers'
import { registerMusicBrainzHandlers } from './musicBrainzHandlers'
import { WebTorrentService } from '../services/WebTorrentService'
import { registerWebtorrentHandlers } from './webtorrentHandlers'
import { registerAudioHandlers } from './audioHandlers'

// Service instances (initialized in registerIpcHandlers)
let fileSystemService: FileSystemService
let configService: ConfigService
let lockService: LockService
let authService: AuthService
let searchService: RuTrackerSearchService
let torrentService: TorrentDownloadService
let webtorrentService: WebTorrentService
let musicBrainzService: MusicBrainzService
let discographySearchService: DiscographySearchService
let projectService: ProjectService

export function registerIpcHandlers(): void {
  console.log('Registering IPC handlers...')

  // Initialize services (after Electron app is ready)
  fileSystemService = new FileSystemService()
  configService = new ConfigService()
  lockService = new LockService()
  authService = new AuthService()
  searchService = new RuTrackerSearchService(authService)
  torrentService = new TorrentDownloadService(authService)
  webtorrentService = new WebTorrentService(configService)
  musicBrainzService = new MusicBrainzService()
  discographySearchService = new DiscographySearchService(authService)
  projectService = new ProjectService(
    fileSystemService,
    configService,
    lockService
  )

  // Register IPC handlers
  registerAppHandlers(configService)
  registerAuthHandlers(authService)
  registerSearchHandlers(searchService, discographySearchService)
  registerProjectHandlers(projectService, configService, fileSystemService)
  registerTorrentHandlers(torrentService)
  registerWebtorrentHandlers(webtorrentService)
  registerMusicBrainzHandlers(musicBrainzService)
  registerAudioHandlers()

  // Resume any persisted WebTorrent downloads
  webtorrentService.resumePersistedDownloads()

  console.log('IPC handlers registered successfully')
}

/**
 * Cleanup services before app shutdown
 */
export async function cleanupServices(): Promise<void> {
  console.log('Cleaning up services...')
  await authService.cleanup()
  await torrentService.closeBrowser()
  await webtorrentService.destroy()
  await discographySearchService.closeBrowser()
  console.log('Services cleaned up successfully')
}
