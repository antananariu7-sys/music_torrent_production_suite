import { create } from 'zustand'

export interface Track {
  filePath: string
  name: string
  duration?: number
}

interface AudioPlayerState {
  // Current track
  currentTrack: Track | null

  // Playback state
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number

  // Playlist
  playlist: Track[]
  currentIndex: number

  // Actions
  playTrack: (track: Track) => void
  playPlaylist: (tracks: Track[], startIndex?: number) => void
  play: () => void
  pause: () => void
  togglePlayPause: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  next: () => void
  previous: () => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  clearPlaylist: () => void
}

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  playlist: [],
  currentIndex: -1,

  playTrack: (track: Track) => {
    set({
      currentTrack: track,
      playlist: [track],
      currentIndex: 0,
      isPlaying: true,
      currentTime: 0,
    })
  },

  playPlaylist: (tracks: Track[], startIndex = 0) => {
    if (tracks.length === 0) return

    set({
      playlist: tracks,
      currentIndex: startIndex,
      currentTrack: tracks[startIndex],
      isPlaying: true,
      currentTime: 0,
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
    console.log('[AudioPlayer] Next clicked:', {
      currentIndex,
      playlistLength: playlist.length,
      hasNext: currentIndex < playlist.length - 1
    })

    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1
      console.log('[AudioPlayer] Moving to next track:', nextIndex, playlist[nextIndex]?.name)
      set({
        currentIndex: nextIndex,
        currentTrack: playlist[nextIndex],
        currentTime: 0,
        isPlaying: true,
      })
    } else {
      console.log('[AudioPlayer] No next track available')
    }
  },

  previous: () => {
    const { playlist, currentIndex, currentTime } = get()
    console.log('[AudioPlayer] Previous clicked:', {
      currentIndex,
      currentTime,
      playlistLength: playlist.length
    })

    // If more than 3 seconds into track, restart current track
    if (currentTime > 3) {
      console.log('[AudioPlayer] Restarting current track')
      set({ currentTime: 0 })
      return
    }

    // Otherwise go to previous track
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      console.log('[AudioPlayer] Moving to previous track:', prevIndex, playlist[prevIndex]?.name)
      set({
        currentIndex: prevIndex,
        currentTrack: playlist[prevIndex],
        currentTime: 0,
        isPlaying: true,
      })
    } else {
      console.log('[AudioPlayer] No previous track available')
    }
  },

  setCurrentTime: (time: number) => {
    set({ currentTime: time })
  },

  setDuration: (duration: number) => {
    set({ duration })
  },

  clearPlaylist: () => {
    set({
      currentTrack: null,
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    })
  },
}))
