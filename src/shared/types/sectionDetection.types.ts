/**
 * Types for auto section detection (Phase 7).
 * Sections represent structural parts of a track: intro, buildup, drop, etc.
 */

/** Section type classification */
export type SectionType =
  | 'intro'
  | 'buildup'
  | 'drop'
  | 'breakdown'
  | 'outro'
  | 'custom'

/**
 * A detected structural section of a track.
 */
export interface TrackSection {
  id: string
  type: SectionType
  startTime: number // seconds
  endTime: number // seconds
  label?: string // user override
  confidence: number // 0–1, based on novelty peak prominence
}

/**
 * Full section detection result, cached to disk.
 */
export interface SectionData {
  songId: string
  sections: TrackSection[]
  fileHash: string
}

// --- IPC request types ---

export interface SectionDetectRequest {
  projectId: string
  songId: string
}

export interface SectionBatchRequest {
  projectId: string
}

// --- IPC progress event types ---

export interface SectionProgressEvent {
  songId: string
  index: number
  total: number
}
