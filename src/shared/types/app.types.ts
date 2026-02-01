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
}

export type AppStatus = 'idle' | 'busy' | 'error'

export interface ErrorInfo {
  code: string
  message: string
  details?: unknown
}
