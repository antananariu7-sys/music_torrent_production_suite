import {
  AddTorrentRequestSchema,
  WebTorrentSettingsSchema,
} from './torrent.schema'

describe('torrent.schema', () => {
  describe('AddTorrentRequestSchema — refine', () => {
    const validBase = {
      magnetUri: 'magnet:?xt=urn:btih:abc123',
      projectId: 'project-1',
      name: 'Test Torrent',
      downloadPath: '/tmp/downloads',
    }

    it('should pass with magnetUri only', () => {
      const result = AddTorrentRequestSchema.safeParse(validBase)
      expect(result.success).toBe(true)
    })

    it('should pass with torrentFilePath only', () => {
      const result = AddTorrentRequestSchema.safeParse({
        ...validBase,
        magnetUri: '',
        torrentFilePath: '/tmp/test.torrent',
      })
      expect(result.success).toBe(true)
    })

    it('should pass with both magnetUri and torrentFilePath', () => {
      const result = AddTorrentRequestSchema.safeParse({
        ...validBase,
        torrentFilePath: '/tmp/test.torrent',
      })
      expect(result.success).toBe(true)
    })

    it('should fail with neither magnetUri nor torrentFilePath', () => {
      const result = AddTorrentRequestSchema.safeParse({
        ...validBase,
        magnetUri: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('WebTorrentSettingsSchema', () => {
    it('should pass with valid settings', () => {
      const result = WebTorrentSettingsSchema.safeParse({
        maxConcurrentDownloads: 3,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should fail with negative maxDownloadSpeed', () => {
      const result = WebTorrentSettingsSchema.safeParse({
        maxConcurrentDownloads: 3,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: -1,
      })
      expect(result.success).toBe(false)
    })

    it('should fail with negative maxUploadSpeed', () => {
      const result = WebTorrentSettingsSchema.safeParse({
        maxConcurrentDownloads: 3,
        seedAfterDownload: false,
        maxUploadSpeed: -100,
        maxDownloadSpeed: 0,
      })
      expect(result.success).toBe(false)
    })

    it('should fail with maxConcurrentDownloads > 10', () => {
      const result = WebTorrentSettingsSchema.safeParse({
        maxConcurrentDownloads: 11,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      })
      expect(result.success).toBe(false)
    })

    it('should fail with maxConcurrentDownloads < 1', () => {
      const result = WebTorrentSettingsSchema.safeParse({
        maxConcurrentDownloads: 0,
        seedAfterDownload: false,
        maxUploadSpeed: 0,
        maxDownloadSpeed: 0,
      })
      expect(result.success).toBe(false)
    })
  })
})
