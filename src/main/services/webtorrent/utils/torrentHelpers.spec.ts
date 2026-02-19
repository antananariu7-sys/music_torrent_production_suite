import { mapTorrentFiles, mapCompletedFiles } from './torrentHelpers'
import type { Torrent } from 'webtorrent'

function makeTorrent(
  files: Array<{ path: string; name: string; length: number; downloaded: number }>
): Torrent {
  return {
    files: files.map(f => ({
      path: f.path,
      name: f.name,
      length: f.length,
      downloaded: f.downloaded,
    })),
  } as unknown as Torrent
}

describe('torrentHelpers', () => {
  describe('mapTorrentFiles', () => {
    it('marks all files as selected when no selectedIndices provided', () => {
      const torrent = makeTorrent([
        { path: 'album/track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 500 },
        { path: 'album/track2.mp3', name: 'track2.mp3', length: 2000, downloaded: 0 },
      ])
      const result = mapTorrentFiles(torrent)
      expect(result[0].selected).toBe(true)
      expect(result[1].selected).toBe(true)
    })

    it('marks files selected based on selectedIndices', () => {
      const torrent = makeTorrent([
        { path: 'album/track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 500 },
        { path: 'album/track2.mp3', name: 'track2.mp3', length: 2000, downloaded: 0 },
      ])
      const result = mapTorrentFiles(torrent, new Set([0]))
      expect(result[0].selected).toBe(true)
      expect(result[1].selected).toBe(false)
    })

    it('calculates progress correctly', () => {
      const torrent = makeTorrent([
        { path: 'album/track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 250 },
      ])
      const result = mapTorrentFiles(torrent)
      expect(result[0].progress).toBe(25)
      expect(result[0].downloaded).toBe(250)
      expect(result[0].size).toBe(1000)
    })

    it('handles zero-length files without division by zero', () => {
      const torrent = makeTorrent([
        { path: 'empty.mp3', name: 'empty.mp3', length: 0, downloaded: 0 },
      ])
      const result = mapTorrentFiles(torrent)
      expect(result[0].progress).toBe(0)
    })

    it('clamps negative downloaded values to zero', () => {
      const torrent = makeTorrent([
        { path: 'track.mp3', name: 'track.mp3', length: 1000, downloaded: -100 },
      ])
      const result = mapTorrentFiles(torrent)
      expect(result[0].downloaded).toBe(0)
      expect(result[0].progress).toBe(0)
    })

    it('rounds progress to nearest integer', () => {
      const torrent = makeTorrent([
        { path: 'track.mp3', name: 'track.mp3', length: 3, downloaded: 1 },
      ])
      const result = mapTorrentFiles(torrent)
      // 1/3 * 100 = 33.33 → rounds to 33
      expect(result[0].progress).toBe(33)
    })

    it('maps path and name correctly', () => {
      const torrent = makeTorrent([
        { path: 'Artist/Album/track.mp3', name: 'track.mp3', length: 500, downloaded: 0 },
      ])
      const result = mapTorrentFiles(torrent)
      expect(result[0].path).toBe('Artist/Album/track.mp3')
      expect(result[0].name).toBe('track.mp3')
    })

    it('returns empty array for torrent with no files', () => {
      const torrent = makeTorrent([])
      const result = mapTorrentFiles(torrent)
      expect(result).toHaveLength(0)
    })
  })

  describe('mapCompletedFiles', () => {
    it('marks selected files as fully downloaded', () => {
      const torrent = makeTorrent([
        { path: 'album/track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 0 },
        { path: 'album/track2.mp3', name: 'track2.mp3', length: 2000, downloaded: 0 },
      ])
      const result = mapCompletedFiles(torrent, new Set([0]))
      expect(result[0].downloaded).toBe(1000)
      expect(result[0].progress).toBe(100)
      expect(result[0].selected).toBe(true)
    })

    it('marks deselected files as not downloaded', () => {
      const torrent = makeTorrent([
        { path: 'album/track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 0 },
        { path: 'album/track2.mp3', name: 'track2.mp3', length: 2000, downloaded: 0 },
      ])
      const result = mapCompletedFiles(torrent, new Set([0]))
      expect(result[1].downloaded).toBe(0)
      expect(result[1].progress).toBe(0)
      expect(result[1].selected).toBe(false)
    })

    it('marks all files complete when all are selected', () => {
      const torrent = makeTorrent([
        { path: 'track1.mp3', name: 'track1.mp3', length: 500, downloaded: 0 },
        { path: 'track2.mp3', name: 'track2.mp3', length: 800, downloaded: 0 },
      ])
      const result = mapCompletedFiles(torrent, new Set([0, 1]))
      expect(result).toHaveLength(2)
      result.forEach(f => {
        expect(f.progress).toBe(100)
        expect(f.selected).toBe(true)
      })
    })

    it('uses file.length as downloaded for selected files (not f.downloaded)', () => {
      // WebTorrent f.downloaded can be 0 even when file is complete
      const torrent = makeTorrent([
        { path: 'track.mp3', name: 'track.mp3', length: 5000, downloaded: 0 },
      ])
      const result = mapCompletedFiles(torrent, new Set([0]))
      expect(result[0].downloaded).toBe(5000) // uses f.length, not f.downloaded
    })

    it('returns correct size for deselected files', () => {
      const torrent = makeTorrent([
        { path: 'track1.mp3', name: 'track1.mp3', length: 1000, downloaded: 0 },
        { path: 'track2.mp3', name: 'track2.mp3', length: 2000, downloaded: 0 },
      ])
      const result = mapCompletedFiles(torrent, new Set([0]))
      expect(result[1].size).toBe(2000)
    })
  })
})
