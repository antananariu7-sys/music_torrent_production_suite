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
import { TorrentMetadataService } from '../services/TorrentMetadataService'
import { registerTorrentMetadataHandlers } from './torrentMetadataHandlers'
import { MixExportService } from '../services/mixExport/MixExportService'
import { registerMixExportHandlers } from './mixExportHandlers'
import { WaveformExtractor } from '../services/waveform/WaveformExtractor'
import { registerWaveformHandlers } from './waveformHandlers'
import { BpmDetector } from '../services/waveform/BpmDetector'
import { registerBpmHandlers } from './bpmHandlers'
import { KeyDetector } from '../services/waveform/KeyDetector'
import { registerKeyHandlers } from './keyHandlers'
import { StreamPreviewService } from '../services/StreamPreviewService'
import { registerStreamPreviewHandlers } from './streamPreviewHandlers'
import { registerDuplicateHandlers } from './duplicateHandlers'

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
let torrentMetadataService: TorrentMetadataService
let projectService: ProjectService
let mixExportService: MixExportService
let waveformExtractor: WaveformExtractor
let bpmDetector: BpmDetector
let keyDetector: KeyDetector
let streamPreviewService: StreamPreviewService

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
  torrentMetadataService = new TorrentMetadataService(authService)
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
  registerTorrentMetadataHandlers(torrentMetadataService)
  registerAudioHandlers()
  mixExportService = new MixExportService(projectService)
  registerMixExportHandlers(mixExportService)
  waveformExtractor = new WaveformExtractor(projectService)
  registerWaveformHandlers(waveformExtractor)
  bpmDetector = new BpmDetector(projectService)
  registerBpmHandlers(bpmDetector)
  keyDetector = new KeyDetector(projectService)
  registerKeyHandlers(keyDetector)
  streamPreviewService = new StreamPreviewService()
  registerStreamPreviewHandlers(streamPreviewService)
  registerDuplicateHandlers()

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
  await searchService.closeBrowser()
  await torrentService.closeBrowser()
  await webtorrentService.destroy()
  await discographySearchService.closeBrowser()
  await torrentMetadataService.closeBrowser()
  mixExportService.cleanup()
  waveformExtractor.cleanup()
  bpmDetector.cleanup()
  keyDetector.cleanup()
  await streamPreviewService.cleanup()
  console.log('Services cleaned up successfully')
}
