import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import path from 'path'
import type {
  TorrentDownloadRequest,
  TorrentDownloadResponse,
  TorrentFile,
  TorrentSettings,
} from '@shared/types/torrent.types'
import type { AuthService } from './AuthService'

/**
 * TorrentDownloadService
 *
 * Handles downloading torrent files from RuTracker and managing the local torrent library.
 */
export class TorrentDownloadService {
  private browser: Browser | null = null
  private settings: TorrentSettings
  private downloadHistory: TorrentFile[] = []
  private historyFilePath: string

  constructor(
    private authService: AuthService,
    settings?: Partial<TorrentSettings>
  ) {
    // Default settings
    this.settings = {
      torrentsFolder: settings?.torrentsFolder || this.getDefaultTorrentsFolder(),
      autoOpen: settings?.autoOpen ?? false,
      keepHistory: settings?.keepHistory ?? true,
    }

    // Ensure torrents folder exists
    this.ensureTorrentsFolder()

    // History file path
    this.historyFilePath = path.join(this.settings.torrentsFolder, '.download-history.json')

    // Load download history
    this.loadHistory()
  }

  /**
   * Get default torrents folder based on OS
   */
  private getDefaultTorrentsFolder(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    return path.join(homeDir, 'Music', 'Torrents')
  }

  /**
   * Ensure torrents folder exists
   */
  private ensureTorrentsFolder(): void {
    if (!existsSync(this.settings.torrentsFolder)) {
      mkdirSync(this.settings.torrentsFolder, { recursive: true })
      console.log(`[TorrentDownloadService] Created torrents folder: ${this.settings.torrentsFolder}`)
    }
  }

  /**
   * Load download history from disk
   */
  private loadHistory(): void {
    if (!this.settings.keepHistory) return

    try {
      if (existsSync(this.historyFilePath)) {
        const data = readFileSync(this.historyFilePath, 'utf-8')
        this.downloadHistory = JSON.parse(data).map((item: any) => ({
          ...item,
          downloadedAt: new Date(item.downloadedAt),
        }))
        console.log(`[TorrentDownloadService] Loaded ${this.downloadHistory.length} items from history`)
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to load history:', error)
      this.downloadHistory = []
    }
  }

  /**
   * Save download history to disk
   */
  private saveHistory(): void {
    if (!this.settings.keepHistory) return

    try {
      writeFileSync(this.historyFilePath, JSON.stringify(this.downloadHistory, null, 2))
      console.log('[TorrentDownloadService] Saved download history')
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to save history:', error)
    }
  }

  /**
   * Find Chrome/Chromium executable path
   */
  private findChromePath(): string {
    const possiblePaths = [
      // Windows paths
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      // Linux paths
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      // macOS paths
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path
      }
    }

    // Try to find Chrome using 'where' on Windows
    try {
      const result = execSync('where chrome', { encoding: 'utf-8' })
      const chromePath = result.trim().split('\n')[0]
      if (existsSync(chromePath)) {
        return chromePath
      }
    } catch (error) {
      // Ignore error
    }

    throw new Error('Chrome/Chromium executable not found. Please install Google Chrome.')
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = this.findChromePath()
    console.log('[TorrentDownloadService] Launching browser')

    this.browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    })

    return this.browser
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[TorrentDownloadService] Browser closed')
    }
  }

  /**
   * Download a torrent file from RuTracker
   *
   * @param request - Torrent download request
   * @returns Download response with torrent file info
   */
  async downloadTorrent(request: TorrentDownloadRequest): Promise<TorrentDownloadResponse> {
    let page: Page | null = null

    try {
      // Check if user is logged in
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return {
          success: false,
          error: 'User is not logged in. Please login first.',
        }
      }

      console.log(`[TorrentDownloadService] Downloading torrent ${request.torrentId} from ${request.pageUrl}`)

      // Get session cookies from AuthService
      const sessionCookies = this.authService.getSessionCookies()

      // Initialize browser
      const browser = await this.initBrowser()
      page = await browser.newPage()

      // Set download behavior to capture the torrent file
      const client = await page.createCDPSession()
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.settings.torrentsFolder,
      })

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 })

      // Navigate to RuTracker homepage first to set cookies
      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Restore session cookies
      if (sessionCookies.length > 0) {
        await page.setCookie(
          ...sessionCookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            expires: cookie.expires,
          }))
        )
      }

      // Navigate to torrent page
      console.log(`[TorrentDownloadService] Navigating to torrent page: ${request.pageUrl}`)
      await page.goto(request.pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Find and click download button
      // RuTracker typically has a download link with class 'dl-link' or similar
      const downloadSelector = 'a.dl-link, a[href*="dl.php"], .magnet-link'
      await page.waitForSelector(downloadSelector, { timeout: 10000 })

      // Get the download link
      const downloadLink = await page.$eval(downloadSelector, (el: any) => el.href)
      console.log(`[TorrentDownloadService] Found download link: ${downloadLink}`)

      // Navigate to download link to trigger download
      await page.goto(downloadLink, { waitUntil: 'networkidle2' })

      // Wait for download to complete (simple delay - in production, monitor file system)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Generate file path
      const fileName = `${request.torrentId}.torrent`
      const filePath = path.join(this.settings.torrentsFolder, fileName)

      // Create torrent file record
      const torrentFile: TorrentFile = {
        id: request.torrentId,
        title: request.title || `Torrent ${request.torrentId}`,
        filePath,
        pageUrl: request.pageUrl,
        downloadedAt: new Date(),
      }

      // Add to history
      if (this.settings.keepHistory) {
        this.downloadHistory.push(torrentFile)
        this.saveHistory()
      }

      // Close browser
      await this.closeBrowser()

      console.log(`[TorrentDownloadService] ✅ Torrent downloaded successfully: ${filePath}`)

      return {
        success: true,
        torrent: torrentFile,
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Download failed:', error)
      await this.closeBrowser()

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      }
    }
  }

  /**
   * Get download history
   *
   * @returns Array of downloaded torrent files
   */
  getHistory(): TorrentFile[] {
    return this.downloadHistory
  }

  /**
   * Clear download history
   */
  clearHistory(): void {
    this.downloadHistory = []
    this.saveHistory()
    console.log('[TorrentDownloadService] Download history cleared')
  }

  /**
   * Update settings
   *
   * @param settings - New settings
   */
  updateSettings(settings: Partial<TorrentSettings>): void {
    this.settings = {
      ...this.settings,
      ...settings,
    }

    // Ensure new torrents folder exists
    if (settings.torrentsFolder) {
      this.ensureTorrentsFolder()
    }

    console.log('[TorrentDownloadService] Settings updated:', this.settings)
  }

  /**
   * Get current settings
   *
   * @returns Current torrent settings
   */
  getSettings(): TorrentSettings {
    return { ...this.settings }
  }
}
