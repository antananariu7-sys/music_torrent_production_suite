import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { LockService } from './LockService'
import { ProjectLock } from '../../shared/types/project.types'

describe('LockService', () => {
  let lockService: LockService
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `lock-test-${Date.now()}`)
    await fs.ensureDir(testDir)

    lockService = new LockService()
  })

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir)
    }
  })

  describe('acquireLock', () => {
    it('should acquire lock for unlocked project', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      const lock = await lockService.acquireLock(projectId, projectDir)

      expect(lock).toBeDefined()
      expect(lock.projectId).toBe(projectId)
      expect(lock.lockedBy.pid).toBe(process.pid)
      expect(lock.lockedBy.hostname).toBe(os.hostname())
      expect(lock.lockedAt).toBeInstanceOf(Date)
    })

    it('should create lock file in project directory', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await lockService.acquireLock(projectId, projectDir)

      const lockFilePath = path.join(projectDir, '.lock')
      expect(await fs.pathExists(lockFilePath)).toBe(true)
    })

    it('should throw error if project is already locked', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await lockService.acquireLock(projectId, projectDir)

      await expect(
        lockService.acquireLock(projectId, projectDir)
      ).rejects.toThrow(/already locked/i)
    })

    it('should acquire lock if existing lock is stale (process does not exist)', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      // Create a stale lock with non-existent PID
      const staleLock: ProjectLock = {
        projectId,
        lockedBy: {
          pid: 999999, // Non-existent PID
          hostname: os.hostname(),
        },
        lockedAt: new Date(),
      }

      const lockFilePath = path.join(projectDir, '.lock')
      await fs.writeJson(lockFilePath, staleLock)

      // Should be able to acquire lock
      const lock = await lockService.acquireLock(projectId, projectDir)

      expect(lock.lockedBy.pid).toBe(process.pid)
    })

    it('should acquire lock if existing lock is stale (older than 24 hours)', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      // Create a stale lock older than 24 hours
      const staleDate = new Date()
      staleDate.setHours(staleDate.getHours() - 25) // 25 hours ago

      const staleLock: ProjectLock = {
        projectId,
        lockedBy: {
          pid: process.pid, // Same process, but old lock
          hostname: os.hostname(),
        },
        lockedAt: staleDate,
      }

      const lockFilePath = path.join(projectDir, '.lock')
      await fs.writeJson(lockFilePath, staleLock)

      // Should be able to acquire lock
      const lock = await lockService.acquireLock(projectId, projectDir)

      expect(lock.lockedAt.getTime()).toBeGreaterThan(staleDate.getTime())
    })

    it('should throw error if project directory does not exist', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const nonExistentDir = path.join(testDir, 'NonExistent')

      await expect(
        lockService.acquireLock(projectId, nonExistentDir)
      ).rejects.toThrow(/does not exist/i)
    })
  })

  describe('releaseLock', () => {
    it('should release lock and remove lock file', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await lockService.acquireLock(projectId, projectDir)
      await lockService.releaseLock(projectId, projectDir)

      const lockFilePath = path.join(projectDir, '.lock')
      expect(await fs.pathExists(lockFilePath)).toBe(false)
    })

    it('should not throw error if no lock exists', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await expect(
        lockService.releaseLock(projectId, projectDir)
      ).resolves.not.toThrow()
    })

    it('should not throw error if project directory does not exist', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const nonExistentDir = path.join(testDir, 'NonExistent')

      await expect(
        lockService.releaseLock(projectId, nonExistentDir)
      ).resolves.not.toThrow()
    })
  })

  describe('isLocked', () => {
    it('should return false for unlocked project', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      const isLocked = await lockService.isLocked(projectId, projectDir)

      expect(isLocked).toBe(false)
    })

    it('should return true for locked project', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await lockService.acquireLock(projectId, projectDir)
      const isLocked = await lockService.isLocked(projectId, projectDir)

      expect(isLocked).toBe(true)
    })

    it('should return false if lock is stale', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      // Create stale lock
      const staleLock: ProjectLock = {
        projectId,
        lockedBy: {
          pid: 999999, // Non-existent PID
          hostname: os.hostname(),
        },
        lockedAt: new Date(),
      }

      const lockFilePath = path.join(projectDir, '.lock')
      await fs.writeJson(lockFilePath, staleLock)

      const isLocked = await lockService.isLocked(projectId, projectDir)

      expect(isLocked).toBe(false)
    })

    it('should return false if project directory does not exist', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const nonExistentDir = path.join(testDir, 'NonExistent')

      const isLocked = await lockService.isLocked(projectId, nonExistentDir)

      expect(isLocked).toBe(false)
    })
  })

  describe('getLock', () => {
    it('should return null for unlocked project', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      const lock = await lockService.getLock(projectId, projectDir)

      expect(lock).toBeNull()
    })

    it('should return lock information for locked project', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      await lockService.acquireLock(projectId, projectDir)
      const lock = await lockService.getLock(projectId, projectDir)

      expect(lock).toBeDefined()
      expect(lock?.projectId).toBe(projectId)
      expect(lock?.lockedBy.pid).toBe(process.pid)
    })

    it('should return null for stale lock', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const projectDir = path.join(testDir, 'TestProject')
      await fs.ensureDir(projectDir)

      // Create stale lock
      const staleLock: ProjectLock = {
        projectId,
        lockedBy: {
          pid: 999999, // Non-existent PID
          hostname: os.hostname(),
        },
        lockedAt: new Date(),
      }

      const lockFilePath = path.join(projectDir, '.lock')
      await fs.writeJson(lockFilePath, staleLock)

      const lock = await lockService.getLock(projectId, projectDir)

      expect(lock).toBeNull()
    })

    it('should return null if project directory does not exist', async () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const nonExistentDir = path.join(testDir, 'NonExistent')

      const lock = await lockService.getLock(projectId, nonExistentDir)

      expect(lock).toBeNull()
    })
  })

  describe('isLockStale', () => {
    it('should detect stale lock with non-existent process', async () => {
      const staleLock: ProjectLock = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        lockedBy: {
          pid: 999999, // Non-existent PID
          hostname: os.hostname(),
        },
        lockedAt: new Date(),
      }

      const isStale = await lockService.isLockStale(staleLock)

      expect(isStale).toBe(true)
    })

    it('should detect stale lock older than 24 hours', async () => {
      const staleDate = new Date()
      staleDate.setHours(staleDate.getHours() - 25)

      const staleLock: ProjectLock = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        lockedBy: {
          pid: process.pid,
          hostname: os.hostname(),
        },
        lockedAt: staleDate,
      }

      const isStale = await lockService.isLockStale(staleLock)

      expect(isStale).toBe(true)
    })

    it('should return false for fresh lock with existing process', async () => {
      const freshLock: ProjectLock = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        lockedBy: {
          pid: process.pid,
          hostname: os.hostname(),
        },
        lockedAt: new Date(),
      }

      const isStale = await lockService.isLockStale(freshLock)

      expect(isStale).toBe(false)
    })
  })
})
