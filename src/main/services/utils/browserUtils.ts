import { existsSync } from 'fs'
import { execSync } from 'child_process'

/**
 * Find Chrome/Chromium executable path on the system.
 * Checks common installation paths across Windows, Linux, and macOS.
 */
export function findChromePath(): string {
  const possiblePaths = [
    // Windows paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    // Linux paths
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    // macOS paths
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log(`[browserUtils] Found Chrome at: ${path}`)
      return path
    }
  }

  // Try to find Chrome using 'where' on Windows
  try {
    const result = execSync('where chrome', { encoding: 'utf-8' })
    const chromePath = result.trim().split('\n')[0]
    if (existsSync(chromePath)) {
      console.log(`[browserUtils] Found Chrome via 'where': ${chromePath}`)
      return chromePath
    }
  } catch (error) {
    // Ignore error
  }

  throw new Error('Chrome/Chromium executable not found. Please install Google Chrome.')
}
