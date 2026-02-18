import path from 'path'
import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import type { QueuedTorrent } from '@shared/types/torrent.types'

/**
 * Delete downloaded files and directories for a torrent from disk.
 * Tries to find the torrent root directory and remove it recursively.
 * Falls back to individual file + directory cleanup.
 */
export function deleteDownloadedFiles(qt: QueuedTorrent): void {
  const downloadPath = path.resolve(qt.downloadPath)
  console.log(`[WebTorrentService:delete] Starting file deletion for: "${qt.name}"`)
  console.log(`[WebTorrentService:delete]   downloadPath: "${downloadPath}"`)
  console.log(`[WebTorrentService:delete]   qt.downloadPath (raw): "${qt.downloadPath}"`)
  console.log(`[WebTorrentService:delete]   qt.name: "${qt.name}"`)
  console.log(`[WebTorrentService:delete]   qt.files.length: ${qt.files.length}`)
  if (qt.files.length > 0) {
    console.log(`[WebTorrentService:delete]   first file path: "${qt.files[0].path}"`)
  }

  // Try to find and recursively delete the torrent root directory.
  const candidates = new Set<string>()
  candidates.add(qt.name)
  if (qt.files.length > 0) {
    const firstSeg = qt.files[0].path.split(/[\\/]/)[0]
    if (firstSeg) candidates.add(firstSeg)
  }
  console.log(`[WebTorrentService:delete]   candidates: [${[...candidates].map(c => `"${c}"`).join(', ')}]`)

  for (const candidate of candidates) {
    const rootDir = path.join(downloadPath, candidate)
    const exists = existsSync(rootDir)
    let isDir = false
    try { isDir = exists && statSync(rootDir).isDirectory() } catch {}
    console.log(`[WebTorrentService:delete]   checking candidate "${candidate}" -> "${rootDir}" exists=${exists} isDir=${isDir}`)
    if (exists && isDir) {
      try {
        rmSync(rootDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
        const stillExists = existsSync(rootDir)
        console.log(`[WebTorrentService:delete]   rmSync done, stillExists=${stillExists}`)
        if (!stillExists) {
          console.log(`[WebTorrentService:delete] SUCCESS: Deleted torrent directory: ${rootDir}`)
          return
        }
      } catch (err) {
        console.error(`[WebTorrentService:delete]   rmSync FAILED for ${rootDir}:`, err)
      }
    }
  }
  console.log(`[WebTorrentService:delete]   No root directory found, falling back to individual file deletion`)

  // Fallback: delete individual files, then clean up empty directories bottom-up
  const dirs = new Set<string>()
  for (const file of qt.files) {
    const fullPath = path.join(downloadPath, file.path)
    const fileExists = existsSync(fullPath)
    if (fileExists) {
      try {
        rmSync(fullPath, { force: true })
        console.log(`[WebTorrentService:delete]   deleted file: "${fullPath}"`)
      } catch (err) {
        console.error(`[WebTorrentService:delete]   FAILED to delete file: "${fullPath}"`, err)
      }
    } else {
      console.log(`[WebTorrentService:delete]   file not found: "${fullPath}"`)
    }
    let dir = path.dirname(fullPath)
    while (dir.length > downloadPath.length && dir.startsWith(downloadPath)) {
      dirs.add(dir)
      dir = path.dirname(dir)
    }
  }

  console.log(`[WebTorrentService:delete]   collected ${dirs.size} directories to clean up`)
  const sortedDirs = [...dirs].sort((a, b) => b.length - a.length)
  for (const dir of sortedDirs) {
    const dirExists = existsSync(dir)
    let contents: string[] = []
    try { contents = readdirSync(dir) } catch {}
    console.log(`[WebTorrentService:delete]   dir "${dir}" exists=${dirExists} contents=[${contents.join(', ')}]`)
    if (dirExists) {
      try {
        rmSync(dir, { recursive: true, force: true })
        console.log(`[WebTorrentService:delete]   removed dir: "${dir}"`)
      } catch (err) {
        console.error(`[WebTorrentService:delete]   FAILED to remove dir: "${dir}"`, err)
      }
    }
  }
  console.log(`[WebTorrentService:delete] Done with fallback deletion`)
}

/**
 * Clean up after a partial download: delete deselected files and empty directories.
 * WebTorrent's file.deselect() only deprioritizes — it may still create files/dirs
 * for deselected entries. This method removes those artifacts.
 */
export function cleanupDeselectedFiles(qt: QueuedTorrent): void {
  if (!qt.downloadPath) return
  const downloadPath = path.resolve(qt.downloadPath)
  const deselected = qt.files.filter(f => !f.selected)
  console.log(`[WebTorrentService:cleanup] Starting cleanup for "${qt.name}": ${deselected.length} deselected files`)

  // Step 1: Delete deselected files from disk
  let filesDeleted = 0
  const dirs = new Set<string>()
  for (const file of deselected) {
    const fullPath = path.join(downloadPath, file.path)
    try {
      if (existsSync(fullPath)) {
        rmSync(fullPath, { force: true })
        filesDeleted++
        console.log(`[WebTorrentService:cleanup]   deleted deselected file: "${file.path}"`)
      }
    } catch (err) {
      console.error(`[WebTorrentService:cleanup]   FAILED to delete file "${file.path}":`, err)
    }
    // Collect parent directories up to downloadPath
    let dir = path.dirname(fullPath)
    while (dir.length > downloadPath.length && dir.startsWith(downloadPath)) {
      dirs.add(dir)
      dir = path.dirname(dir)
    }
  }
  console.log(`[WebTorrentService:cleanup]   deleted ${filesDeleted} deselected files`)

  // Step 2: Remove empty directories bottom-up (deepest first)
  const sortedDirs = [...dirs].sort((a, b) => b.length - a.length)
  let dirsRemoved = 0
  for (const dir of sortedDirs) {
    try {
      if (!existsSync(dir)) continue
      const contents = readdirSync(dir)
      if (contents.length === 0) {
        rmSync(dir, { recursive: true, force: true })
        dirsRemoved++
        console.log(`[WebTorrentService:cleanup]   removed empty dir: "${dir}"`)
      }
    } catch (err) {
      console.error(`[WebTorrentService:cleanup]   FAILED on dir "${dir}":`, err)
    }
  }
  console.log(`[WebTorrentService:cleanup] Done: ${filesDeleted} files, ${dirsRemoved} dirs removed for "${qt.name}"`)
}
