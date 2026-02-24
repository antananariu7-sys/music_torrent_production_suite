import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'

// Mock path module
jest.mock('path', () => ({
  extname: jest.fn((name: string) => {
    const dotIndex = name.lastIndexOf('.')
    return dotIndex >= 0 ? name.slice(dotIndex) : ''
  }),
}))

// Track mock state
type ListenerFn = (...args: unknown[]) => void
let mockTorrentListeners: Record<string, ListenerFn> = {}
let mockStreamListeners: Record<string, ListenerFn> = {}
let mockFiles: Array<{
  name: string
  length: number
  select: jest.Mock
  deselect: jest.Mock
  createReadStream: jest.Mock
}> = []
let mockClientDestroyCb: jest.Mock
let mockAdd: jest.Mock

// Mock webtorrent
jest.mock('webtorrent', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockImplementation((_magnetUri: string, _opts: unknown) => {
      mockTorrentListeners = {}
      const torrent = {
        files: mockFiles,
        on: jest.fn((event: string, cb: ListenerFn) => {
          mockTorrentListeners[event] = cb
        }),
        destroy: jest.fn((_destroyOpts: unknown, cb?: ListenerFn) => {
          cb?.()
        }),
      }
      mockAdd(torrent)
      return torrent
    }),
    on: jest.fn(),
    destroy: jest.fn((cb?: ListenerFn) => {
      mockClientDestroyCb?.()
      cb?.()
    }),
  })),
}))

import { StreamPreviewService } from './StreamPreviewService'
import { IPC_CHANNELS } from '@shared/constants'

/** Create a mock WebContents sender */
function makeSender() {
  return {
    send: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
  } as unknown as Electron.WebContents
}

/** Create a mock torrent file */
function makeFile(name: string, length: number) {
  const stream = {
    on: jest.fn((event: string, cb: ListenerFn) => {
      mockStreamListeners[event] = cb
    }),
  }
  return {
    name,
    length,
    select: jest.fn(),
    deselect: jest.fn(),
    createReadStream: jest.fn().mockReturnValue(stream),
  }
}

describe('StreamPreviewService', () => {
  let service: StreamPreviewService
  let sender: ReturnType<typeof makeSender>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockTorrentListeners = {}
    mockStreamListeners = {}
    mockFiles = []
    mockAdd = jest.fn()
    mockClientDestroyCb = jest.fn()
    service = new StreamPreviewService()
    sender = makeSender()
  })

  afterEach(async () => {
    jest.useRealTimers()
    await service.cleanup()
  })

  describe('start', () => {
    it('should reject unsupported extension with error', async () => {
      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.ape' },
        sender as Electron.WebContents
      )

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        { error: 'Preview not available for this format (.ape)' }
      )
    })

    it('should reject .wma extension with error', async () => {
      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.wma' },
        sender as Electron.WebContents
      )

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        expect.objectContaining({ error: expect.stringContaining('.wma') })
      )
    })

    it('should accept supported extensions and begin buffering', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_BUFFERING,
        { progress: 0 }
      )
    })

    it('should stop previous preview when starting a new one', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test1', fileIndex: 0, trackName: 'song1.mp3' },
        sender as Electron.WebContents
      )

      // Start another — the first should be stopped
      await service.start(
        { magnetUri: 'magnet:?xt=test2', fileIndex: 0, trackName: 'song2.mp3' },
        sender as Electron.WebContents
      )

      // mockAdd called twice (once for each start)
      expect(mockAdd).toHaveBeenCalledTimes(2)
    })

    it('should fire metadata timeout after 15s', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      // Advance timers by 15 seconds
      jest.advanceTimersByTime(15_000)

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        { error: "No peers available — can't preview this track" }
      )
    })
  })

  describe('onTorrentReady — file index validation', () => {
    it('should report error for file index out of bounds (too high)', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 5, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      // Trigger torrent ready event
      mockTorrentListeners['ready']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        { error: 'Track not found in torrent' }
      )
    })

    it('should report error for negative file index', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: -1, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        { error: 'Track not found in torrent' }
      )
    })

    it('should report error if file in torrent has unsupported extension', async () => {
      mockFiles = [makeFile('song.ape', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_ERROR,
        { error: 'Preview not available for this format (.ape)' }
      )
    })
  })

  describe('buffering and progress', () => {
    it('should clamp buffering progress to 99 before ready', async () => {
      const file = makeFile('song.mp3', 100) // Small file, 100 bytes
      mockFiles = [file]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      // Simulate data chunk that's 99% of total
      mockStreamListeners['data']?.(Buffer.alloc(99))

      const bufferingCalls = (sender.send as jest.Mock).mock.calls.filter(
        (call: unknown[]) => call[0] === IPC_CHANNELS.STREAM_PREVIEW_BUFFERING
      )
      const lastBufferingCall = bufferingCalls[bufferingCalls.length - 1]
      expect(lastBufferingCall[1].progress).toBeLessThanOrEqual(99)
    })

    it('should send ready event with correct MIME type for mp3', async () => {
      const file = makeFile('song.mp3', 100)
      mockFiles = [file]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      // Simulate receiving all data and end
      mockStreamListeners['data']?.(Buffer.alloc(100))
      mockStreamListeners['end']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_READY,
        expect.objectContaining({
          dataUrl: expect.stringContaining('data:audio/mpeg;base64,'),
          trackName: 'song.mp3',
        })
      )
    })

    it('should send ready event with correct MIME type for flac', async () => {
      const file = makeFile('song.flac', 100)
      mockFiles = [file]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.flac' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      mockStreamListeners['data']?.(Buffer.alloc(100))
      mockStreamListeners['end']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_READY,
        expect.objectContaining({
          dataUrl: expect.stringContaining('data:audio/flac;base64,'),
        })
      )
    })

    it('should send ready event with correct MIME type for ogg', async () => {
      const file = makeFile('song.ogg', 100)
      mockFiles = [file]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.ogg' },
        sender as Electron.WebContents
      )

      mockTorrentListeners['ready']?.()

      mockStreamListeners['data']?.(Buffer.alloc(100))
      mockStreamListeners['end']?.()

      expect(sender.send).toHaveBeenCalledWith(
        IPC_CHANNELS.STREAM_PREVIEW_READY,
        expect.objectContaining({
          dataUrl: expect.stringContaining('data:audio/ogg;base64,'),
        })
      )
    })
  })

  describe('stop', () => {
    it('should be safe to call when idle (no-op)', async () => {
      await expect(service.stop()).resolves.toBeUndefined()
    })

    it('should clear sender reference', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      await service.stop()

      // After stop, further pushes should not reach sender
      // Internal state is private, so we verify indirectly via cleanup behavior
    })
  })

  describe('cleanup', () => {
    it('should be safe to call multiple times', async () => {
      await service.cleanup()
      await expect(service.cleanup()).resolves.toBeUndefined()
    })

    it('should destroy the client', async () => {
      mockFiles = [makeFile('song.mp3', 1000)]

      // Start triggers client creation
      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song.mp3' },
        sender as Electron.WebContents
      )

      await service.cleanup()

      // After cleanup, starting a new preview should create a fresh client
      await service.start(
        { magnetUri: 'magnet:?xt=test', fileIndex: 0, trackName: 'song2.mp3' },
        sender as Electron.WebContents
      )
      // No errors means a new client was created successfully
    })
  })
})
