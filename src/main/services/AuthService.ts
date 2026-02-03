import puppeteer, { Browser, Page } from 'puppeteer-core'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type { LoginCredentials, LoginResult, AuthState, StoredCredentials } from '@shared/types/auth.types'

interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
}

/**
 * AuthService
 *
 * Handles authentication with RuTracker using Puppeteer.
 * Manages login, logout, session state, and credential storage.
 */
export class AuthService {
  private authState: AuthState = {
    isLoggedIn: false,
    username: undefined,
    sessionExpiry: undefined,
  }

  private storedCredentials: StoredCredentials = {
    username: undefined,
  }

  private sessionCookies: SessionCookie[] = []
  private browser: Browser | null = null

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
        console.log(`[AuthService] Found Chrome at: ${path}`)
        return path
      }
    }

    // Try to find Chrome using 'where' on Windows
    try {
      const result = execSync('where chrome', { encoding: 'utf-8' })
      const chromePath = result.trim().split('\n')[0]
      if (existsSync(chromePath)) {
        console.log(`[AuthService] Found Chrome via 'where': ${chromePath}`)
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
    // Use DEBUG_BROWSER env var to control headless mode
    const headless = process.env.DEBUG_BROWSER !== 'true'
    console.log(`[AuthService] Launching browser (headless: ${headless})`)

    this.browser = await puppeteer.launch({
      executablePath,
      headless,
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
  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Authenticate user with RuTracker
   *
   * @param credentials - Login credentials (username, password, remember)
   * @returns Login result with success status and optional error message
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    let page: Page | null = null

    try {
      // Validate credentials
      if (!credentials.username || !credentials.password) {
        return {
          success: false,
          error: 'Username and password are required',
        }
      }

      console.log(`[AuthService] Login attempt for user: ${credentials.username}`)

      // Initialize browser
      const browser = await this.initBrowser()
      page = await browser.newPage()

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 })

      // Navigate directly to RuTracker login page
      console.log(`[AuthService] Navigating to https://rutracker.org/forum/login.php`)
      await page.goto('https://rutracker.org/forum/login.php', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      // Wait for page to load completely
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Fill in username (target the specific form with id login-form-full)
      console.log(`[AuthService] Filling username field`)
      const usernameSelector = '#login-form-full input[name="login_username"]'
      await page.waitForSelector(usernameSelector, { visible: true })
      await page.type(usernameSelector, credentials.username)

      // Fill in password
      console.log(`[AuthService] Filling password field`)
      const passwordSelector = '#login-form-full input[name="login_password"]'
      await page.waitForSelector(passwordSelector, { visible: true })
      await page.type(passwordSelector, credentials.password)

      // Click the Вход button to submit form
      console.log(`[AuthService] Clicking Вход button`)

      // Find and click the submit button with name="login" inside login-form-full
      const submitButtonSelector = '#login-form-full input[name="login"][type="submit"]'
      await page.waitForSelector(submitButtonSelector, { visible: true })

      // Click the button using JavaScript to ensure it works
      await page.evaluate((selector) => {
        const button = document.querySelector(selector) as HTMLElement
        if (button) {
          button.click()
        }
      }, submitButtonSelector)

      console.log('[AuthService] Login button clicked, waiting for response')

      // Wait for navigation or error message
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
        console.log('[AuthService] Navigation timeout or no navigation occurred')
        // Navigation might not happen if there's an error
      })

      // Check if login was successful
      // If successful, we should see username in the page or be redirected
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check for error messages
      const errorElement = await page.$('.mrg_16')
      if (errorElement) {
        const errorText = await page.evaluate(el => el?.textContent, errorElement)
        console.error(`[AuthService] Login failed: ${errorText}`)
        console.log('[AuthService] Browser left open for inspection. Please close manually.')
        // Don't close browser for debugging
        return {
          success: false,
          error: errorText || 'Invalid username or password',
        }
      }

      // Extract session cookies
      const cookies = await page.cookies()
      this.sessionCookies = cookies
        .filter(cookie => cookie.name.includes('bb_') || cookie.name.includes('session'))
        .map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires || Date.now() / 1000 + 24 * 60 * 60,
        }))

      console.log(`[AuthService] Extracted ${this.sessionCookies.length} session cookies`)

      // Check if we actually got session cookies (indicates successful login)
      if (this.sessionCookies.length === 0) {
        console.error('[AuthService] No session cookies found - login may have failed')
        console.log('[AuthService] Browser left open for inspection. Please close manually.')
        return {
          success: false,
          error: 'Login failed: No session cookies received',
        }
      }

      // Close browser only on success
      console.log('[AuthService] Login successful, closing browser')
      await this.closeBrowser()

      // Generate session ID from cookie
      const sessionId = this.sessionCookies.find(c => c.name.includes('session'))?.value || `session_${Date.now()}`
      const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      this.authState = {
        isLoggedIn: true,
        username: credentials.username,
        sessionExpiry,
      }

      // Store username if remember is enabled
      if (credentials.remember) {
        this.storedCredentials = {
          username: credentials.username,
        }
        console.log(`[AuthService] Stored credentials for user: ${credentials.username}`)
      }

      console.log(`[AuthService] ✅ Login successful for user: ${credentials.username}`)
      console.log(`[AuthService] Session ID: ${sessionId}`)
      console.log(`[AuthService] Session expires: ${sessionExpiry.toLocaleString()}`)

      return {
        success: true,
        username: credentials.username,
        sessionId,
      }
    } catch (error) {
      console.error('[AuthService] Login failed:', error)

      // Don't close browser on error for debugging
      console.log('[AuthService] Browser left open for inspection. Please close manually.')

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
    // Note: Don't close page in finally block - leave browser open for debugging
  }

  /**
   * Logout current user
   *
   * TODO: Implement actual RuTracker logout
   * - Clear session cookies
   * - Navigate to logout endpoint
   */
  async logout(): Promise<void> {
    console.log(`[AuthService] Logout user: ${this.authState.username}`)

    this.authState = {
      isLoggedIn: false,
      username: undefined,
      sessionExpiry: undefined,
    }
  }

  /**
   * Check current authentication status
   *
   * @returns Current auth state with login status and username
   */
  getAuthStatus(): AuthState {
    // Check if session has expired
    if (
      this.authState.isLoggedIn &&
      this.authState.sessionExpiry &&
      new Date() > this.authState.sessionExpiry
    ) {
      // Session expired, clear auth state
      this.authState = {
        isLoggedIn: false,
        username: undefined,
        sessionExpiry: undefined,
      }
    }

    return { ...this.authState }
  }

  /**
   * Get stored credentials (username only, never password)
   *
   * @returns Stored credentials if remember was enabled
   */
  getStoredCredentials(): StoredCredentials {
    return { ...this.storedCredentials }
  }

  /**
   * Clear stored credentials
   */
  clearStoredCredentials(): void {
    this.storedCredentials = {
      username: undefined,
    }
  }

  /**
   * Get session cookies for reuse in other services
   *
   * @returns Array of session cookies
   */
  getSessionCookies(): SessionCookie[] {
    return [...this.sessionCookies]
  }
}

// Export SessionCookie type
export type { SessionCookie }
