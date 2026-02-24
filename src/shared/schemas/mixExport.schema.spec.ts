import { MixExportRequestSchema } from './mixExport.schema'

describe('mixExport.schema', () => {
  const validBase = {
    projectId: 'project-1',
    outputDirectory: '/tmp/export',
    outputFilename: 'my-mix',
    format: 'mp3' as const,
    normalization: false,
    generateCueSheet: false,
    defaultCrossfadeDuration: 5,
  }

  describe('MixExportRequestSchema', () => {
    it('should pass with valid MP3 request and bitrate 320', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        mp3Bitrate: 320,
      })
      expect(result.success).toBe(true)
    })

    it('should pass with valid bitrate 256', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        mp3Bitrate: 256,
      })
      expect(result.success).toBe(true)
    })

    it('should fail with invalid bitrate 257', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        mp3Bitrate: 257,
      })
      expect(result.success).toBe(false)
    })

    it('should fail with crossfade duration -1', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        defaultCrossfadeDuration: -1,
      })
      expect(result.success).toBe(false)
    })

    it('should fail with crossfade duration 31', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        defaultCrossfadeDuration: 31,
      })
      expect(result.success).toBe(false)
    })

    it('should pass with crossfade duration 0', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        defaultCrossfadeDuration: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should pass with crossfade duration 30', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        defaultCrossfadeDuration: 30,
      })
      expect(result.success).toBe(true)
    })

    it('should pass with format flac', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        format: 'flac',
      })
      expect(result.success).toBe(true)
    })

    it('should fail with invalid format', () => {
      const result = MixExportRequestSchema.safeParse({
        ...validBase,
        format: 'aac',
      })
      expect(result.success).toBe(false)
    })
  })
})
