import path from 'path'
import { existsSync, rmSync, readdirSync, statSync } from 'fs'
import { execSync } from 'child_process'
import type { QueuedTorrent } from '@shared/types/torrent.types'

/**
 * Aggressively delete a directory.
 * Tries Node rmSync first; on Windows escalates to `cmd /c rmdir /s /q`
 * which uses a different OS deletion path and can succeed where rmSync can't
 * (e.g. when Windows Defender / Search Indexer holds a handle on the dir).
 */
function forceDeleteDir(dir: string): boolean {
  try { rmSync(dir, { recursive: true, force: true }) } catch {}
  if (!existsSync(dir)) return true

  if (process.platform === 'win32') {
    try {
      execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: 'pipe', timeout: 10000 })
    } catch {}
    if (!existsSync(dir)) return true
  }

  return false
}

/**
 * Delete the empty directory tree WebTorrent creates at metadata time, before
 * Windows Defender / Search Indexer can acquire handles on the new directories.
 *
 * WebTorrent pre-creates the full directory structure for ALL torrent files when
 * metadata resolves, even for deselected entries. Deleting it immediately (while
 * the dirs are still empty and no external process has locked them) prevents the
 * "directory still exists after rmSync" problem entirely.
 *
 * WebTorrent's random-access-file uses mkdirp, so it will recreate only the
 * directories it actually needs (selected files) when download starts.
 *
 * Safety guard: if the torrent root already contains files (re-download), we skip
 * deletion to avoid losing existing data.
 */
export function clearPreCreatedDirs(downloadPath: string, torrentName: string): void {
  if (!torrentName || !downloadPath) return
  const torrentRoot = path.join(path.resolve(downloadPath), torrentName)
  if (!existsSync(torrentRoot)) return

  if (hasAnyFiles(torrentRoot)) {
    console.log(`[WebTorrentService] Skipping early dir clear — existing files found in: ${torrentRoot}`)
    return
  }

  if (forceDeleteDir(torrentRoot)) {
    console.log(`[WebTorrentService] Cleared pre-created dir structure: ${torrentRoot}`)
  } else {
    console.warn(`[WebTorrentService] Could not clear pre-created dirs (non-fatal): ${torrentRoot}`)
  }
}

function hasAnyFiles(dir: string): boolean {
  try {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      if (item.isFile()) return true
      if (item.isDirectory() && hasAnyFiles(path.join(dir, item.name))) return true
    }
  } catch {}
  return false
}

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
  // Priority: torrentRootFolder (actual WebTorrent name on disk) > qt.name > first file path segment
  const candidates = new Set<string>()
  if (qt.torrentRootFolder) candidates.add(qt.torrentRootFolder)
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
      if (forceDeleteDir(rootDir)) {
        console.log(`[WebTorrentService:delete] SUCCESS: Deleted torrent directory: ${rootDir}`)
        return
      }
      console.warn(`[WebTorrentService:delete]   WARN: could not delete directory, falling back to individual file deletion: ${rootDir}`)
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

  // Clean up directories bottom-up — only remove empty ones.
  // Recursive deletion is intentionally avoided: non-empty dirs may contain unselected
  // files from other albums, and rmSync can fail silently on Windows when Explorer has them open.
  console.log(`[WebTorrentService:delete]   collected ${dirs.size} directories to clean up`)
  const sortedDirs = [...dirs].sort((a, b) => b.length - a.length)
  for (const dir of sortedDirs) {
    try {
      if (!existsSync(dir)) continue
      const contents = readdirSync(dir)
      console.log(`[WebTorrentService:delete]   dir "${dir}" contents=[${contents.join(', ')}]`)
      if (contents.length === 0) {
        if (forceDeleteDir(dir)) {
          console.log(`[WebTorrentService:delete]   removed empty dir: "${dir}"`)
        } else {
          console.warn(`[WebTorrentService:delete]   WARN: dir still exists after aggressive delete: "${dir}"`)
        }
      } else {
        console.log(`[WebTorrentService:delete]   skipping non-empty dir (${contents.length} items remain)`)
      }
    } catch (err) {
      console.error(`[WebTorrentService:delete]   FAILED on dir: "${dir}"`, err)
    }
  }
  console.log(`[WebTorrentService:delete] Done with fallback deletion`)
}

/**
 * Clean up after a partial download: delete deselected files and their directories.
 *
 * Strategy:
 * 1. Delete all deselected files from disk.
 * 2. Build the set of directories that are ancestors of selected files — these must be kept.
 * 3. Delete any directory from the deselected file paths that is NOT an ancestor of a
 *    selected file. Uses recursive deletion to handle phantom dirs/files created by
 *    WebTorrent that are not tracked in qt.files.
 * 4. Retries directory deletion with backoff — on Windows, OS file handles may still be
 *    held briefly after torrent.destroy() fires, causing rmSync to silently "succeed"
 *    while the directory remains in a pending-delete state.
 */
export async function cleanupDeselectedFiles(qt: QueuedTorrent): Promise<void> {
  if (!qt.downloadPath) return
  const downloadPath = path.resolve(qt.downloadPath)
  const deselected = qt.files.filter(f => !f.selected)
  console.log(`[WebTorrentService:cleanup] Starting cleanup for "${qt.name}": ${deselected.length} deselected files`)

  // Step 1: Delete deselected files from disk
  let filesDeleted = 0
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
  }
  console.log(`[WebTorrentService:cleanup]   deleted ${filesDeleted} deselected files`)

  // Step 2: Compute dirs that must be kept (ancestors of selected files)
  const selectedDirs = new Set<string>()
  for (const file of qt.files.filter(f => f.selected)) {
    let dir = path.dirname(path.join(downloadPath, file.path))
    while (dir.length > downloadPath.length && dir.startsWith(downloadPath)) {
      selectedDirs.add(dir)
      dir = path.dirname(dir)
    }
  }

  // Step 3: Collect dirs from deselected file paths, deepest first
  const dirsToDelete = new Set<string>()
  for (const file of deselected) {
    let dir = path.dirname(path.join(downloadPath, file.path))
    while (dir.length > downloadPath.length && dir.startsWith(downloadPath)) {
      dirsToDelete.add(dir)
      dir = path.dirname(dir)
    }
  }

  // Step 4: Delete dirs with no selected content, with retry-backoff for Windows handle release.
  // All dirs are attempted in each pass; only failures are retried — so the delay applies once
  // per round, not once per directory.
  const sortedDirs = [...dirsToDelete]
    .filter(d => !selectedDirs.has(d))
    .sort((a, b) => b.length - a.length)

  let dirsRemoved = 0
  const RETRY_DELAYS_MS = [500, 1000, 2000]
  let pending = sortedDirs.filter(d => existsSync(d))

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]))
      console.log(`[WebTorrentService:cleanup]   retry ${attempt}: ${pending.length} dirs pending`)
    }

    const failed: string[] = []
    for (const dir of pending) {
      if (!existsSync(dir)) continue  // already deleted (e.g. as child of a parent entry)
      if (forceDeleteDir(dir)) {
        dirsRemoved++
        console.log(`[WebTorrentService:cleanup]   removed dir: "${dir}"`)
      } else {
        failed.push(dir)
      }
    }
    pending = failed
    if (pending.length === 0) break
  }

  for (const dir of pending) {
    console.warn(`[WebTorrentService:cleanup]   WARN: could not remove "${dir}" after retries`)
  }
  console.log(`[WebTorrentService:cleanup] Done: ${filesDeleted} files, ${dirsRemoved} dirs removed for "${qt.name}"`)
}
