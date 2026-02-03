import { app, BrowserWindow } from 'electron'
import { APP_CONFIG } from '../shared/constants'
import { createWindow } from './window'
import { registerIpcHandlers, cleanupServices } from './ipc'

let mainWindow: BrowserWindow | null = null

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.APP_VERSION} starting...`)

  // Register all IPC handlers
  registerIpcHandlers()

  // Create main window
  mainWindow = createWindow()

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up before quitting
app.on('before-quit', async () => {
  console.log('Application shutting down...')
  if (mainWindow) {
    mainWindow.destroy()
  }
  // Clean up services
  await cleanupServices()
})
