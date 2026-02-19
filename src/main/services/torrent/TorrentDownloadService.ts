import puppeteer, { Browser, Page } from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs'
import path from 'path'
import { shell } from 'electron'
import type {
  TorrentDownloadRequest,
  TorrentDownloadResponse,
  TorrentFile,
  TorrentSettings,
} from '@shared/types/torrent.types'
import type { AuthService } from '../AuthService'
import { findChromePath } from '../utils/browserUtils'
import { DownloadHistoryManager } from './DownloadHistoryManager'

/**
 * TorrentDownloadService
 *
 * Handles downloading torrent files from RuTracker and managing the local torrent library.
 */
export class TorrentDownloadService {
  private browser: Browser | null = null
  private settings: TorrentSettings
  private historyManager: DownloadHistoryManager

  constructor(
    private authService: AuthService,
    settings?: Partial<TorrentSettings>
  ) {
    this.settings = {
      torrentsFolder: settings?.torrentsFolder || this.getDefaultTorrentsFolder(),
      autoOpen: settings?.autoOpen ?? false,
      keepHistory: settings?.keepHistory ?? true,
      preferMagnetLinks: settings?.preferMagnetLinks ?? false,
    }

    this.ensureTorrentsFolder()
    this.historyManager = new DownloadHistoryManager(this.settings.torrentsFolder)
    this.historyManager.load(undefined, this.settings.keepHistory)
  }

  private getDefaultTorrentsFolder(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    return path.join(homeDir, 'Music', 'Torrents')
  }

  private ensureTorrentsFolder(): void {
    if (!existsSync(this.settings.torrentsFolder)) {
      mkdirSync(this.settings.torrentsFolder, { recursive: true })
      console.log(`[TorrentDownloadService] Created torrents folder: ${this.settings.torrentsFolder}`)
    }
  }

  private ensureDir(dirPath: string): void {
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
  }

