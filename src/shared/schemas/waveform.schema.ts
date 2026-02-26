import { z } from 'zod'

/**
 * Cue point schema — validates user-placed markers on track timeline
 */
export const CuePointSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().nonnegative(),
  label: z.string(),
  type: z.enum(['marker', 'trim-start', 'trim-end']),
})

/**
 * Single waveform generation request
 */
export const WaveformGenerateRequestSchema = z.object({
  songId: z.string().min(1),
  filePath: z.string().min(1),
})

/**
 * Batch waveform generation request (all songs in a project)
 */
export const WaveformBatchRequestSchema = z.object({
  projectId: z.string().uuid(),
})

/**
 * Single BPM detection request
 */
export const BpmDetectRequestSchema = z.object({
  songId: z.string().min(1),
  filePath: z.string().min(1),
})

/**
 * Batch BPM detection request (all songs in a project)
 */
export const BpmBatchRequestSchema = z.object({
  projectId: z.string().uuid(),
})

/**
 * Detect BPM for a single song within a project (resolves path internally)
 */
export const BpmDetectSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  songId: z.string().min(1),
})

// --- Key detection schemas ---

/**
 * Single key detection request
 */
export const KeyDetectRequestSchema = z.object({
  songId: z.string().min(1),
  filePath: z.string().min(1),
})

/**
 * Batch key detection request (all songs in a project)
 */
export const KeyBatchRequestSchema = z.object({
  projectId: z.string().uuid(),
})

/**
 * Detect key for a single song within a project (resolves path internally)
 */
export const KeyDetectSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  songId: z.string().min(1),
})
