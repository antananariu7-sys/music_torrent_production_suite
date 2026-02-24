import { parseFfmpegVersion } from './ffmpegVersion'

describe('ffmpegVersion', () => {
  describe('parseFfmpegVersion', () => {
    it('should parse standard version string', () => {
      const output =
        'ffmpeg version 6.1.1 Copyright (c) 2000-2023 the FFmpeg developers'
      expect(parseFfmpegVersion(output)).toBe('6.1.1')
    })

    it('should parse git version string', () => {
      const output = 'ffmpeg version N-112345-gabcdef0 Copyright (c) 2000-2024'
      expect(parseFfmpegVersion(output)).toBe('N-112345-gabcdef0')
    })

    it('should return null when no version found', () => {
      expect(parseFfmpegVersion('some random output')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseFfmpegVersion('')).toBeNull()
    })

    it('should find version in first line of multi-line output', () => {
      const output = [
        'ffmpeg version 7.0.2 Copyright (c) 2000-2024 the FFmpeg developers',
        'built with gcc 13.2.0',
        'configuration: --enable-gpl --enable-libx264',
      ].join('\n')
      expect(parseFfmpegVersion(output)).toBe('7.0.2')
    })
  })
})
