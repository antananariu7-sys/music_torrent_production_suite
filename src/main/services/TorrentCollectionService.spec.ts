import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { TorrentCollectionService } from './TorrentCollectionService'
import type { CollectedTorrent } from '@shared/types/torrent.types'

describe('TorrentCollectionService', () => {
  let service: TorrentCollectionService
  let tempDir: string

  beforeEach(async () => {
    service = new TorrentCollectionService()
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'torrent-collection-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('loadCollection', () => {
    it('should return empty array when collection file does not exist', async () => {
      const collection = await service.loadCollection('project-1', tempDir)
      expect(collection).toEqual([])
    })

    it('should load collection from existing file', async () => {
      const projectId = 'project-1'
      const torrents: CollectedTorrent[] = [
        {
          id: 'collection-1',
          torrentId: 'torrent-1',
          magnetLink: 'magnet:?xt=urn:btih:abc123',
          title: 'Album 1 [FLAC]',
          pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
          addedAt: '2024-01-01T10:00:00Z',
          projectId,
          metadata: {
            size: '500 MB',
            seeders: 50,
            leechers: 10,
          },
        },
        {
          id: 'collection-2',
          torrentId: 'torrent-2',
          magnetLink: 'magnet:?xt=urn:btih:def456',
          title: 'Album 2 [MP3]',
          pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=67890',
          addedAt: '2024-01-02T10:00:00Z',
          projectId,
          metadata: {
            size: '100 MB',
            seeders: 25,
            leechers: 5,
          },
        },
      ]

      // Create collection file
      const filePath = path.join(tempDir, 'torrent-collection.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId,
          projectName: 'Test Project',
          torrents,
          lastUpdated: '2024-01-02T10:00:00Z',
        }),
        'utf-8'
      )

      const collection = await service.loadCollection(projectId, tempDir)

      expect(collection).toHaveLength(2)
      expect(collection[0].title).toBe('Album 1 [FLAC]')
      expect(collection[1].title).toBe('Album 2 [MP3]')
    })

    it('should return empty array when project ID does not match', async () => {
      const torrents: CollectedTorrent[] = [
        {
          id: 'collection-1',
          torrentId: 'torrent-1',
          magnetLink: 'magnet:?xt=urn:btih:abc123',
          title: 'Album 1',
          pageUrl: 'https://example.com/1',
          addedAt: '2024-01-01T10:00:00Z',
          projectId: 'different-project',
        },
      ]

      // Create collection file with different project ID
      const filePath = path.join(tempDir, 'torrent-collection.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'different-project',
          projectName: 'Different Project',
          torrents,
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      const collection = await service.loadCollection('project-1', tempDir)

      expect(collection).toEqual([])
    })

    it('should return empty array when file contains invalid JSON', async () => {
      const filePath = path.join(tempDir, 'torrent-collection.json')
      await fs.writeFile(filePath, 'invalid json {', 'utf-8')

      const collection = await service.loadCollection('project-1', tempDir)

      expect(collection).toEqual([])
    })

    it('should return empty array when torrents property is null', async () => {
      const filePath = path.join(tempDir, 'torrent-collection.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'project-1',
          projectName: 'Test Project',
          torrents: null,
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      const collection = await service.loadCollection('project-1', tempDir)

      expect(collection).toEqual([])
    })
  })

  describe('saveCollection', () => {
    it('should save collection to file', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'
      const torrents: CollectedTorrent[] = [
        {
          id: 'collection-1',
          torrentId: 'torrent-1',
          magnetLink: 'magnet:?xt=urn:btih:abc123',
          title: 'Test Album [FLAC]',
          pageUrl: 'https://example.com/1',
          addedAt: '2024-01-01T10:00:00Z',
          projectId,
          metadata: {
            size: '500 MB',
            seeders: 50,
            leechers: 10,
          },
        },
      ]

      await service.saveCollection(projectId, projectName, tempDir, torrents)

      // Verify file was created
      const filePath = path.join(tempDir, 'torrent-collection.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.projectId).toBe(projectId)
      expect(savedData.projectName).toBe(projectName)
      expect(savedData.torrents).toHaveLength(1)
      expect(savedData.torrents[0].title).toBe('Test Album [FLAC]')
      expect(savedData.lastUpdated).toBeDefined()
    })

    it('should overwrite existing collection file', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'

      // Save initial collection
      await service.saveCollection(projectId, projectName, tempDir, [
        {
          id: 'collection-1',
          torrentId: 'torrent-1',
          magnetLink: 'magnet:?xt=urn:btih:old123',
          title: 'Old Album',
          pageUrl: 'https://example.com/1',
          addedAt: '2024-01-01T10:00:00Z',
          projectId,
        },
      ])

      // Save new collection
      await service.saveCollection(projectId, projectName, tempDir, [
        {
          id: 'collection-2',
          torrentId: 'torrent-2',
          magnetLink: 'magnet:?xt=urn:btih:new456',
          title: 'New Album',
          pageUrl: 'https://example.com/2',
          addedAt: '2024-01-02T10:00:00Z',
          projectId,
        },
      ])

      // Verify file was overwritten
      const filePath = path.join(tempDir, 'torrent-collection.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.torrents).toHaveLength(1)
      expect(savedData.torrents[0].title).toBe('New Album')
    })

    it('should save empty collection array', async () => {
      await service.saveCollection('project-1', 'Test Project', tempDir, [])

      const filePath = path.join(tempDir, 'torrent-collection.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.torrents).toEqual([])
    })

    it('should throw error when directory does not exist', async () => {
      const nonExistentDir = path.join(tempDir, 'non-existent-subdir')

      await expect(
        service.saveCollection('project-1', 'Test Project', nonExistentDir, [])
      ).rejects.toThrow()
    })

    it('should preserve all torrent properties', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'
      const torrents: CollectedTorrent[] = [
        {
          id: 'collection-1',
          torrentId: 'torrent-12345',
          magnetLink: 'magnet:?xt=urn:btih:abc123def456',
          title: 'Complete Album [FLAC, 24-96]',
          pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
          addedAt: '2024-01-01T10:00:00Z',
          projectId,
          metadata: {
            size: '1.5 GB',
            sizeBytes: 1610612736,
            seeders: 100,
            leechers: 20,
            category: 'Lossless',
          },
        },
      ]

      await service.saveCollection(projectId, projectName, tempDir, torrents)

      const filePath = path.join(tempDir, 'torrent-collection.json')
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)

      expect(savedData.torrents[0]).toMatchObject({
        id: 'collection-1',
        torrentId: 'torrent-12345',
        magnetLink: 'magnet:?xt=urn:btih:abc123def456',
        title: 'Complete Album [FLAC, 24-96]',
        pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
        projectId,
        metadata: {
          size: '1.5 GB',
          sizeBytes: 1610612736,
          seeders: 100,
          leechers: 20,
          category: 'Lossless',
        },
      })
    })
  })

  describe('clearCollection', () => {
    it('should delete collection file', async () => {
      // Create a collection file first
      const filePath = path.join(tempDir, 'torrent-collection.json')
      await fs.writeFile(
        filePath,
        JSON.stringify({
          projectId: 'project-1',
          projectName: 'Test Project',
          torrents: [],
          lastUpdated: '2024-01-01T10:00:00Z',
        }),
        'utf-8'
      )

      // Verify file exists
      await expect(fs.access(filePath)).resolves.toBeUndefined()

      // Clear collection
      await service.clearCollection(tempDir)

      // Verify file was deleted
      await expect(fs.access(filePath)).rejects.toThrow()
    })

    it('should not throw when collection file does not exist', async () => {
      await expect(service.clearCollection(tempDir)).resolves.toBeUndefined()
    })
  })

  describe('integration', () => {
    it('should round-trip save and load collection', async () => {
      const projectId = 'project-1'
      const projectName = 'Test Project'
      const torrents: CollectedTorrent[] = [
        {
          id: 'collection-1',
          torrentId: 'torrent-abbey',
          magnetLink: 'magnet:?xt=urn:btih:beatles123',
          title: 'Abbey Road [FLAC]',
          pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=12345',
          addedAt: '2024-01-01T10:00:00Z',
          projectId,
          metadata: {
            size: '800 MB',
            seeders: 150,
            leechers: 30,
          },
        },
        {
          id: 'collection-2',
          torrentId: 'torrent-darkside',
          magnetLink: 'magnet:?xt=urn:btih:pinkfloyd456',
          title: 'Dark Side of the Moon [MP3 320]',
          pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=67890',
          addedAt: '2024-01-02T10:00:00Z',
          projectId,
          metadata: {
            size: '150 MB',
            seeders: 200,
            leechers: 40,
          },
        },
      ]

      // Save collection
      await service.saveCollection(projectId, projectName, tempDir, torrents)

      // Load collection
      const loadedCollection = await service.loadCollection(projectId, tempDir)

      expect(loadedCollection).toHaveLength(2)
      expect(loadedCollection[0].title).toBe('Abbey Road [FLAC]')
      expect(loadedCollection[0].metadata?.seeders).toBe(150)
      expect(loadedCollection[1].title).toBe('Dark Side of the Moon [MP3 320]')
      expect(loadedCollection[1].metadata?.seeders).toBe(200)
    })

    it('should handle multiple projects with separate collections', async () => {
      // Create subdirectories for different projects
      const project1Dir = path.join(tempDir, 'project-1')
      const project2Dir = path.join(tempDir, 'project-2')
      await fs.mkdir(project1Dir)
      await fs.mkdir(project2Dir)

      // Save collections for different projects
      await service.saveCollection('project-1', 'Project 1', project1Dir, [
        {
          id: 'c1',
          torrentId: 't1',
          magnetLink: 'magnet:?xt=urn:btih:p1torrent',
          title: 'Project 1 Torrent',
          pageUrl: 'https://example.com/1',
          addedAt: '2024-01-01T10:00:00Z',
          projectId: 'project-1',
        },
      ])

      await service.saveCollection('project-2', 'Project 2', project2Dir, [
        {
          id: 'c2',
          torrentId: 't2',
          magnetLink: 'magnet:?xt=urn:btih:p2torrent',
          title: 'Project 2 Torrent',
          pageUrl: 'https://example.com/2',
          addedAt: '2024-01-02T10:00:00Z',
          projectId: 'project-2',
        },
      ])

      // Load collections for each project
      const collection1 = await service.loadCollection('project-1', project1Dir)
      const collection2 = await service.loadCollection('project-2', project2Dir)

      expect(collection1).toHaveLength(1)
      expect(collection1[0].title).toBe('Project 1 Torrent')

      expect(collection2).toHaveLength(1)
      expect(collection2[0].title).toBe('Project 2 Torrent')
    })
  })
})
