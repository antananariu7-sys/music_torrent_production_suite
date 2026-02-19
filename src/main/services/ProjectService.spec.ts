import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { ProjectService } from './ProjectService'
import { FileSystemService } from './FileSystemService'
import { ConfigService } from './ConfigService'
import { LockService } from './LockService'

// Mock electron-store for ConfigService
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    let store: Record<string, unknown> = {}
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        return store[key] !== undefined ? store[key] : defaultValue
      }),
      set: jest.fn((key: string, value: unknown) => {
        store[key] = value
      }),
      delete: jest.fn((key: string) => {
        delete store[key]
      }),
      clear: jest.fn(() => {
        store = {}
      }),
      has: jest.fn((key: string) => {
        return key in store
      }),
    }
  })
})

describe('ProjectService', () => {
  let projectService: ProjectService
  let fileSystemService: FileSystemService
  let configService: ConfigService
  let lockService: LockService
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `project-test-${Date.now()}`)
    await fs.ensureDir(testDir)

    // Initialize services
    fileSystemService = new FileSystemService()
    configService = new ConfigService()
    lockService = new LockService()
    projectService = new ProjectService(fileSystemService, configService, lockService)
  })

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir)
    }
  })

  describe('createProject', () => {
    it('should create a new project with all required fields', async () => {
      const projectName = 'Test Project'
      const project = await projectService.createProject(projectName, testDir)

      expect(project.id).toBeDefined()
      expect(project.name).toBe(projectName)
      expect(project.createdAt).toBeInstanceOf(Date)
      expect(project.updatedAt).toBeInstanceOf(Date)
      expect(project.projectDirectory).toContain(projectName)
      expect(project.songs).toEqual([])
      expect(project.mixMetadata.tags).toEqual([])
      expect(project.isActive).toBe(true)
    })

    it('should create project directory structure', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      expect(await fs.pathExists(project.projectDirectory)).toBe(true)
      expect(await fs.pathExists(path.join(project.projectDirectory, 'assets'))).toBe(true)
      expect(await fs.pathExists(path.join(project.projectDirectory, 'assets', 'covers'))).toBe(true)
      expect(await fs.pathExists(path.join(project.projectDirectory, 'assets', 'audio'))).toBe(true)
    })

    it('should create project.json file', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      expect(await fs.pathExists(projectFilePath)).toBe(true)

      const savedProject = await fs.readJson(projectFilePath)
      expect(savedProject.id).toBe(project.id)
      expect(savedProject.name).toBe(project.name)
    })

    it('should acquire lock for new project', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const isLocked = await lockService.isLocked(project.id, project.projectDirectory)
      expect(isLocked).toBe(true)
    })

    it('should add project to recent projects', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const recentProjects = configService.getRecentProjects()
      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].projectId).toBe(project.id)
    })

    it('should reject invalid project names', async () => {
      await expect(
        projectService.createProject('Invalid<Name', testDir)
      ).rejects.toThrow(/invalid/i)
    })

    it('should throw error if project already exists', async () => {
      await projectService.createProject('Existing Project', testDir)

      await expect(
        projectService.createProject('Existing Project', testDir)
      ).rejects.toThrow(/already exists/i)
    })

    it('should add description if provided', async () => {
      const description = 'Test project description'
      const project = await projectService.createProject('Test Project', testDir, description)

      expect(project.description).toBe(description)
    })
  })

  describe('openProject', () => {
    it('should open existing project', async () => {
      // Create a project first
      const created = await projectService.createProject('Test Project', testDir)
      await projectService.closeProject(created.id)

      // Open it
      const projectFilePath = path.join(created.projectDirectory, 'project.json')
      const opened = await projectService.openProject(projectFilePath)

      expect(opened.id).toBe(created.id)
      expect(opened.name).toBe(created.name)
      expect(opened.isActive).toBe(true)
    })

    it('should acquire lock when opening', async () => {
      const created = await projectService.createProject('Test Project', testDir)
      await projectService.closeProject(created.id)

      const projectFilePath = path.join(created.projectDirectory, 'project.json')
      const opened = await projectService.openProject(projectFilePath)

      const isLocked = await lockService.isLocked(opened.id, opened.projectDirectory)
      expect(isLocked).toBe(true)
    })

    it('should throw error if project is already locked', async () => {
      const created = await projectService.createProject('Test Project', testDir)
      const projectFilePath = path.join(created.projectDirectory, 'project.json')

      await expect(
        projectService.openProject(projectFilePath)
      ).rejects.toThrow(/already locked/i)
    })

    it('should throw error if project file does not exist', async () => {
      const nonExistentPath = path.join(testDir, 'nonexistent', 'project.json')

      await expect(
        projectService.openProject(nonExistentPath)
      ).rejects.toThrow()
    })

    it('should add to recent projects when opened', async () => {
      const created = await projectService.createProject('Test Project', testDir)
      await projectService.closeProject(created.id)

      const projectFilePath = path.join(created.projectDirectory, 'project.json')
      await projectService.openProject(projectFilePath)

      const recentProjects = configService.getRecentProjects()
      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].projectId).toBe(created.id)
    })
  })

  describe('saveProject', () => {
    it('should save project to disk', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      // Modify project
      project.description = 'Modified description'
      await projectService.saveProject(project)

      // Read from disk
      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.description).toBe('Modified description')
    })

    it('should update updatedAt timestamp', async () => {
      const project = await projectService.createProject('Test Project', testDir)
      const originalUpdatedAt = project.updatedAt

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      await projectService.saveProject(project)

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(new Date(savedProject.updatedAt).getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      )
    })

    it('should throw error if project directory does not exist', async () => {
      const project = await projectService.createProject('Test Project', testDir)
      await fs.remove(project.projectDirectory)

      await expect(
        projectService.saveProject(project)
      ).rejects.toThrow()
    })
  })

  describe('closeProject', () => {
    it('should release lock when closing', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.closeProject(project.id)

      const isLocked = await lockService.isLocked(project.id, project.projectDirectory)
      expect(isLocked).toBe(false)
    })

    it('should set isActive to false', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.closeProject(project.id)

      expect(project.isActive).toBe(false)
    })

    it('should save project before closing', async () => {
      const project = await projectService.createProject('Test Project', testDir)
      project.description = 'Modified before close'

      await projectService.closeProject(project.id)

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.description).toBe('Modified before close')
    })

    it('should not throw error if project is not open', async () => {
      await expect(
        projectService.closeProject('nonexistent-id')
      ).resolves.not.toThrow()
    })
  })

  describe('addSong', () => {
    it('should add song to project', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const updatedProject = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/path/song.mp3',
        order: 0,
      })

      const song = updatedProject.songs[0]
      expect(song.id).toBeDefined()
      expect(song.title).toBe('Test Song')
      expect(song.externalFilePath).toBe('/test/path/song.mp3')
      expect(song.order).toBe(0)
      expect(updatedProject.songs).toHaveLength(1)
    })

    it('should assign unique ID to song', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const p1 = await projectService.addSong(project.id, {
        title: 'Song 1',
        externalFilePath: '/test/song1.mp3',
        order: 0,
      })

      const p2 = await projectService.addSong(project.id, {
        title: 'Song 2',
        externalFilePath: '/test/song2.mp3',
        order: 1,
      })

      expect(p1.songs[0].id).not.toBe(p2.songs[1].id)
    })

    it('should set addedAt timestamp', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const updatedProject = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })

      expect(updatedProject.songs[0].addedAt).toBeInstanceOf(Date)
    })

    it('should auto-save project after adding song', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.songs).toHaveLength(1)
    })

    it('should throw error if project does not exist', async () => {
      await expect(
        projectService.addSong('nonexistent-id', {
          title: 'Test Song',
          externalFilePath: '/test/song.mp3',
          order: 0,
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('removeSong', () => {
    it('should remove song from project', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const updatedProject = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })

      await projectService.removeSong(project.id, updatedProject.songs[0].id)

      expect(project.songs).toHaveLength(0)
    })

    it('should auto-save project after removing song', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const updatedProject = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })

      await projectService.removeSong(project.id, updatedProject.songs[0].id)

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.songs).toHaveLength(0)
    })

    it('should throw error if song does not exist', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await expect(
        projectService.removeSong(project.id, 'nonexistent-song-id')
      ).rejects.toThrow(/not found/i)
    })

    it('should throw error if project does not exist', async () => {
      await expect(
        projectService.removeSong('nonexistent-id', 'song-id')
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('updateSong', () => {
    it('should update song properties', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const addedProject = await projectService.addSong(project.id, {
        title: 'Original Title',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })
      const songId = addedProject.songs[0].id

      await projectService.updateSong(project.id, songId, {
        title: 'Updated Title',
        artist: 'New Artist',
      })

      const updatedSong = project.songs.find((s) => s.id === songId)
      expect(updatedSong?.title).toBe('Updated Title')
      expect(updatedSong?.artist).toBe('New Artist')
    })

    it('should auto-save project after updating song', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const addedProject = await projectService.addSong(project.id, {
        title: 'Test Song',
        externalFilePath: '/test/song.mp3',
        order: 0,
      })

      await projectService.updateSong(project.id, addedProject.songs[0].id, {
        title: 'Updated Title',
      })

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.songs[0].title).toBe('Updated Title')
    })

    it('should throw error if song does not exist', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await expect(
        projectService.updateSong(project.id, 'nonexistent-song-id', {
          title: 'Updated',
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('updateMixMetadata', () => {
    it('should update mix metadata', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.updateMixMetadata(project.id, {
        title: 'My Mix',
        description: 'Test mix description',
        tags: ['electronic', 'chill'],
      })

      expect(project.mixMetadata.title).toBe('My Mix')
      expect(project.mixMetadata.description).toBe('Test mix description')
      expect(project.mixMetadata.tags).toEqual(['electronic', 'chill'])
    })

    it('should auto-save project after updating metadata', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.updateMixMetadata(project.id, {
        title: 'My Mix',
      })

      const projectFilePath = path.join(project.projectDirectory, 'project.json')
      const savedProject = await fs.readJson(projectFilePath)

      expect(savedProject.mixMetadata.title).toBe('My Mix')
    })

    it('should throw error if project does not exist', async () => {
      await expect(
        projectService.updateMixMetadata('nonexistent-id', {
          title: 'Test',
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('getProjectStats', () => {
    it('should calculate project statistics', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      await projectService.addSong(project.id, {
        title: 'Song 1',
        externalFilePath: '/test/song1.mp3',
        order: 0,
        metadata: {
          duration: 180,
          fileSize: 5000000,
          format: 'mp3',
        },
      })

      await projectService.addSong(project.id, {
        title: 'Song 2',
        downloadId: '123e4567-e89b-12d3-a456-426614174000',
        order: 1,
        metadata: {
          duration: 240,
          fileSize: 8000000,
          format: 'flac',
        },
      })

      const stats = await projectService.getProjectStats(project.id)

      expect(stats.totalSongs).toBe(2)
      expect(stats.totalDuration).toBe(420) // 180 + 240
      expect(stats.totalSize).toBe(13000000) // 5000000 + 8000000
      expect(stats.externalSongs).toBe(1)
      expect(stats.downloadedSongs).toBe(1)
      expect(stats.formatBreakdown).toEqual({ mp3: 1, flac: 1 })
    })

    it('should handle projects with no songs', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const stats = await projectService.getProjectStats(project.id)

      expect(stats.totalSongs).toBe(0)
      expect(stats.totalDuration).toBe(0)
      expect(stats.totalSize).toBe(0)
    })

    it('should throw error if project does not exist', async () => {
      await expect(
        projectService.getProjectStats('nonexistent-id')
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('getActiveProject', () => {
    it('should return currently active project', async () => {
      const project = await projectService.createProject('Test Project', testDir)

      const active = projectService.getActiveProject()

      expect(active).toBeDefined()
      expect(active?.id).toBe(project.id)
    })

    it('should return null if no project is active', () => {
      const active = projectService.getActiveProject()

      expect(active).toBeNull()
    })
  })

  describe('hasActiveProject', () => {
    it('should return true if project is active', async () => {
      await projectService.createProject('Test Project', testDir)

      expect(projectService.hasActiveProject()).toBe(true)
    })

    it('should return false if no project is active', () => {
      expect(projectService.hasActiveProject()).toBe(false)
    })
  })
})
