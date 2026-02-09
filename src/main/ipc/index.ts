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
import './audioHandlers'

// Initialize services
const fileSystemService = new FileSystemService()
const configService = new ConfigService()
const lockService = new LockService()
const authService = new AuthService()
const searchService = new RuTrackerSearchService(authService)
const torrentService = new TorrentDownloadService(authService)
const webtorrentService = new WebTorrentService(configService)
const musicBrainzService = new MusicBrainzService()
const discographySearchService = new DiscographySearchService(authService)
const projectService = new ProjectService(
  fileSystemService,
  configService,
  lockService
)

export function registerIpcHandlers(): void {
  console.log('Registering IPC handlers...')

  registerAppHandlers(configService)
  registerAuthHandlers(authService)
  registerSearchHandlers(searchService, discographySearchService)
  registerProjectHandlers(projectService, configService, fileSystemService)
  registerTorrentHandlers(torrentService)
  registerWebtorrentHandlers(webtorrentService)
  registerMusicBrainzHandlers(musicBrainzService)

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
