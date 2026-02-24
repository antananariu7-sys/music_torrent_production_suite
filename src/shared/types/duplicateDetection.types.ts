/** Index entry for an audio file in the project */
export interface AudioFileEntry {
  /** Normalized file name (lowercase, no extension, no track number prefix) */
  normalizedName: string
  /** Original file name with extension */
  originalName: string
}

/** Request to check search results against existing project audio */
export interface DuplicateCheckRequest {
  /** Project directory path */
  projectDirectory: string
  /** Torrent titles to check for duplicates */
  titles: { id: string; title: string }[]
}

/** A single duplicate match */
export interface DuplicateMatch {
  /** Search result ID */
  resultId: string
  /** Matched audio files in the project */
  matchedFiles: string[]
  /** Confidence score 0-100 */
  confidence: number
}

/** Response from duplicate check */
export interface DuplicateCheckResponse {
  success: boolean
  /** Map of result ID -> matched files */
  matches: DuplicateMatch[]
  /** Number of audio files indexed */
  indexedFileCount: number
  error?: string
}
