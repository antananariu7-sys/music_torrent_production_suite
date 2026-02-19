import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { AuthState } from '@shared/types/auth.types'

export interface SessionCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
}

interface PersistedSession {
  cookies: SessionCookie[]
  username: string
  sessionExpiry: number
  savedAt: number
}

/**
 * SessionPersistence
 *
 * Handles saving and restoring authentication sessions to/from disk.
 */
export class SessionPersistence {
  private sessionFilePath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    const sessionDir = join(userDataPath, 'sessions')

    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    this.sessionFilePath = join(sessionDir, 'rutracker-session.json')
    console.log(`[AuthService] Session file path: ${this.sessionFilePath}`)
  }

  /**
   * Save session to file system for persistence.
   */
  save(authState: AuthState, cookies: SessionCookie[]): void {
    if (!authState.isLoggedIn || cookies.length === 0) {
      return
    }

    const session: PersistedSession = {
      cookies,
      username: authState.username || '',
      sessionExpiry: authState.sessionExpiry?.getTime() || Date.now() + 24 * 60 * 60 * 1000,
      savedAt: Date.now(),
    }

    try {
      writeFileSync(this.sessionFilePath, JSON.stringify(session, null, 2), 'utf-8')
      console.log(`[AuthService] Session saved for user: ${session.username}`)
    } catch (error) {
      console.error('[AuthService] Failed to save session:', error)
    }
  }

  /**
   * Restore session from file system.
   * Returns null if no valid session found.
   */
  restore(): { cookies: SessionCookie[]; username: string; sessionExpiry: Date } | null {
    try {
      if (!existsSync(this.sessionFilePath)) {
        console.log('[AuthService] No saved session found')
        return null
      }

      const sessionData = readFileSync(this.sessionFilePath, 'utf-8')
      const session: PersistedSession = JSON.parse(sessionData)

      const sessionExpiry = new Date(session.sessionExpiry)
      if (new Date() > sessionExpiry) {
        console.log('[AuthService] Saved session has expired')
        this.clear()
        return null
      }

      console.log(`[AuthService] ✅ Session restored for user: ${session.username}`)
      console.log(`[AuthService] Session expires: ${sessionExpiry.toLocaleString()}`)

      return {
        cookies: session.cookies,
        username: session.username,
        sessionExpiry,
      }
    } catch (error) {
      console.error('[AuthService] Failed to restore session:', error)
      this.clear()
      return null
    }
  }

  /**
   * Clear saved session file.
   */
  clear(): void {
    try {
      if (existsSync(this.sessionFilePath)) {
        writeFileSync(this.sessionFilePath, '', 'utf-8')
        console.log('[AuthService] Saved session cleared')
      }
    } catch (error) {
      console.error('[AuthService] Failed to clear saved session:', error)
    }
  }
}
