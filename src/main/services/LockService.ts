import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { ProjectLock } from '../../shared/types/project.types'

/**
 * LockService
 *
 * Manages project locks to prevent concurrent modifications.
 * Creates lock files in project directories to indicate a project is in use.
 * Detects and cleans up stale locks from processes that no longer exist.
 */
export class LockService {
  private static readonly LOCK_FILE_NAME = '.lock'
  private static readonly STALE_LOCK_TIMEOUT = 24 * 60 * 60 * 1000 // 24 hours in ms

  /**
   * Acquires a lock for a project
   *
   * @param projectId - Project ID
   * @param projectDir - Project directory path
   * @returns ProjectLock object
   * @throws Error if project is already locked or directory doesn't exist
   */
  async acquireLock(projectId: string, projectDir: string): Promise<ProjectLock> {
    // Check if project directory exists
    if (!await fs.pathExists(projectDir)) {
      throw new Error(`Project directory does not exist: ${projectDir}`)
    }

    // Check if already locked
    const existingLock = await this.getLockFromFile(projectDir)
    if (existingLock) {
      const isStale = await this.isLockStale(existingLock)
      if (!isStale) {
        throw new Error(
          `Project is already locked by process ${existingLock.lockedBy.pid} ` +
          `on ${existingLock.lockedBy.hostname}`
        )
      }
      // Stale lock exists, will overwrite it
    }

    // Create new lock
    const lock: ProjectLock = {
      projectId,
      lockedBy: {
        pid: process.pid,
        hostname: os.hostname(),
      },
      lockedAt: new Date(),
    }

    // Write lock file
    const lockFilePath = path.join(projectDir, LockService.LOCK_FILE_NAME)
    await fs.writeJson(lockFilePath, lock, { spaces: 2 })

    return lock
  }

  /**
   * Releases a lock for a project
   * Does nothing if no lock exists
   *
   * @param projectId - Project ID
   * @param projectDir - Project directory path
   */
  async releaseLock(_projectId: string, projectDir: string): Promise<void> {
    const lockFilePath = path.join(projectDir, LockService.LOCK_FILE_NAME)

    if (await fs.pathExists(lockFilePath)) {
      await fs.remove(lockFilePath)
    }
  }

  /**
   * Checks if a project is currently locked
   * Stale locks are considered unlocked
   *
   * @param projectId - Project ID
   * @param projectDir - Project directory path
   * @returns True if locked, false otherwise
   */
  async isLocked(projectId: string, projectDir: string): Promise<boolean> {
    const lock = await this.getLock(projectId, projectDir)
    return lock !== null
  }

  /**
   * Gets the current lock for a project
   * Returns null if no valid lock exists
   *
   * @param projectId - Project ID
   * @param projectDir - Project directory path
   * @returns ProjectLock or null
   */
  async getLock(_projectId: string, projectDir: string): Promise<ProjectLock | null> {
    const lock = await this.getLockFromFile(projectDir)

    if (!lock) {
      return null
    }

    // Check if lock is stale
    const isStale = await this.isLockStale(lock)
    if (isStale) {
      return null
    }

    return lock
  }

  /**
   * Checks if a lock is stale
   * A lock is stale if:
   * 1. The process no longer exists, OR
   * 2. The lock is older than STALE_LOCK_TIMEOUT (24 hours)
   *
   * @param lock - ProjectLock to check
   * @returns True if stale, false otherwise
   */
  async isLockStale(lock: ProjectLock): Promise<boolean> {
    // Check if lock is too old
    const lockAge = Date.now() - new Date(lock.lockedAt).getTime()
    if (lockAge > LockService.STALE_LOCK_TIMEOUT) {
      return true
    }

    // Check if process still exists
    try {
      // Sending signal 0 doesn't kill the process, just checks if it exists
      process.kill(lock.lockedBy.pid, 0)
      return false // Process exists, lock is not stale
    } catch (error) {
      // Process doesn't exist, lock is stale
      return true
    }
  }

  /**
   * Reads lock file from project directory
   * Returns null if lock file doesn't exist or is invalid
   *
   * @param projectDir - Project directory path
   * @returns ProjectLock or null
   */
  private async getLockFromFile(projectDir: string): Promise<ProjectLock | null> {
    const lockFilePath = path.join(projectDir, LockService.LOCK_FILE_NAME)

    if (!await fs.pathExists(lockFilePath)) {
      return null
    }

    try {
      const lock = await fs.readJson(lockFilePath) as ProjectLock
      // Convert date string to Date object
      lock.lockedAt = new Date(lock.lockedAt)
      return lock
    } catch (error) {
      // Invalid lock file, consider as no lock
      return null
    }
  }
}
