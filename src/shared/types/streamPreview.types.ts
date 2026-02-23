export interface StreamPreviewStartRequest {
  magnetUri: string
  fileIndex: number
  trackName: string
}

export interface StreamPreviewReadyEvent {
  dataUrl: string
  trackName: string
  duration?: number
  /** true when this is the initial chunk — full file still downloading */
  isPartial?: boolean
  /** 0-1 ratio of buffered bytes to total file size (only set when isPartial) */
  bufferFraction?: number
}

export interface StreamPreviewBufferingEvent {
  progress: number // 0-100
}

export interface StreamPreviewErrorEvent {
  error: string
}
