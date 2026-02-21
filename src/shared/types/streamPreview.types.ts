export interface StreamPreviewStartRequest {
  magnetUri: string
  fileIndex: number
  trackName: string
}

export interface StreamPreviewReadyEvent {
  dataUrl: string
  trackName: string
  duration?: number
}

export interface StreamPreviewBufferingEvent {
  progress: number // 0-100
}

export interface StreamPreviewErrorEvent {
  error: string
}
