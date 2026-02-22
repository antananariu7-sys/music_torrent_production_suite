import { create } from 'zustand'

export interface Track {
  filePath: string
  name: string
  duration?: number
  trimStart?: number
  trimEnd?: number
  isPreview?: boolean
}

interface AudioPlayerState {
  // Current track
  currentTrack: Track | null

  // Playback state
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number

  // Seek
  pendingSeekTime: number | null

  // Loop region (for selection playback)
  loopRegion: { startTime: number; endTime: number } | null

  // Preview
  previewMaxDuration: number

  // Playlist
  playlist: Track[]
  currentIndex: number

  // Actions
  playTrack: (track: Track) => void
  playPlaylist: (
    tracks: Track[],
    startIndex?: number,
    seekTime?: number
  ) => void
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  next: () => void
  previous: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  clearPendingSeek: () => void
  setLoopRegion: (region: { startTime: number; endTime: number }) => void
  clearLoopRegion: () => void
  clearPlaylist: () => void
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  pendingSeekTime: null,
  loopRegion: null,
  previewMaxDuration: 60,
  playlist: [],
  currentIndex: -1,

  playTrack: (track: Track) => {
    set({
      currentTrack: track,
      playlist: [track],
      currentIndex: 0,
      isPlaying: true,
      currentTime: 0,
      loopRegion: null,
    })
  },

  playPlaylist: (tracks: Track[], startIndex = 0, seekTime?: number) => {
    if (tracks.length === 0) return

    set({
      playlist: tracks,
      currentIndex: startIndex,
      currentTrack: tracks[startIndex],
      isPlaying: true,
      currentTime: seekTime ?? 0,
      pendingSeekTime: seekTime ?? null,
      loopRegion: null,
    })
  },

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  togglePlayPause: () => {
    const { isPlaying } = get()
    set({ isPlaying: !isPlaying })
  },

  seek: (time: number) => {
    set({ currentTime: time })
  },

  setVolume: (volume: number) => {
    set({ volume: Math.max(0, Math.min(1, volume)) })
  },

  next: () => {
    const { playlist, currentIndex } = get()

    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1
      const nextTrack = playlist[nextIndex]
      const startTime = nextTrack.trimStart ?? 0
      set({
        currentIndex: nextIndex,
        currentTrack: nextTrack,
        currentTime: startTime,
        pendingSeekTime: startTime > 0 ? startTime : null,
        isPlaying: true,
      })
    }
  },

  previous: () => {
    const { playlist, currentIndex, currentTime } = get()

    // If more than 3 seconds into track, restart current track
    const currentTrack = playlist[currentIndex]
    const currentStart = currentTrack?.trimStart ?? 0
    if (currentTime - currentStart > 3) {
      set({
        currentTime: currentStart,
        pendingSeekTime: currentStart > 0 ? currentStart : null,
      })
      return
    }

    // Otherwise go to previous track
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      const prevTrack = playlist[prevIndex]
      const startTime = prevTrack.trimStart ?? 0
      set({
        currentIndex: prevIndex,
        currentTrack: prevTrack,
        currentTime: startTime,
        pendingSeekTime: startTime > 0 ? startTime : null,
        isPlaying: true,
      })
    }
  },

  setCurrentTime: (time: number) => {
    set({ currentTime: time })
  },

  setDuration: (duration: number) => {
    set({ duration })
  },

  clearPendingSeek: () => {
    set({ pendingSeekTime: null })
  },

  setLoopRegion: (region) => {
    set({ loopRegion: region })
  },

  clearLoopRegion: () => {
    set({ loopRegion: null })
  },

  clearPlaylist: () => {
    set({
      currentTrack: null,
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      pendingSeekTime: null,
    })
  },
}))
