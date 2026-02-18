import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs'
import path from 'path'
import { shell } from 'electron'
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
      preferMagnetLinks: settings?.preferMagnetLinks ?? false, // Prefer .torrent file download
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
   * Get the history file path for a given project directory (or fallback).
   */
  private getHistoryPath(projectDirectory?: string): string {
    if (projectDirectory) {
      return path.join(projectDirectory, '.download-history.json')
    }
    return this.historyFilePath
  }

  /**
   * Load download history from disk
   */
  private loadHistory(projectDirectory?: string): void {
    if (!this.settings.keepHistory) return

    const filePath = this.getHistoryPath(projectDirectory)
    try {
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8')
        const items = JSON.parse(data) as Array<Omit<TorrentFile, 'downloadedAt'> & { downloadedAt: string }>
        this.downloadHistory = items.map((item) => ({
          ...item,
          downloadedAt: new Date(item.downloadedAt),
        }))
        console.log(`[TorrentDownloadService] Loaded ${this.downloadHistory.length} items from history (${filePath})`)
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to load history:', error)
      this.downloadHistory = []
    }
  }

  /**
   * Save download history to disk
   */
  private saveHistory(projectDirectory?: string): void {
    if (!this.settings.keepHistory) return

    const filePath = this.getHistoryPath(projectDirectory)
    try {
      writeFileSync(filePath, JSON.stringify(this.downloadHistory, null, 2))
      console.log(`[TorrentDownloadService] Saved download history (${filePath})`)
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
   * Validate session by checking if we're still logged in
   */
  private async validateSession(page: Page): Promise<boolean> {
    try {
      // Check for login form - if present, we're not logged in
      const loginForm = await page.$('#login-form-full')
      if (loginForm) {
        console.log('[TorrentDownloadService] ❌ Session expired - login form detected')
        return false
      }

      // Check for user profile link - if present, we're logged in
      const profileLink = await page.$('a[href*="profile.php"]')
      if (profileLink) {
        console.log('[TorrentDownloadService] ✅ Session valid - user profile link found')
        return true
      }

      console.log('[TorrentDownloadService] ⚠️  Cannot determine session status')
      return false
    } catch (error) {
      console.error('[TorrentDownloadService] Session validation error:', error)
      return false
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDir(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
  }

  /**
   * Build a human-readable .torrent filename.
   * Format: "{Title}_[{torrentId}].torrent"
   * e.g. "The_Doors_-_Hello,_I_Love_You_(EP)_[6817732].torrent"
   */
  private buildTorrentFileName(torrentId: string, title?: string): string {
    if (!title) return `${torrentId}.torrent`

    const sanitized = title
      .replace(/[<>:"/\\|?*]/g, '')  // Forbidden filesystem chars
      .replace(/\s+/g, '_')          // Spaces to underscores
      .replace(/_+/g, '_')           // Collapse consecutive underscores
      .replace(/^_|_$/g, '')         // Trim leading/trailing underscores
      .slice(0, 150)                 // Keep total path length safe
      .replace(/_$/, '')             // Trim trailing underscore after slice

    if (!sanitized) return `${torrentId}.torrent`

    return `${sanitized}_[${torrentId}].torrent`
  }

  /**
   * Save .torrent file buffer to project torrents dir and global torrents folder.
   * Returns the project-local file path (primary) or global path (fallback).
   */
  private saveTorrentFile(
    torrentBuffer: Buffer,
    torrentId: string,
    title?: string,
    projectDirectory?: string
  ): { projectPath?: string; globalPath: string } {
    const fileName = this.buildTorrentFileName(torrentId, title)

    // Save to global torrents folder
    this.ensureDir(this.settings.torrentsFolder)
    const globalPath = path.join(this.settings.torrentsFolder, fileName)
    writeFileSync(globalPath, torrentBuffer)
    console.log(`[TorrentDownloadService] Saved to global: ${globalPath}`)

    // Save to project directory
    let projectPath: string | undefined
    if (projectDirectory) {
      const projectTorrentsDir = path.join(projectDirectory, 'torrents')
      this.ensureDir(projectTorrentsDir)
      projectPath = path.join(projectTorrentsDir, fileName)
      copyFileSync(globalPath, projectPath)
      console.log(`[TorrentDownloadService] Copied to project: ${projectPath}`)
    }

    return { projectPath, globalPath }
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
      console.log(`[TorrentDownloadService] Using ${sessionCookies.length} session cookies`)
      console.log(`[TorrentDownloadService] Cookie names: ${sessionCookies.map(c => c.name).join(', ')}`)

      if (sessionCookies.length === 0) {
        return {
          success: false,
          error: 'No session cookies found. Please login again.',
        }
      }

      // Initialize browser
      const browser = await this.initBrowser()
      page = await browser.newPage()

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 })

      // Navigate to RuTracker homepage first to set domain context
      console.log('[TorrentDownloadService] Navigating to RuTracker homepage')
      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Set session cookies
      console.log('[TorrentDownloadService] Setting session cookies')
      await page.setCookie(
        ...sessionCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        }))
      )

      const currentCookies = await page.cookies()
      console.log(`[TorrentDownloadService] Current cookies after setting: ${currentCookies.length}`)

      // Navigate to torrent page
      console.log(`[TorrentDownloadService] Navigating to torrent page: ${request.pageUrl}`)
      const pageResponse = await page.goto(request.pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      if (!pageResponse) {
        throw new Error('Failed to load torrent page - no response received')
      }

      console.log(`[TorrentDownloadService] Page loaded with status: ${pageResponse.status()}`)

      // Validate session on torrent page
      const isSessionValid = await this.validateSession(page)
      if (!isSessionValid) {
        return {
          success: false,
          error: 'Session expired or invalid. Please login again.',
        }
      }

      // Always extract magnet link (for fallback / future use)
      const magnetSelector = 'a.magnet-link[href^="magnet:"]'
      let magnetLink: string | null = null
      try {
        await page.waitForSelector(magnetSelector, { timeout: 5000 })
        magnetLink = await page.$eval(magnetSelector, (el) => (el as HTMLAnchorElement).href)
        console.log(`[TorrentDownloadService] Found magnet link`)
      } catch {
        console.log('[TorrentDownloadService] No magnet link found on page')
      }

      // If preferMagnetLinks is on, use magnet and skip .torrent download
      if (magnetLink && this.settings.preferMagnetLinks) {
        console.log('[TorrentDownloadService] Using magnet link (preferred method)')

        const torrentFile: TorrentFile = {
          id: request.torrentId,
          title: request.title || `Torrent ${request.torrentId}`,
          magnetLink,
          pageUrl: request.pageUrl,
          downloadedAt: new Date(),
        }

        if (this.settings.keepHistory) {
          this.loadHistory(request.projectDirectory)
          this.downloadHistory.push(torrentFile)
          this.saveHistory(request.projectDirectory)
        }

        await this.closeBrowser()
        return { success: true, torrent: torrentFile }
      }

      // --- Download .torrent file via HTTP fetch ---
      console.log('[TorrentDownloadService] Attempting .torrent file download via fetch')

      const downloadSelector = 'a.dl-link[href*="dl.php"]'
      let downloadHref: string | null = null
      try {
        await page.waitForSelector(downloadSelector, { timeout: 10000 })
        downloadHref = await page.$eval(
          downloadSelector,
          (el) => (el as HTMLAnchorElement).getAttribute('href')
        )
      } catch {
        const pageUrl = page.url()
        if (pageUrl.includes('login.php')) {
          return {
            success: false,
            error: 'Redirected to login page. Session may have expired. Please login again.',
          }
        }
        throw new Error(`Download link not found on page. Expected selector: ${downloadSelector}`)
      }

      if (!downloadHref) {
        throw new Error('Download link href is empty')
      }

      // Build absolute URL for the download
      const downloadUrl = new URL(downloadHref, page.url()).href
      console.log(`[TorrentDownloadService] Fetching .torrent from: ${downloadUrl}`)

      // Fetch .torrent binary content using the page's authenticated session
      const torrentBase64 = await page.evaluate(async (url: string) => {
        const resp = await fetch(url)
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
        }
        const buf = await resp.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
      }, downloadUrl)

      const torrentBuffer = Buffer.from(torrentBase64, 'base64')

      if (torrentBuffer.length < 50) {
        throw new Error('Downloaded file is too small to be a valid .torrent')
      }

      console.log(`[TorrentDownloadService] Downloaded .torrent file: ${torrentBuffer.length} bytes`)

      // Save to both global torrents folder and project directory
      const { projectPath, globalPath } = this.saveTorrentFile(
        torrentBuffer,
        request.torrentId,
        request.title,
        request.projectDirectory
      )

      // The primary file path is the project-local copy (used by checkLocalFile),
      // falling back to the global copy
      const filePath = projectPath || globalPath

      const torrentFile: TorrentFile = {
        id: request.torrentId,
        title: request.title || `Torrent ${request.torrentId}`,
        filePath,
        magnetLink: magnetLink || undefined,
        pageUrl: request.pageUrl,
        downloadedAt: new Date(),
      }

      if (this.settings.keepHistory) {
        this.loadHistory(request.projectDirectory)
        this.downloadHistory.push(torrentFile)
        this.saveHistory(request.projectDirectory)
      }

      await this.closeBrowser()

      console.log(`[TorrentDownloadService] Torrent downloaded successfully: ${filePath}`)

      return {
        success: true,
        torrent: torrentFile,
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Download failed:', error)

      await this.closeBrowser()

      let errorMessage = error instanceof Error ? error.message : 'Download failed'

      if (errorMessage.includes('ERR_ABORTED')) {
        errorMessage = 'Download was aborted. This may indicate session expiry or authentication issues. Please try logging in again.'
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your internet connection and try again.'
      } else if (errorMessage.includes('net::')) {
        errorMessage = `Network error: ${errorMessage}. This may indicate session or authentication issues.`
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Get download history for a project directory (or fallback global history).
   */
  getHistory(projectDirectory?: string): TorrentFile[] {
    this.loadHistory(projectDirectory)
    return this.downloadHistory
  }

  /**
   * Clear download history for a project directory (or fallback global history).
   */
  clearHistory(projectDirectory?: string): void {
    this.downloadHistory = []
    this.saveHistory(projectDirectory)
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

  /**
   * Open a magnet link or torrent file in the default torrent client
   *
   * @param torrent - Torrent file record with magnet link or file path
   * @returns Promise that resolves when the operation completes
   */
  async openInTorrentClient(torrent: TorrentFile): Promise<{ success: boolean; error?: string }> {
    try {
      // Prefer magnet link if available
      if (torrent.magnetLink) {
        console.log(`[TorrentDownloadService] Opening magnet link in default torrent client`)
        await shell.openExternal(torrent.magnetLink)
        console.log(`[TorrentDownloadService] ✅ Magnet link opened successfully`)
        return { success: true }
      }

      // Fall back to opening .torrent file
      if (torrent.filePath && existsSync(torrent.filePath)) {
        console.log(`[TorrentDownloadService] Opening .torrent file: ${torrent.filePath}`)
        await shell.openPath(torrent.filePath)
        console.log(`[TorrentDownloadService] ✅ Torrent file opened successfully`)
        return { success: true }
      }

      console.error(`[TorrentDownloadService] No magnet link or file path available`)
      return {
        success: false,
        error: 'No magnet link or torrent file available to open',
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to open in torrent client:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open torrent',
      }
    }
  }
}
