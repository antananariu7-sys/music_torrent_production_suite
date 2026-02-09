import { detectFileFormat } from './formatDetector'

describe('formatDetector', () => {
  describe('detectFileFormat', () => {
    it('should detect FLAC format from title', () => {
      expect(detectFileFormat('Album - Artist [FLAC]')).toBe('flac')
      expect(detectFileFormat('Album - Artist (Flac)')).toBe('flac')
    })

    it('should detect MP3 format from title', () => {
      expect(detectFileFormat('Album - Artist [MP3]')).toBe('mp3')
      expect(detectFileFormat('Album - Artist (mp3 320)')).toBe('mp3')
    })

    it('should detect WAV format from title', () => {
      expect(detectFileFormat('Album - Artist [WAV]')).toBe('wav')
      expect(detectFileFormat('Album - Artist (wav)')).toBe('wav')
    })

    it('should detect AAC format from title', () => {
      expect(detectFileFormat('Album - Artist [AAC]')).toBe('aac')
    })

    it('should detect OGG format from title', () => {
      expect(detectFileFormat('Album - Artist [OGG]')).toBe('ogg')
    })

    it('should detect ALAC format from title', () => {
      expect(detectFileFormat('Album - Artist [ALAC]')).toBe('alac')
      expect(detectFileFormat('Album - Artist [Apple Lossless]')).toBe('alac')
    })

    it('should detect APE format from title', () => {
      expect(detectFileFormat('Album - Artist [APE]')).toBe('ape')
      expect(detectFileFormat('Album - Artist [Monkey Audio]')).toBe('ape')
    })

    it('should return undefined for unrecognized format', () => {
      expect(detectFileFormat('Album - Artist')).toBeUndefined()
      expect(detectFileFormat('Album - Artist [Unknown]')).toBeUndefined()
    })
  })
})
