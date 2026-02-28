import { spawn, type ChildProcess } from 'child_process'
import { getFfmpegPath } from './ffmpegPath'

/**
 * Regex to extract elapsed time from FFmpeg stderr progress output.
 * FFmpeg writes lines like: "time=00:01:23.45" during encoding.
 */
const TIME_REGEX = /time=(\d{2}):(\d{2}):(\d{2}\.\d+)/

/**
 * Parse a `time=HH:MM:SS.ms` string into total seconds.
 * Returns null if the line doesn't contain a time stamp.
 */
export function parseTimeProgress(line: string): number | null {
  const match = line.match(TIME_REGEX)
  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseFloat(match[3])

  return hours * 3600 + minutes * 60 + seconds
}

export interface FfmpegResult {
  code: number | null
  stdout: string
  stderr: string
}

export interface SpawnedFfmpeg {
  /** The child process handle — call .kill() to cancel */
  process: ChildProcess
  /** Resolves when FFmpeg exits */
  promise: Promise<FfmpegResult>
}

/**
 * Spawn an FFmpeg process with the given arguments.
 *
 * @param args - FFmpeg CLI arguments (without the `ffmpeg` binary itself)
 * @param onProgress - Optional callback invoked with elapsed seconds parsed from stderr
 * @returns The child process and a promise that resolves on exit
 */
export function spawnFfmpeg(
  args: string[],
  onProgress?: (elapsedSeconds: number) => void
): SpawnedFfmpeg {
  const ffmpegPath = getFfmpegPath()

  const proc = spawn(ffmpegPath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  const promise = new Promise<FfmpegResult>((resolve, reject) => {
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString())
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stderrChunks.push(text)

      if (onProgress) {
        const seconds = parseTimeProgress(text)
        if (seconds !== null) {
          onProgress(seconds)
        }
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })

    proc.on('close', (code) => {
      resolve({
        code,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      })
    })
  })

  return { process: proc, promise }
}

/**
 * Run FFmpeg and wait for completion. Throws if exit code is non-zero.
 */
export async function runFfmpeg(
  args: string[],
  onProgress?: (elapsedSeconds: number) => void
): Promise<FfmpegResult> {
  const { promise } = spawnFfmpeg(args, onProgress)
  const result = await promise

  if (result.code !== 0) {
    throw new Error(
      `FFmpeg exited with code ${result.code}:\n${result.stderr.slice(-500)}`
    )
  }

  return result
}

/**
 * Check whether a given FFmpeg filter is available in the installed binary.
 * Uses `ffmpeg -filters` and searches the output for the filter name.
 */
export async function checkFFmpegFilter(filterName: string): Promise<boolean> {
  const ffmpegPath = getFfmpegPath()

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-filters', '-hide_banner'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const chunks: string[] = []

    proc.stdout?.on('data', (chunk: Buffer) => {
      chunks.push(chunk.toString())
    })

    proc.on('error', () => resolve(false))

    proc.on('close', () => {
      const output = chunks.join('')
      // FFmpeg lists filters like: " A->A rubberband ..."
      // Match on word boundary to avoid partial matches
      const regex = new RegExp(`\\b${filterName}\\b`)
      resolve(regex.test(output))
    })
  })
}
