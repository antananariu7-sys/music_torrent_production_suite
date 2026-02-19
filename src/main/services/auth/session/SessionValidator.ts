import type { Page, Browser } from 'puppeteer-core'
import type { AuthState } from '@shared/types/auth.types'
import type { SessionCookie } from './SessionPersistence'

export interface SessionValidatorDeps {
  getAuthState(): AuthState
  getSessionCookies(): SessionCookie[]
  initBrowser(): Promise<Browser>
  onSessionExpired(): void
}

/**
 * SessionValidator
 *
 * Runs background session validation on a configurable interval.
 * Checks if RuTracker session cookies are still valid by making a lightweight request.
 */
export class SessionValidator {
  private validationInterval: NodeJS.Timeout | null = null
  private deps: SessionValidatorDeps

  constructor(deps: SessionValidatorDeps) {
    this.deps = deps
  }

  /**
   * Start background session validation (every 15 minutes).
   */
  start(): void {
    const VALIDATION_INTERVAL = 15 * 60 * 1000

    this.validationInterval = setInterval(async () => {
      if (!this.deps.getAuthState().isLoggedIn) {
        return
      }

      console.log('[AuthService] Running background session validation...')
      await this.validate()
    }, VALIDATION_INTERVAL)

    console.log('[AuthService] Background session validation started')
  }

  /**
   * Stop background session validation.
   */
  stop(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval)
      this.validationInterval = null
      console.log('[AuthService] Background session validation stopped')
    }
  }

  /**
   * Validate current session by checking if cookies are still valid.
   */
  async validate(): Promise<boolean> {
    const authState = this.deps.getAuthState()
    const cookies = this.deps.getSessionCookies()

    if (!authState.isLoggedIn || cookies.length === 0) {
      return false
    }

    let page: Page | null = null

    try {
      console.log('[AuthService] Validating session...')

      const browser = await this.deps.initBrowser()
      page = await browser.newPage()

      await page.goto('https://rutracker.org/forum/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })

      await page.setCookie(...cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
      })))

      await page.goto('https://rutracker.org/forum/index.php', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })

      const loginForm = await page.$('#login-form-full')

      if (loginForm) {
        console.log('[AuthService] ❌ Session validation failed - user logged out')
        await page.close()
        this.deps.onSessionExpired()
        return false
      }

      await page.close()
      console.log('[AuthService] ✅ Session validation successful')
      return true
    } catch (error) {
      console.warn('[AuthService] Session validation failed (network issue):', error instanceof Error ? error.message : 'Unknown error')
      if (page) {
        await page.close().catch(() => {})
      }
      return false
    }
  }
}
