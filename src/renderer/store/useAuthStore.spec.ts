import { describe, it, expect, beforeEach } from '@jest/globals'

import { useAuthStore } from './useAuthStore'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isLoggedIn: false,
      username: undefined,
      sessionExpiry: undefined,
      isSessionRestored: false,
    })
  })

  describe('login', () => {
    it('should set isLoggedIn and username', () => {
      useAuthStore.getState().login('testuser')

      const state = useAuthStore.getState()
      expect(state.isLoggedIn).toBe(true)
      expect(state.username).toBe('testuser')
    })

    it('should set sessionExpiry to ~24 hours from now', () => {
      const before = Date.now()
      useAuthStore.getState().login('testuser')
      const after = Date.now()

      const expiry = useAuthStore.getState().sessionExpiry!
      const expiryMs = new Date(expiry).getTime()
      const twentyFourHoursMs = 24 * 60 * 60 * 1000

      expect(expiryMs).toBeGreaterThanOrEqual(before + twentyFourHoursMs)
      expect(expiryMs).toBeLessThanOrEqual(after + twentyFourHoursMs)
    })

    it('should set isSessionRestored to false', () => {
      useAuthStore.setState({ isSessionRestored: true })
      useAuthStore.getState().login('user')
      expect(useAuthStore.getState().isSessionRestored).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.setState({
        isLoggedIn: true,
        username: 'testuser',
        sessionExpiry: new Date(Date.now() + 86400000),
        isSessionRestored: true,
      })

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.isLoggedIn).toBe(false)
      expect(state.username).toBeUndefined()
      expect(state.sessionExpiry).toBeUndefined()
      expect(state.isSessionRestored).toBe(false)
    })
  })

  describe('isAuthenticated', () => {
    it('should return false when not logged in', () => {
      expect(useAuthStore.getState().isAuthenticated()).toBe(false)
    })

    it('should return false when logged in but no expiry', () => {
      useAuthStore.setState({ isLoggedIn: true, sessionExpiry: undefined })
      expect(useAuthStore.getState().isAuthenticated()).toBe(false)
    })

    it('should return true when logged in with future expiry', () => {
      useAuthStore.setState({
        isLoggedIn: true,
        sessionExpiry: new Date(Date.now() + 60000),
      })
      expect(useAuthStore.getState().isAuthenticated()).toBe(true)
    })

    it('should return false when session has expired', () => {
      useAuthStore.setState({
        isLoggedIn: true,
        sessionExpiry: new Date(Date.now() - 1000),
      })
      expect(useAuthStore.getState().isAuthenticated()).toBe(false)
    })
  })

  describe('setAuthState', () => {
    it('should merge partial state', () => {
      useAuthStore
        .getState()
        .setAuthState({ isLoggedIn: true, username: 'admin' })

      const state = useAuthStore.getState()
      expect(state.isLoggedIn).toBe(true)
      expect(state.username).toBe('admin')
    })
  })
})
