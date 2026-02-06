import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { SearchHistoryService } from './SearchHistoryService'
import type { SearchHistoryEntry } from '@shared/types/searchHistory.types'

describe('SearchHistoryService', () => {
  let service: SearchHistoryService
  let tempDir: string

  beforeEach(async () => {
    service = new SearchHistoryService()
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'search-history-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('loadHistory', () => {
    it('should return empty array when history file does not exist', async () => {
      const history = await service.loadHistory('project-1', tempDir)
      expect(history).toEqual([])
    })

    it('should load history from existing file', async () => {
      const projectId = 'project-1'
      const historyEntries: SearchHistoryEntry[] = [
        {
          id: 'entry-1',
          query: 'test query 1',
          timestamp: '2024-01-01T10:00:00Z',
          resultCount: 10,
        },
        {
          id: 'entry-2',
          query: 'test query 2',
          timestamp: '2024-01-02T10:00:00Z',
          resultCount: 5,
        },
      ]

      // Create history file
      const filePath = path.join(tempDir, 'search-history.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId,
          projectName: 'Test Project',
          history: historyEntries,
          lastUpdated: '2024-01-02T10:00:00Z',
        }),
        'utf-8'
      )

      const history = await service.loadHistory(projectId, tempDir)

      expect(history).toHaveLength(2)
      expect(history[0].query).toBe('test query 1')
      expect(history[1].query).toBe('test query 2')
    })

    it('should return empty array when project ID does not match', async () => {
      const historyEntries: SearchHistoryEntry[] = [
        {
          id: 'entry-1',
          query: 'test query',
          timestamp: '2024-01-01T10:00:00Z',
          resultCount: 10,
        },
      ]

      // Create history file with different project ID
      const filePath = path.join(tempDir, 'search-history.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'different-project',
          projectName: 'Different Project',
          history: historyEntries,
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      const history = await service.loadHistory('project-1', tempDir)

      expect(history).toEqual([])
    })

    it('should return empty array when file contains invalid JSON', async () => {
      const filePath = path.join(tempDir, 'search-history.json')
      await fs.writeFile(filePath, 'invalid json {', 'utf-8')

      const history = await service.loadHistory('project-1', tempDir)

      expect(history).toEqual([])
    })

    it('should return empty array when history property is null', async () => {
      const filePath = path.join(tempDir, 'search-history.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'project-1',
          projectName: 'Test Project',
          history: null,
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      const history = await service.loadHistory('project-1', tempDir)

      expect(history).toEqual([])
    })
  })

  describe('saveHistory', () => {
    it('should save history to file', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'
      const historyEntries: SearchHistoryEntry[] = [
        {
          id: 'entry-1',
          query: 'test query',
          timestamp: '2024-01-01T10:00:00Z',
          resultCount: 10,
        },
      ]

      await service.saveHistory(projectId, projectName, tempDir, historyEntries)

      // Verify file was created
      const filePath = path.join(tempDir, 'search-history.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.projectId).toBe(projectId)
      expect(savedData.projectName).toBe(projectName)
      expect(savedData.history).toHaveLength(1)
      expect(savedData.history[0].query).toBe('test query')
      expect(savedData.lastUpdated).toBeDefined()
    })

    it('should overwrite existing history file', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'

      // Save initial history
      await service.saveHistory(projectId, projectName, tempDir, [
        { id: 'entry-1', query: 'old query', timestamp: '2024-01-01T10:00:00Z', resultCount: 5 },
      ])

      // Save new history
      await service.saveHistory(projectId, projectName, tempDir, [
        { id: 'entry-2', query: 'new query', timestamp: '2024-01-02T10:00:00Z', resultCount: 15 },
      ])

      // Verify file was overwritten
      const filePath = path.join(tempDir, 'search-history.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.history).toHaveLength(1)
      expect(savedData.history[0].query).toBe('new query')
    })

    it('should save empty history array', async () => {
      await service.saveHistory('project-1', 'Test Project', tempDir, [])

      const filePath = path.join(tempDir, 'search-history.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.history).toEqual([])
    })

    it('should throw error when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent-subdir')

      await expect(
        service.saveHistory('project-1', 'Test Project', nonExistentDir, [])
      ).rejects.toThrow()
    })
  })

  describe('clearHistory', () => {
    it('should delete history file', async () => {
      // Create a history file first
      const filePath = path.join(tempDir, 'search-history.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'project-1',
          projectName: 'Test Project',
          history: [],
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      // Verify file exists
      await expect(fs.access(filePath)).resolves.toBeUndefined()

      // Clear history
      await service.clearHistory(tempDir)

      // Verify file was deleted
      await expect(fs.access(filePath)).rejects.toThrow()
    })

    it('should not throw when history file does not exist', async () => {
      await expect(service.clearHistory(tempDir)).resolves.toBeUndefined()
    })
  })

  describe('integration', () => {
    it('should round-trip save and load history', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'
      const historyEntries: SearchHistoryEntry[] = [
        {
          id: 'entry-1',
          query: 'Beatles Abbey Road',
          timestamp: '2024-01-01T10:00:00Z',
          resultCount: 42,
          selectedAlbum: {
            id: 'album-1',
            title: 'Abbey Road',
            artist: 'The Beatles',
          },
        },
        {
          id: 'entry-2',
          query: 'Pink Floyd Dark Side',
          timestamp: '2024-01-02T10:00:00Z',
          resultCount: 28,
        },
      ]

      // Save history
      await service.saveHistory(projectId, projectName, tempDir, historyEntries)

      // Load history
      const loadedHistory = await service.loadHistory(projectId, tempDir)

      expect(loadedHistory).toHaveLength(2)
      expect(loadedHistory[0].query).toBe('Beatles Abbey Road')
      expect(loadedHistory[0].selectedAlbum?.title).toBe('Abbey Road')
      expect(loadedHistory[1].query).toBe('Pink Floyd Dark Side')
    })
  })
})