  // ====================================
  // BROWSER MANAGEMENT
  // ====================================

  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = findChromePath()
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

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      console.log('[TorrentDownloadService] Browser closed')
    }
  }

  private async validateSession(page: Page): Promise<boolean> {
    try {
      const loginForm = await page.$('#login-form-full')
      if (loginForm) {
        console.log('[TorrentDownloadService] ❌ Session expired - login form detected')
        return false
      }

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

  // ====================================
  // FILE NAMING
  // ====================================

  private buildTorrentFileName(torrentId: string, title?: string): string {
    if (!title) return `${torrentId}.torrent`

    const sanitized = title
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 150)
      .replace(/_$/, '')

    if (!sanitized) return `${torrentId}.torrent`

    return `${sanitized}_[${torrentId}].torrent`
  }

  private saveTorrentFile(
    torrentBuffer: Buffer,
    torrentId: string,
    title?: string,
    projectDirectory?: string
  ): { projectPath?: string; globalPath: string } {
    const fileName = this.buildTorrentFileName(torrentId, title)

    this.ensureDir(this.settings.torrentsFolder)
    const globalPath = path.join(this.settings.torrentsFolder, fileName)
    writeFileSync(globalPath, torrentBuffer)
    console.log(`[TorrentDownloadService] Saved to global: ${globalPath}`)

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

  // ====================================
  // DOWNLOAD
  // ====================================

  async downloadTorrent(request: TorrentDownloadRequest): Promise<TorrentDownloadResponse> {
    let page: Page | null = null

    try {
      const authState = this.authService.getAuthStatus()
      if (!authState.isLoggedIn) {
        return { success: false, error: 'User is not logged in. Please login first.' }
      }

      console.log(`[TorrentDownloadService] Downloading torrent ${request.torrentId} from ${request.pageUrl}`)

      const sessionCookies = this.authService.getSessionCookies()
      console.log(`[TorrentDownloadService] Using ${sessionCookies.length} session cookies`)

      if (sessionCookies.length === 0) {
        return { success: false, error: 'No session cookies found. Please login again.' }
      }

      const browser = await this.initBrowser()
      page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })

      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      await page.setCookie(
        ...sessionCookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
        }))
      )

      const pageResponse = await page.goto(request.pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      if (!pageResponse) {
        throw new Error('Failed to load torrent page - no response received')
      }

      const isSessionValid = await this.validateSession(page)
      if (!isSessionValid) {
        return { success: false, error: 'Session expired or invalid. Please login again.' }
      }

      // Extract magnet link
      const magnetSelector = 'a.magnet-link[href^="magnet:"]'
      let magnetLink: string | null = null
      try {
        await page.waitForSelector(magnetSelector, { timeout: 5000 })
        magnetLink = await page.$eval(magnetSelector, (el) => (el as HTMLAnchorElement).href)
      } catch {
        console.log('[TorrentDownloadService] No magnet link found on page')
      }

      // If preferMagnetLinks, use magnet
      if (magnetLink && this.settings.preferMagnetLinks) {
        const torrentFile: TorrentFile = {
          id: request.torrentId,
          title: request.title || `Torrent ${request.torrentId}`,
          magnetLink,
          pageUrl: request.pageUrl,
          downloadedAt: new Date(),
        }

        this.historyManager.addEntry(torrentFile, request.projectDirectory, this.settings.keepHistory)
        await this.closeBrowser()
        return { success: true, torrent: torrentFile }
      }

      // Download .torrent file via fetch
      const downloadSelector = 'a.dl-link[href*="dl.php"]'
      let downloadHref: string | null = null
      try {
        await page.waitForSelector(downloadSelector, { timeout: 10000 })
        downloadHref = await page.$eval(downloadSelector, (el) => (el as HTMLAnchorElement).getAttribute('href'))
      } catch {
        const pageUrl = page.url()
        if (pageUrl.includes('login.php')) {
          return { success: false, error: 'Redirected to login page. Session may have expired. Please login again.' }
        }
        throw new Error(`Download link not found on page. Expected selector: ${downloadSelector}`)
      }

      if (!downloadHref) {
        throw new Error('Download link href is empty')
      }

      const downloadUrl = new URL(downloadHref, page.url()).href
      const torrentBase64 = await page.evaluate(async (url: string) => {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
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

      const { projectPath, globalPath } = this.saveTorrentFile(
        torrentBuffer, request.torrentId, request.title, request.projectDirectory
      )

      const filePath = projectPath || globalPath

      const torrentFile: TorrentFile = {
        id: request.torrentId,
        title: request.title || `Torrent ${request.torrentId}`,
        filePath,
        magnetLink: magnetLink || undefined,
        pageUrl: request.pageUrl,
        downloadedAt: new Date(),
      }

      this.historyManager.addEntry(torrentFile, request.projectDirectory, this.settings.keepHistory)
      await this.closeBrowser()

      console.log(`[TorrentDownloadService] Torrent downloaded successfully: ${filePath}`)
      return { success: true, torrent: torrentFile }
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

      return { success: false, error: errorMessage }
    }
  }

  // ====================================
  // PUBLIC API
  // ====================================

  getHistory(projectDirectory?: string): TorrentFile[] {
    return this.historyManager.getHistory(projectDirectory, this.settings.keepHistory)
  }

  clearHistory(projectDirectory?: string): void {
    this.historyManager.clearHistory(projectDirectory, this.settings.keepHistory)
  }

  updateSettings(settings: Partial<TorrentSettings>): void {
    this.settings = { ...this.settings, ...settings }
    if (settings.torrentsFolder) {
      this.ensureTorrentsFolder()
    }
    console.log('[TorrentDownloadService] Settings updated:', this.settings)
  }

  getSettings(): TorrentSettings {
    return { ...this.settings }
  }

  async openInTorrentClient(torrent: TorrentFile): Promise<{ success: boolean; error?: string }> {
    try {
      if (torrent.magnetLink) {
        await shell.openExternal(torrent.magnetLink)
        return { success: true }
      }

      if (torrent.filePath && existsSync(torrent.filePath)) {
        await shell.openPath(torrent.filePath)
        return { success: true }
      }

      return { success: false, error: 'No magnet link or torrent file available to open' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open torrent',
      }
    }
  }
}
