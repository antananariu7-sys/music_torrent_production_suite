import { BrowserWindow, session } from 'electron'
import { join } from 'path'
import { APP_CONFIG } from '../shared/constants'

export function createWindow(): BrowserWindow {
  // Set Content Security Policy headers to allow cover art images from HTTPS sources and audio data URLs
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' data:",
        ],
      },
    })
  })

  const window = new BrowserWindow({
    width: APP_CONFIG.DEFAULT_WINDOW_WIDTH,
    height: APP_CONFIG.DEFAULT_WINDOW_HEIGHT,
    minWidth: APP_CONFIG.MIN_WINDOW_WIDTH,
    minHeight: APP_CONFIG.MIN_WINDOW_HEIGHT,
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable node integration in renderer
      nodeIntegration: false,
      // Security: Enable sandbox
      sandbox: true,
      // Preload script for safe IPC
      preload: join(__dirname, '../preload/index.cjs'),
    },
    show: false, // Don't show until ready-to-show
  })

  // Show window when ready to prevent visual flash
  window.once('ready-to-show', () => {
    window.show()
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    // Development: Load from Vite dev server
    window.loadURL('http://localhost:5173')
    window.webContents.openDevTools()
  } else {
    // Production: Load built files
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Handle window close
  window.on('closed', () => {
    // Dereference the window object
  })

  return window
}
