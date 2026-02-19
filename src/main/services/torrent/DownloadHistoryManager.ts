import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { TorrentFile, TorrentSettings } from '@shared/types/torrent.types'

/**
 * DownloadHistoryManager
 *
 * Manages per-project download history for torrent files.
 */
export class DownloadHistoryManager {
  private downloadHistory: TorrentFile[] = []
  private historyFilePath: string

  constructor(torrentsFolder: string) {
    this.historyFilePath = path.join(torrentsFolder, '.download-history.json')
  }

  /**
   * Get the history file path for a given project directory (or fallback).
   */
  private getHistoryPath(projectDirectory?: string): string {
    if (projectDirectory) {
      return path.join(projectDirectory, '.download-history.json')
    }
    return this.historyFilePath
  }

  /**
   * Load download history from disk.
   */
  load(projectDirectory?: string, keepHistory = true): void {
    if (!keepHistory) return

    const filePath = this.getHistoryPath(projectDirectory)
    try {
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8')
        const items = JSON.parse(data) as Array<Omit<TorrentFile, 'downloadedAt'> & { downloadedAt: string }>
        this.downloadHistory = items.map((item) => ({
          ...item,
          downloadedAt: new Date(item.downloadedAt),
        }))
        console.log(`[TorrentDownloadService] Loaded ${this.downloadHistory.length} items from history (${filePath})`)
      }
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to load history:', error)
      this.downloadHistory = []
    }
  }

  /**
   * Save download history to disk.
   */
  save(projectDirectory?: string, keepHistory = true): void {
    if (!keepHistory) return

    const filePath = this.getHistoryPath(projectDirectory)
    try {
      writeFileSync(filePath, JSON.stringify(this.downloadHistory, null, 2))
      console.log(`[TorrentDownloadService] Saved download history (${filePath})`)
    } catch (error) {
      console.error('[TorrentDownloadService] Failed to save history:', error)
    }
  }

  /**
   * Add a torrent file to the history.
   */
  addEntry(torrentFile: TorrentFile, projectDirectory?: string, keepHistory = true): void {
    if (!keepHistory) return
    this.load(projectDirectory, keepHistory)
    this.downloadHistory.push(torrentFile)
    this.save(projectDirectory, keepHistory)
  }

  /**
   * Get download history for a project directory (or fallback).
   */
  getHistory(projectDirectory?: string, keepHistory = true): TorrentFile[] {
    this.load(projectDirectory, keepHistory)
    return this.downloadHistory
  }

  /**
   * Clear download history.
   */
  clearHistory(projectDirectory?: string, keepHistory = true): void {
    this.downloadHistory = []
    this.save(projectDirectory, keepHistory)
    console.log('[TorrentDownloadService] Download history cleared')
  }
}
