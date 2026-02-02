import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { ConfigService } from './ConfigService'
import { RecentProject } from '../../shared/types/project.types'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    let store: Record<string, any> = {}
    return {
      get: jest.fn((key: string, defaultValue?: any) => {
        return store[key] !== undefined ? store[key] : defaultValue
      }),
      set: jest.fn((key: string, value: any) => {
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
      // For testing: allow direct access to store
      _store: store,
    }
  })
})

describe('ConfigService', () => {
  let configService: ConfigService
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `config-test-${Date.now()}`)
    await fs.ensureDir(testDir)

    configService = new ConfigService()
  })

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir)
    }
  })

  describe('getRecentProjects', () => {
    it('should return empty array when no recent projects', () => {
      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toEqual([])
    })

    it('should return list of recent projects', () => {
      const mockProject: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        projectName: 'Test Project',
        projectDirectory: '/test/path',
        lastOpened: new Date(),
        songCount: 5,
      }

      configService.addRecentProject(mockProject)
      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].projectName).toBe('Test Project')
    })

    it('should return projects sorted by lastOpened (most recent first)', () => {
      const oldDate = new Date('2024-01-01')
      const newDate = new Date('2024-01-02')

      const oldProject: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        projectName: 'Old Project',
        projectDirectory: '/old',
        lastOpened: oldDate,
        songCount: 3,
      }

      const newProject: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        projectName: 'New Project',
        projectDirectory: '/new',
        lastOpened: newDate,
        songCount: 2,
      }

      configService.addRecentProject(oldProject)
      configService.addRecentProject(newProject)

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects[0].projectName).toBe('New Project')
      expect(recentProjects[1].projectName).toBe('Old Project')
    })

    it('should limit recent projects to maximum of 10', () => {
      // Add 15 projects
      for (let i = 0; i < 15; i++) {
        const project: RecentProject = {
          projectId: `123e4567-e89b-12d3-a456-42661417400${i}`,
          projectName: `Project ${i}`,
          projectDirectory: `/test/${i}`,
          lastOpened: new Date(),
          songCount: i,
        }
        configService.addRecentProject(project)
      }

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(10)
    })
  })

  describe('addRecentProject', () => {
    it('should add project to recent list', () => {
      const project: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        projectName: 'Test Project',
        projectDirectory: '/test',
        lastOpened: new Date(),
        songCount: 5,
      }

      configService.addRecentProject(project)
      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].projectId).toBe(project.projectId)
    })

    it('should update existing project instead of duplicating', () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000'
      const firstAdd: RecentProject = {
        projectId,
        projectName: 'Test Project',
        projectDirectory: '/test',
        lastOpened: new Date('2024-01-01'),
        songCount: 5,
      }

      const secondAdd: RecentProject = {
        projectId,
        projectName: 'Test Project Updated',
        projectDirectory: '/test',
        lastOpened: new Date('2024-01-02'),
        songCount: 10,
      }

      configService.addRecentProject(firstAdd)
      configService.addRecentProject(secondAdd)

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].songCount).toBe(10)
      expect(recentProjects[0].projectName).toBe('Test Project Updated')
    })

    it('should move updated project to top of list', () => {
      const oldDate = new Date('2024-01-01')
      const newDate = new Date('2024-01-02')

      const project1: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        projectName: 'Project 1',
        projectDirectory: '/test1',
        lastOpened: oldDate,
        songCount: 3,
      }

      const project2: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        projectName: 'Project 2',
        projectDirectory: '/test2',
        lastOpened: new Date('2024-01-01T12:00:00'),
        songCount: 5,
      }

      configService.addRecentProject(project1)
      configService.addRecentProject(project2)

      // Re-open project 1 with new date
      configService.addRecentProject({
        ...project1,
        lastOpened: newDate,
      })

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects[0].projectId).toBe(project1.projectId)
    })
  })

  describe('removeRecentProject', () => {
    it('should remove project from recent list', () => {
      const project: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        projectName: 'Test Project',
        projectDirectory: '/test',
        lastOpened: new Date(),
        songCount: 5,
      }

      configService.addRecentProject(project)
      configService.removeRecentProject(project.projectId)

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(0)
    })

    it('should not throw error when removing non-existent project', () => {
      expect(() => {
        configService.removeRecentProject('nonexistent-id')
      }).not.toThrow()
    })

    it('should only remove specified project', () => {
      const project1: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        projectName: 'Project 1',
        projectDirectory: '/test1',
        lastOpened: new Date(),
        songCount: 3,
      }

      const project2: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        projectName: 'Project 2',
        projectDirectory: '/test2',
        lastOpened: new Date(),
        songCount: 5,
      }

      configService.addRecentProject(project1)
      configService.addRecentProject(project2)
      configService.removeRecentProject(project1.projectId)

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(1)
      expect(recentProjects[0].projectId).toBe(project2.projectId)
    })
  })

  describe('clearRecentProjects', () => {
    it('should clear all recent projects', () => {
      const project1: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174001',
        projectName: 'Project 1',
        projectDirectory: '/test1',
        lastOpened: new Date(),
        songCount: 3,
      }

      const project2: RecentProject = {
        projectId: '123e4567-e89b-12d3-a456-426614174002',
        projectName: 'Project 2',
        projectDirectory: '/test2',
        lastOpened: new Date(),
        songCount: 5,
      }

      configService.addRecentProject(project1)
      configService.addRecentProject(project2)

      configService.clearRecentProjects()

      const recentProjects = configService.getRecentProjects()

      expect(recentProjects).toHaveLength(0)
    })
  })

  describe('getSetting', () => {
    it('should return default value when setting does not exist', () => {
      const value = configService.getSetting('nonexistent-key', 'default-value')

      expect(value).toBe('default-value')
    })

    it('should return stored setting value', () => {
      configService.setSetting('test-key', 'test-value')

      const value = configService.getSetting('test-key')

      expect(value).toBe('test-value')
    })

    it('should return undefined when no default value provided', () => {
      const value = configService.getSetting('nonexistent-key')

      expect(value).toBeUndefined()
    })
  })

  describe('setSetting', () => {
    it('should store setting value', () => {
      configService.setSetting('test-key', 'test-value')

      const value = configService.getSetting('test-key')

      expect(value).toBe('test-value')
    })

    it('should overwrite existing setting', () => {
      configService.setSetting('test-key', 'old-value')
      configService.setSetting('test-key', 'new-value')

      const value = configService.getSetting('test-key')

      expect(value).toBe('new-value')
    })

    it('should store different types of values', () => {
      configService.setSetting('string-key', 'string-value')
      configService.setSetting('number-key', 42)
      configService.setSetting('boolean-key', true)
      configService.setSetting('object-key', { nested: 'value' })

      expect(configService.getSetting('string-key')).toBe('string-value')
      expect(configService.getSetting('number-key')).toBe(42)
      expect(configService.getSetting('boolean-key')).toBe(true)
      expect(configService.getSetting('object-key')).toEqual({ nested: 'value' })
    })
  })

  describe('deleteSetting', () => {
    it('should delete setting', () => {
      configService.setSetting('test-key', 'test-value')
      configService.deleteSetting('test-key')

      const value = configService.getSetting('test-key')

      expect(value).toBeUndefined()
    })

    it('should not throw error when deleting non-existent setting', () => {
      expect(() => {
        configService.deleteSetting('nonexistent-key')
      }).not.toThrow()
    })
  })

  describe('hasSetting', () => {
    it('should return true for existing setting', () => {
      configService.setSetting('test-key', 'test-value')

      expect(configService.hasSetting('test-key')).toBe(true)
    })

    it('should return false for non-existent setting', () => {
      expect(configService.hasSetting('nonexistent-key')).toBe(false)
    })
  })
})
