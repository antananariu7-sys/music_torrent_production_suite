// Audio mix export types (doc 17)

export type OutputFormat = 'wav' | 'flac' | 'mp3'
export type Mp3Bitrate = 128 | 192 | 256 | 320

/**
 * Persistent export preferences stored in project.json under project.mixExportConfig.
 */
export interface MixExportConfig {
  defaultCrossfadeDuration: number       // Default: 5 (seconds)
  normalization: boolean                 // Default: true
  outputFormat: OutputFormat             // Default: 'flac'
  mp3Bitrate: Mp3Bitrate                // Default: 320
  generateCueSheet: boolean              // Default: true
}

/**
 * Optional metadata embedded in the exported audio file and CUE sheet.
 * All fields are optional — empty strings are not sent.
 */
export interface MixExportMetadata {
  title?: string
  artist?: string
  album?: string
  genre?: string
  year?: string
  comment?: string
}

/**
 * Per-export request payload sent from renderer to main.
 */
export interface MixExportRequest {
  projectId: string
  outputDirectory: string    // User-selected output dir
  outputFilename: string     // Without extension
  format: OutputFormat
  mp3Bitrate?: Mp3Bitrate
  normalization: boolean
  generateCueSheet: boolean
  defaultCrossfadeDuration: number
  metadata?: MixExportMetadata
}

/**
 * Progress push event sent from main to renderer during export.
 */
export interface MixExportProgress {
  phase: 'validating' | 'analyzing' | 'rendering' | 'encoding' | 'complete' | 'error' | 'cancelled'
  currentTrackIndex: number   // 0-based
  currentTrackName: string
  totalTracks: number
  percentage: number          // 0–100
  eta?: number                // seconds remaining (estimated)
  outputPath?: string         // Set on 'complete'
  error?: string              // Set on 'error'
}

/**
 * FFmpeg loudnorm first-pass measurement result per track.
 */
export interface LoudnormAnalysis {
  input_i: number       // Integrated loudness (LUFS)
  input_tp: number      // True peak (dBTP)
  input_lra: number     // Loudness range (LU)
  input_thresh: number  // Noise gate threshold (LUFS)
}

/**
 * FFmpeg availability check result.
 */
export interface FfmpegCheckResult {
  version: string
  path: string
}
