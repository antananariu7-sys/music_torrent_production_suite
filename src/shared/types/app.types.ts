// Application-level types

export interface AppInfo {
  name: string
  version: string
  platform: NodeJS.Platform
  arch: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  downloadDirectory: string
  autoStart: boolean
  minimizeToTray: boolean
  notifications: boolean
  autoScanDiscography: boolean
  mixPointPreferences?: MixPointPreferences
}

/**
 * User preference learning for mix-point suggestions.
 * Tracked via accept/reject actions, adjusts scoring weights over time.
 */
export interface MixPointPreferences {
  totalAccepted: number
  totalRejected: number
  /** Running average of accepted crossfade durations */
  avgAcceptedDuration: number
  /** Learned scoring weights (overrides defaults when enough data) */
  weights?: { energy: number; phrase: number; key: number }
}

export type AppStatus = 'idle' | 'busy' | 'error'

export interface ErrorInfo {
  code: string
  message: string
  details?: unknown
}
