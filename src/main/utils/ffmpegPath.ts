import { app } from 'electron'

/**
 * Resolve the path to the FFmpeg binary from ffmpeg-static.
 *
 * In development: uses the path from node_modules directly.
 * In packaged app: replaces app.asar with app.asar.unpacked since
 * the binary must be unpacked from the asar archive.
 */
export function getFfmpegPath(): string {
  // ffmpeg-static exports the binary path as default
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegPath: string | null = require('ffmpeg-static')

  if (!ffmpegPath) {
    throw new Error('ffmpeg-static binary path not found')
  }

  if (app.isPackaged) {
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  }

  return ffmpegPath
}
