import { validateSongs, resolveSongPath, clampCrossfade } from './MixValidator'
import type { Song } from '@shared/types/project.types'
import { existsSync } from 'fs'

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}))

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Test Song',
    addedAt: new Date(),
    order: 0,
    localFilePath: '/music/song.flac',
    ...overrides,
  }
}

describe('resolveSongPath', () => {
  it('prefers localFilePath', () => {
    const song = makeSong({ localFilePath: '/local/a.flac', externalFilePath: '/ext/a.flac' })
    expect(resolveSongPath(song)).toBe('/local/a.flac')
  })

  it('falls back to externalFilePath', () => {
    const song = makeSong({ localFilePath: undefined, externalFilePath: '/ext/a.flac' })
    expect(resolveSongPath(song)).toBe('/ext/a.flac')
  })

  it('returns null when both are undefined', () => {
    const song = makeSong({ localFilePath: undefined, externalFilePath: undefined })
    expect(resolveSongPath(song)).toBeNull()
  })
})

describe('validateSongs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns all songs as valid when files exist', () => {
    mockExistsSync.mockReturnValue(true)

    const songs = [
      makeSong({ id: '1', title: 'A' }),
      makeSong({ id: '2', title: 'B' }),
    ]

    const { valid, missing } = validateSongs(songs)
    expect(valid).toHaveLength(2)
    expect(missing).toHaveLength(0)
  })

  it('identifies missing files', () => {
    mockExistsSync
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const songs = [
      makeSong({ id: '1', title: 'Present' }),
      makeSong({ id: '2', title: 'Missing' }),
    ]

    const { valid, missing } = validateSongs(songs)
    expect(valid).toHaveLength(1)
    expect(valid[0].id).toBe('1')
    expect(missing).toHaveLength(1)
    expect(missing[0]).toEqual({ songId: '2', title: 'Missing' })
  })

  it('marks songs with no file path as missing', () => {
    const songs = [
      makeSong({ id: '1', localFilePath: undefined, externalFilePath: undefined }),
    ]

    const { valid, missing } = validateSongs(songs)
    expect(valid).toHaveLength(0)
    expect(missing).toHaveLength(1)
  })

  it('handles empty song list', () => {
    const { valid, missing } = validateSongs([])
    expect(valid).toHaveLength(0)
    expect(missing).toHaveLength(0)
  })
})

describe('clampCrossfade', () => {
  it('returns value unchanged when within bounds', () => {
    const result = clampCrossfade(5, 200, 180)
    expect(result).toEqual({ value: 5, clamped: false })
  })

  it('clamps to min(duration) - 1', () => {
    const result = clampCrossfade(20, 15, 200)
    expect(result).toEqual({ value: 14, clamped: true })
  })

  it('clamps to 0 when tracks are too short', () => {
    const result = clampCrossfade(5, 0.5, 0.5)
    expect(result).toEqual({ value: 0, clamped: true })
  })

  it('passes through when durations are undefined', () => {
    const result = clampCrossfade(5, undefined, 180)
    expect(result).toEqual({ value: 5, clamped: false })
  })

  it('does not clamp zero crossfade', () => {
    const result = clampCrossfade(0, 200, 180)
    expect(result).toEqual({ value: 0, clamped: false })
  })

  it('clamps crossfade to 0 when currentDuration is 0', () => {
    const result = clampCrossfade(5, 0, 180)
    expect(result).toEqual({ value: 0, clamped: true })
  })

  it('clamps crossfade to 0 when nextDuration is 0', () => {
    const result = clampCrossfade(5, 200, 0)
    expect(result).toEqual({ value: 0, clamped: true })
  })
})
