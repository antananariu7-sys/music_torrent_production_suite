import { parseTimeProgress } from './ffmpegRunner'

// Mock child_process and ffmpegPath for spawn tests
jest.mock('child_process')
jest.mock('./ffmpegPath', () => ({
  getFfmpegPath: jest.fn(() => '/usr/bin/ffmpeg'),
}))

import { spawn } from 'child_process'
import { EventEmitter } from 'events'
import { spawnFfmpeg, runFfmpeg } from './ffmpegRunner'

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>

/**
 * Create a mock ChildProcess with EventEmitter-based stdio streams.
 */
function createMockProcess() {
  const proc = new EventEmitter() as ReturnType<typeof spawn>
  const stderr = new EventEmitter()
  const stdout = new EventEmitter()
  const stdin = new EventEmitter()
  Object.assign(proc, { stderr, stdout, stdin, pid: 12345, kill: jest.fn() })
  return proc
}

describe('parseTimeProgress', () => {
  it('parses a standard FFmpeg time output', () => {
    const line = 'frame=  100 fps= 50 q=2.0 size=    1024kB time=00:01:23.45 bitrate= 320.0kbits/s'
    expect(parseTimeProgress(line)).toBeCloseTo(83.45, 2)
  })

  it('parses time at the start of encoding', () => {
    expect(parseTimeProgress('time=00:00:00.00')).toBe(0)
  })

  it('parses hours correctly', () => {
    expect(parseTimeProgress('time=02:30:15.50')).toBeCloseTo(9015.5, 2)
  })

  it('returns null for lines without time', () => {
    expect(parseTimeProgress('Duration: 00:05:30.00, start: 0.000000, bitrate: 320 kb/s')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseTimeProgress('')).toBeNull()
  })

  it('parses sub-second precision', () => {
    expect(parseTimeProgress('time=00:00:05.123')).toBeCloseTo(5.123, 3)
  })
})

describe('spawnFfmpeg', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('spawns FFmpeg with correct path and args', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    spawnFfmpeg(['-i', 'input.flac', '-c:a', 'pcm_s24le', 'output.wav'])

    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/bin/ffmpeg',
      ['-i', 'input.flac', '-c:a', 'pcm_s24le', 'output.wav'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )
  })

  it('resolves with exit code, stdout and stderr on close', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const { promise } = spawnFfmpeg(['-version'])

    mockProc.stdout!.emit('data', Buffer.from('ffmpeg version 6.1'))
    mockProc.stderr!.emit('data', Buffer.from('some warning'))
    mockProc.emit('close', 0)

    const result = await promise
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('ffmpeg version 6.1')
    expect(result.stderr).toContain('some warning')
  })

  it('calls onProgress when stderr contains time= lines', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const progressValues: number[] = []
    const { promise } = spawnFfmpeg(['-i', 'in.flac', 'out.wav'], (seconds) => {
      progressValues.push(seconds)
    })

    mockProc.stderr!.emit('data', Buffer.from('time=00:00:10.00'))
    mockProc.stderr!.emit('data', Buffer.from('time=00:00:25.50'))
    mockProc.stderr!.emit('data', Buffer.from('some other output without time'))
    mockProc.stderr!.emit('data', Buffer.from('time=00:01:00.00'))
    mockProc.emit('close', 0)

    await promise
    expect(progressValues).toEqual([10, 25.5, 60])
  })

  it('rejects on spawn error', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const { promise } = spawnFfmpeg(['-version'])

    mockProc.emit('error', new Error('ENOENT'))

    await expect(promise).rejects.toThrow('ENOENT')
  })

  it('exposes the child process for cancellation', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const { process } = spawnFfmpeg(['-version'])
    expect(process).toBe(mockProc)
    expect(process.kill).toBeDefined()
  })
})

describe('runFfmpeg', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns FfmpegResult on success (exit code 0)', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const resultPromise = runFfmpeg(['-version'])

    mockProc.stdout!.emit('data', Buffer.from('ffmpeg version 6.1\n'))
    mockProc.stderr!.emit('data', Buffer.from('config info\n'))
    mockProc.emit('close', 0)

    const result = await resultPromise
    expect(result.stdout).toContain('ffmpeg version 6.1')
    expect(result.stderr).toContain('config info')
    expect(result.code).toBe(0)
  })

  it('throws on non-zero exit code', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const resultPromise = runFfmpeg(['-i', 'nonexistent.wav', 'out.flac'])

    mockProc.stderr!.emit('data', Buffer.from('No such file or directory'))
    mockProc.emit('close', 1)

    await expect(resultPromise).rejects.toThrow('FFmpeg exited with code 1')
  })
})
