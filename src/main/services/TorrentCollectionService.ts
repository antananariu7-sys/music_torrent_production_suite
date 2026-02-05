import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  CollectedTorrent,
  TorrentCollectionFile,
} from '@shared/types/torrent.types'

/**
 * Service for managing persistent torrent collection storage
 */
export class TorrentCollectionService {
  private readonly COLLECTION_FILE_NAME = 'torrent-collection.json'

  /**
   * Get the path to the torrent collection file for a project
   */
  private getCollectionFilePath(projectDirectory: string): string {
    return path.join(projectDirectory, this.COLLECTION_FILE_NAME)
  }

  /**
   * Load torrent collection for a project
   */
  async loadCollection(
    projectId: string,
    projectDirectory: string
  ): Promise<CollectedTorrent[]> {
    try {
      const filePath = this.getCollectionFilePath(projectDirectory)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch {
        // File doesn't exist, return empty collection
        return []
      }

      // Read and parse file
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const collectionFile: TorrentCollectionFile = JSON.parse(fileContent)

      // Verify project ID matches
      if (collectionFile.projectId !== projectId) {
        console.warn(
          `[TorrentCollectionService] Project ID mismatch in collection file. Expected ${projectId}, got ${collectionFile.projectId}`
        )
        return []
      }

      return collectionFile.torrents || []
    } catch (error) {
      console.error('[TorrentCollectionService] Error loading torrent collection:', error)
      return []
    }
  }

  /**
   * Save torrent collection for a project
   */
  async saveCollection(
    projectId: string,
    projectName: string,
    projectDirectory: string,
    torrents: CollectedTorrent[]
  ): Promise<void> {
    try {
      const filePath = this.getCollectionFilePath(projectDirectory)

      const collectionFile: TorrentCollectionFile = {
        projectId,
        projectName,
        torrents,
        lastUpdated: new Date().toISOString(),
      }

      await fs.writeFile(filePath, JSON.stringify(collectionFile, null, 2), 'utf-8')

      console.log(
        `[TorrentCollectionService] Saved ${torrents.length} torrents to ${filePath}`
      )
    } catch (error) {
      console.error('[TorrentCollectionService] Error saving torrent collection:', error)
      throw error
    }
  }

  /**
   * Clear torrent collection for a project
   */
  async clearCollection(projectDirectory: string): Promise<void> {
    try {
      const filePath = this.getCollectionFilePath(projectDirectory)

      try {
        await fs.unlink(filePath)
        console.log(`[TorrentCollectionService] Cleared torrent collection at ${filePath}`)
      } catch (error) {
        // File might not exist, ignore error
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
    } catch (error) {
      console.error('[TorrentCollectionService] Error clearing torrent collection:', error)
      throw error
    }
  }
}

// Singleton instance
export const torrentCollectionService = new TorrentCollectionService()
