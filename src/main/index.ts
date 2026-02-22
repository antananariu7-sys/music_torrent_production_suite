import { app, BrowserWindow, protocol } from 'electron'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { extname } from 'path'
import { APP_CONFIG } from '../shared/constants'
import { createWindow } from './window'
import { registerIpcHandlers, cleanupServices } from './ipc'

const AUDIO_MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.ape': 'audio/ape',
}

let mainWindow: BrowserWindow | null = null

// Register custom protocol for streaming audio files to renderer.
// MUST be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'audio',
    privileges: { stream: true, standard: true, supportFetchAPI: true },
  },
])

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.APP_VERSION} starting...`)

  // Stream audio files directly to <audio> element with range request support
  // for seeking. No IPC data transfer — the renderer loads audio directly.
  protocol.handle('audio', async (req) => {
    const url = new URL(req.url)
    const filePath = url.searchParams.get('path')
    if (!filePath) {
      return new Response('Missing path parameter', { status: 400 })
    }

    const { size } = await stat(filePath)
    const contentType =
      AUDIO_MIME_TYPES[extname(filePath).toLowerCase()] ||
      'application/octet-stream'
    const rangeHeader = req.headers.get('range')

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : size - 1
      const chunkSize = end - start + 1

      return new Response(
        Readable.toWeb(
          createReadStream(filePath, { start, end })
        ) as ReadableStream,
        {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
          },
        }
      )
    }

    return new Response(
      Readable.toWeb(createReadStream(filePath)) as ReadableStream,
      {
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(size),
          'Accept-Ranges': 'bytes',
        },
      }
    )
  })

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
