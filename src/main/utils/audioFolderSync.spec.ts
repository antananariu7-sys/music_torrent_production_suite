import { findNewAudioFiles } from './audioFolderSync'

describe('audioFolderSync', () => {
  const audioDir = '/projects/test/assets/audio'

  describe('findNewAudioFiles', () => {
    it('should include new .mp3 file not in known paths', () => {
      const result = findNewAudioFiles(['new-song.mp3'], [], audioDir)
      expect(result).toContain('new-song.mp3')
    })

    it('should exclude files already in known paths', () => {
      const knownPath = '/projects/test/assets/audio/existing.mp3'
      const result = findNewAudioFiles(['existing.mp3'], [knownPath], audioDir)
      expect(result).toHaveLength(0)
    })

    it('should exclude non-audio files', () => {
      const result = findNewAudioFiles(
        ['readme.txt', 'cover.jpg', 'notes.pdf'],
        [],
        audioDir
      )
      expect(result).toHaveLength(0)
    })

    it('should normalize backslash vs forward-slash comparison', () => {
      // Known path uses backslashes (Windows style)
      const knownPath = '\\projects\\test\\assets\\audio\\song.mp3'
      const result = findNewAudioFiles(['song.mp3'], [knownPath], audioDir)
      expect(result).toHaveLength(0)
    })

    it('should do case-insensitive path comparison', () => {
      const knownPath = '/Projects/Test/Assets/Audio/Song.MP3'
      const result = findNewAudioFiles(['Song.MP3'], [knownPath], audioDir)
      expect(result).toHaveLength(0)
    })

    it('should return empty for empty folder', () => {
      const result = findNewAudioFiles([], ['/some/path.mp3'], audioDir)
      expect(result).toHaveLength(0)
    })

    it('should return all audio files when known paths is empty', () => {
      const result = findNewAudioFiles(
        ['song.mp3', 'track.flac', 'readme.txt'],
        [],
        audioDir
      )
      expect(result).toEqual(['song.mp3', 'track.flac'])
    })

    it('should correctly filter mixed: some new, some existing', () => {
      const known = ['/projects/test/assets/audio/existing.mp3']
      const result = findNewAudioFiles(
        ['existing.mp3', 'new-song.flac', 'cover.jpg'],
        known,
        audioDir
      )
      expect(result).toEqual(['new-song.flac'])
    })
  })
})
