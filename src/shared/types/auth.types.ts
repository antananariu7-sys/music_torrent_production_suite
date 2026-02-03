// Authentication types for RuTracker integration

export interface LoginCredentials {
  username: string
  password: string
  remember: boolean
}

export interface LoginResult {
  success: boolean
  username?: string
  error?: string
  sessionId?: string
}

export interface AuthState {
  isLoggedIn: boolean
  username?: string
  sessionExpiry?: Date
  isSessionRestored?: boolean
}

export interface StoredCredentials {
  username?: string
}
