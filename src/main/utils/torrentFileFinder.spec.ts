import { findLocalTorrentFile } from './torrentFileFinder'
import path from 'path'

describe('torrentFileFinder', () => {
  const dir = '/projects/test/torrents'

  describe('findLocalTorrentFile', () => {
    it('should find legacy format: {id}.torrent', () => {
      const files = ['12345.torrent', 'other.torrent']
      const result = findLocalTorrentFile(dir, '12345', files)
      expect(result).toBe(path.join(dir, '12345.torrent'))
    })

    it('should find suffix format: Artist - Album [id].torrent', () => {
      const files = ['Pink Floyd - The Wall [12345].torrent', 'other.torrent']
      const result = findLocalTorrentFile(dir, '12345', files)
      expect(result).toBe(
        path.join(dir, 'Pink Floyd - The Wall [12345].torrent')
      )
    })

    it('should prefer suffix format when both exist', () => {
      const files = ['12345.torrent', 'Pink Floyd - The Wall [12345].torrent']
      const result = findLocalTorrentFile(dir, '12345', files)
      expect(result).toBe(
        path.join(dir, 'Pink Floyd - The Wall [12345].torrent')
      )
    })

    it('should return null when no match found', () => {
      const files = ['other.torrent', 'different-99999.torrent']
      const result = findLocalTorrentFile(dir, '12345', files)
      expect(result).toBeNull()
    })

    it('should return null for empty directory listing', () => {
      const result = findLocalTorrentFile(dir, '12345', [])
      expect(result).toBeNull()
    })

    it('should return first suffix match when multiple exist', () => {
      const files = ['Album A [12345].torrent', 'Album B [12345].torrent']
      const result = findLocalTorrentFile(dir, '12345', files)
      // find() returns the first match
      expect(result).toBe(path.join(dir, 'Album A [12345].torrent'))
    })
  })
})
