import '@testing-library/jest-dom'

// Polyfill for structuredClone (not available in jsdom)
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: unknown) => {
    // Handle primitive values and undefined
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return obj
    }
    // Handle arrays and objects
    return JSON.parse(JSON.stringify(obj))
  }
}

// Mock localStorage for Zustand persist
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] || null,
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock window.api for Electron IPC (if needed in renderer tests)
if (typeof window !== 'undefined') {
  // @ts-expect-error - window.api doesn't exist in jsdom by default
  window.api = {}
}
