import {
  CreateProjectRequestSchema,
  AddSongRequestSchema,
} from './project.schema'

describe('project.schema', () => {
  describe('CreateProjectRequestSchema — name refine', () => {
    const validBase = { name: 'My Project', location: '/tmp/projects' }

    it('should pass with normal name', () => {
      const result = CreateProjectRequestSchema.safeParse(validBase)
      expect(result.success).toBe(true)
    })

    it('should fail with "<" in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project <test>',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with ">" in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project>',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with colon in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project: Remastered',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with double quote in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project "special"',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with backslash in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project\\Name',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with pipe in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project|Name',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with question mark in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project?',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with asterisk in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project*',
      })
      expect(result.success).toBe(false)
    })

    it('should fail with slash in name', () => {
      const result = CreateProjectRequestSchema.safeParse({
        ...validBase,
        name: 'Project/Name',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AddSongRequestSchema — refine', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000'

    it('should pass with both downloadId and externalFilePath', () => {
      const result = AddSongRequestSchema.safeParse({
        projectId: validUuid,
        title: 'Song',
        downloadId: validUuid,
        externalFilePath: '/audio/song.mp3',
        order: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should pass with only downloadId', () => {
      const result = AddSongRequestSchema.safeParse({
        projectId: validUuid,
        title: 'Song',
        downloadId: validUuid,
        order: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should pass with only externalFilePath', () => {
      const result = AddSongRequestSchema.safeParse({
        projectId: validUuid,
        title: 'Song',
        externalFilePath: '/audio/song.mp3',
        order: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should fail with neither downloadId nor externalFilePath', () => {
      const result = AddSongRequestSchema.safeParse({
        projectId: validUuid,
        title: 'Song',
        order: 0,
      })
      expect(result.success).toBe(false)
    })
  })
})
