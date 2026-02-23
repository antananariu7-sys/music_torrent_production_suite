import { create } from 'zustand'
import { useAudioPlayerStore } from './audioPlayerStore'

export type StreamPreviewStatus = 'idle' | 'buffering' | 'playing' | 'error'

interface StreamPreviewState {
  status: StreamPreviewStatus
  /** Identifies which track row is active: "magnetUri:fileIndex" */
  activeTrackKey: string | null
  bufferProgress: number
  /** true once the full file has been downloaded (not just the initial chunk) */
  isFullyBuffered: boolean
  /** 0-1 ratio of buffered bytes to total file size */
  bufferFraction: number
  error: string | null

  // Actions
  startPreview: (
    magnetUri: string,
    fileIndex: number,
    trackName: string
  ) => void
  stopPreview: () => void

  // Internal setters (called from IPC listener hook)
  setBuffering: (progress: number) => void
  setReady: (
    dataUrl: string,
    trackName: string,
    isPartial: boolean,
    bufferFraction?: number
  ) => void
  setFullReady: (dataUrl: string) => void
  setError: (error: string) => void
  reset: () => void
}

function makeTrackKey(magnetUri: string, fileIndex: number): string {
  return `${magnetUri}:${fileIndex}`
}

export const useStreamPreviewStore = create<StreamPreviewState>((set, get) => ({
  status: 'idle',
  activeTrackKey: null,
  bufferProgress: 0,
  isFullyBuffered: false,
  bufferFraction: 1,
  error: null,

  startPreview: async (magnetUri, fileIndex, trackName) => {
    // If already previewing, the service handles stopping the previous one
    set({
      status: 'buffering',
      activeTrackKey: makeTrackKey(magnetUri, fileIndex),
      bufferProgress: 0,
      isFullyBuffered: false,
      bufferFraction: 0,
      error: null,
    })

    try {
      await window.api.streamPreview.start({ magnetUri, fileIndex, trackName })
    } catch (err) {
      console.error('[StreamPreview] Failed to start:', err)
      set({ status: 'error', error: 'Failed to start preview' })
    }
  },

  stopPreview: async () => {
    const { status } = get()
    if (status === 'idle') return

    // If currently playing a preview, clear the audio player
    const audioStore = useAudioPlayerStore.getState()
    if (audioStore.currentTrack?.isPreview) {
      audioStore.clearPlaylist()
    }

    set({
      status: 'idle',
      activeTrackKey: null,
      bufferProgress: 0,
      isFullyBuffered: false,
      bufferFraction: 1,
      error: null,
    })

    try {
      await window.api.streamPreview.stop()
    } catch {
      // Ignore stop errors
    }
  },

  setBuffering: (progress) => {
    set({ bufferProgress: progress })
  },

  setReady: (dataUrl, trackName, isPartial, bufferFraction) => {
    set({
      status: 'playing',
      isFullyBuffered: !isPartial,
      bufferFraction: isPartial ? (bufferFraction ?? 0) : 1,
    })

    // Feed the data URL into the audio player as a preview track
    useAudioPlayerStore.getState().playTrack({
      filePath: dataUrl,
      name: trackName,
      isPreview: true,
    })
  },

  setFullReady: (dataUrl) => {
    set({ isFullyBuffered: true, bufferFraction: 1 })

    // Upgrade the current preview track to the full file, preserving playback position
    const audioState = useAudioPlayerStore.getState()
    if (!audioState.currentTrack?.isPreview) return

    useAudioPlayerStore.setState({
      currentTrack: { ...audioState.currentTrack, filePath: dataUrl },
      pendingSeekTime: audioState.currentTime,
      isPlaying: true,
    })
  },

  setError: (error) => {
    set({ status: 'error', error })
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      const current = get()
      if (current.status === 'error') {
        set({ status: 'idle', activeTrackKey: null, error: null })
      }
    }, 5000)
  },

  reset: () => {
    set({
      status: 'idle',
      activeTrackKey: null,
      bufferProgress: 0,
      isFullyBuffered: false,
      bufferFraction: 1,
      error: null,
    })
  },
}))
