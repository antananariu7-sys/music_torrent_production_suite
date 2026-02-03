import { create } from 'zustand'
import type { AuthState } from '@shared/types/auth.types'

interface AuthStore extends AuthState {
  setAuthState: (state: Partial<AuthState>) => void
  login: (username: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isLoggedIn: false,
  username: undefined,
  sessionExpiry: undefined,

  setAuthState: (state) => set(state),

  login: (username) =>
    set({
      isLoggedIn: true,
      username,
      sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    }),

  logout: () =>
    set({
      isLoggedIn: false,
      username: undefined,
      sessionExpiry: undefined,
    }),

  isAuthenticated: () => {
    const state = get()
    if (!state.isLoggedIn || !state.sessionExpiry) {
      return false
    }
    return new Date() < new Date(state.sessionExpiry)
  },
}))
