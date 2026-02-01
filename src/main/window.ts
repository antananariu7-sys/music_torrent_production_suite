import { BrowserWindow } from 'electron'
import { join } from 'path'
import { APP_CONFIG } from '../shared/constants'

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: APP_CONFIG.DEFAULT_WINDOW_WIDTH,
    height: APP_CONFIG.DEFAULT_WINDOW_HEIGHT,
    minWidth: APP_CONFIG.MIN_WINDOW_WIDTH,
    minHeight: APP_CONFIG.MIN_WINDOW_HEIGHT,
    webPreferences: {
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable node integration in renderer
      nodeIntegration: false,
      // Security: Enable sandbox
      sandbox: true,
      // Preload script for safe IPC
      preload: join(__dirname, '../../preload/index.cjs'),
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
