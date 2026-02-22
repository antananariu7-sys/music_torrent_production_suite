import puppeteer, { Browser, Page } from 'puppeteer-core'
import type {
  LoginCredentials,
  LoginResult,
  AuthState,
  StoredCredentials,
} from '@shared/types/auth.types'
import { findChromePath } from '../utils/browserUtils'
import { SessionPersistence } from './session/SessionPersistence'
import { SessionValidator } from './session/SessionValidator'
import type { SessionCookie } from './session/SessionPersistence'

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
  private isSessionRestored: boolean = false
  private persistence: SessionPersistence
  private validator: SessionValidator

  constructor() {
    this.persistence = new SessionPersistence()

    this.validator = new SessionValidator({
      getAuthState: () => this.authState,
      getSessionCookies: () => [...this.sessionCookies],
      initBrowser: () => this.initBrowser(),
      onSessionExpired: () => {
        this.authState = {
          isLoggedIn: false,
          username: undefined,
          sessionExpiry: undefined,
        }
        this.sessionCookies = []
        this.persistence.clear()
        this.validator.stop()
      },
    })

    // Restore session on initialization
    const restored = this.persistence.restore()
    if (restored) {
      this.sessionCookies = restored.cookies
      this.authState = {
        isLoggedIn: true,
        username: restored.username,
        sessionExpiry: restored.sessionExpiry,
        isSessionRestored: true,
      }
      this.isSessionRestored = true
    }

    this.validator.start()
  }

  // ====================================
  // BROWSER MANAGEMENT
  // ====================================

  private async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    const executablePath = findChromePath()
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

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  // ====================================
  // LOGIN
  // ====================================

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    let page: Page | null = null

    try {
      if (!credentials.username || !credentials.password) {
        return { success: false, error: 'Username and password are required' }
      }

      console.log(
        `[AuthService] Login attempt for user: ${credentials.username}`
      )

      const browser = await this.initBrowser()
      page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })

      console.log(
        `[AuthService] Navigating to https://rutracker.org/forum/login.php`
      )
      await page.goto('https://rutracker.org/forum/login.php', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      })

      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Fill in credentials
      const usernameSelector = '#login-form-full input[name="login_username"]'
      await page.waitForSelector(usernameSelector, { visible: true })
      await page.type(usernameSelector, credentials.username)

      const passwordSelector = '#login-form-full input[name="login_password"]'
      await page.waitForSelector(passwordSelector, { visible: true })
      await page.type(passwordSelector, credentials.password)

      // Check for CAPTCHA
      const captchaImage = await page.$('#login-form-full img[src*="captcha"]')
      if (captchaImage) {
        console.log(
          '[AuthService] ⚠️  CAPTCHA detected - user must solve manually'
        )
        try {
          await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 300000,
          })
        } catch (error) {
          return {
            success: false,
            error: 'CAPTCHA submission timeout - please try again',
          }
        }
      } else {
        console.log(
          '[AuthService] No CAPTCHA detected - proceeding with automatic submission'
        )
        const submitButtonSelector =
          '#login-form-full input[name="login"][type="submit"]'
        await page.waitForSelector(submitButtonSelector, { visible: true })

        await page.evaluate((selector) => {
          const button = document.querySelector(selector) as HTMLElement
          if (button) button.click()
        }, submitButtonSelector)

        console.log('[AuthService] Login button clicked, waiting for response')
        await page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
          .catch(() => {
            console.log(
              '[AuthService] Navigation timeout or no navigation occurred'
            )
          })
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Check for error messages
      const errorElement = await page.$('.mrg_16')
      if (errorElement) {
        const errorText = await page.evaluate(
          (el) => el?.textContent,
          errorElement
        )
        console.error(`[AuthService] Login failed: ${errorText}`)
        return {
          success: false,
          error: errorText || 'Invalid username or password',
        }
      }

      // Extract session cookies
      const cookies = await page.cookies()
      this.sessionCookies = cookies
        .filter(
          (cookie) =>
            cookie.name.includes('bb_') || cookie.name.includes('session')
        )
        .map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires || Date.now() / 1000 + 24 * 60 * 60,
        }))

      console.log(
        `[AuthService] Extracted ${this.sessionCookies.length} session cookies`
      )

      if (this.sessionCookies.length === 0) {
        return {
          success: false,
          error: 'Login failed: No session cookies received',
        }
      }

      await this.closeBrowser()

      const sessionId =
        this.sessionCookies.find((c) => c.name.includes('session'))?.value ||
        `session_${Date.now()}`
      const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      this.authState = {
        isLoggedIn: true,
        username: credentials.username,
        sessionExpiry,
      }

      if (credentials.remember) {
        this.storedCredentials = { username: credentials.username }
      }

      console.log(
        `[AuthService] ✅ Login successful for user: ${credentials.username}`
      )
      this.persistence.save(this.authState, this.sessionCookies)

      return { success: true, username: credentials.username, sessionId }
    } catch (error) {
      console.error('[AuthService] Login failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      }
    }
  }

  // ====================================
  // PUBLIC API
  // ====================================

  async logout(): Promise<void> {
    console.log(`[AuthService] Logout user: ${this.authState.username}`)
    this.authState = {
      isLoggedIn: false,
      username: undefined,
      sessionExpiry: undefined,
    }
    this.sessionCookies = []
    this.isSessionRestored = false
    this.persistence.clear()
    this.validator.stop()
  }

  async cleanup(): Promise<void> {
    console.log('[AuthService] Cleaning up...')
    this.validator.stop()
    await this.closeBrowser()
  }

  isRestoredSession(): boolean {
    return this.isSessionRestored
  }

  getAuthStatus(): AuthState {
    if (
      this.authState.isLoggedIn &&
      this.authState.sessionExpiry &&
      new Date() > this.authState.sessionExpiry
    ) {
      this.authState = {
        isLoggedIn: false,
        username: undefined,
        sessionExpiry: undefined,
      }
    }
    return { ...this.authState }
  }

  getStoredCredentials(): StoredCredentials {
    return { ...this.storedCredentials }
  }

  clearStoredCredentials(): void {
    this.storedCredentials = { username: undefined }
  }

  getSessionCookies(): SessionCookie[] {
    return [...this.sessionCookies]
  }

  getDebugInfo(): { cookies: SessionCookie[]; cookieCount: number } {
    return {
      cookies: [...this.sessionCookies],
      cookieCount: this.sessionCookies.length,
    }
  }
}

// Re-export SessionCookie type for consumers
export type { SessionCookie }
