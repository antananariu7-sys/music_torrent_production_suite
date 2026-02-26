import { useEffect, useRef } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'

/**
 * Manages the HTMLAudioElement lifecycle, source loading, event listeners,
 * seek handling, loop region, and trim auto-advance.
 *
 * Returns the audioRef for use in UI seek/volume handlers.
 */
export function useAudioEngine() {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const volume = useAudioPlayerStore((s) => s.volume)
  const pendingSeekTime = useAudioPlayerStore((s) => s.pendingSeekTime)
  const loopRegion = useAudioPlayerStore((s) => s.loopRegion)
  const currentTime = useAudioPlayerStore((s) => s.currentTime)

  const setCurrentTime = useAudioPlayerStore((s) => s.setCurrentTime)
  const setDuration = useAudioPlayerStore((s) => s.setDuration)
  const clearPendingSeek = useAudioPlayerStore((s) => s.clearPendingSeek)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadedFilePathRef = useRef<string>('')
  const isLoadingRef = useRef(false)

  // Initialize audio element ONCE on mount
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    // Event listeners
    const handleTimeUpdate = () => {
      // Suppress time updates while loading a new track to prevent
      // the playhead from flashing to 0 when audio source changes
      if (isLoadingRef.current) return
      // Guard against stale timeupdate events from the old audio source.
      const track = useAudioPlayerStore.getState().currentTrack
      if (track && track.filePath !== loadedFilePathRef.current) return
      setCurrentTime(audio.currentTime)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }

    const handleEnded = () => {
      // Auto-play next track - use store directly to avoid closure issues
      useAudioPlayerStore.getState().next()
    }

    const handleError = (e: Event) => {
      console.error('Audio playback error:', e)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [setCurrentTime, setDuration])

  // Update audio source when track changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return

    // Same file already loaded — just seek without reloading
    if (currentTrack.filePath === loadedFilePathRef.current) {
      const state = useAudioPlayerStore.getState()
      if (state.pendingSeekTime != null) {
        audioRef.current.currentTime = state.pendingSeekTime
        state.clearPendingSeek()
      }
      if (state.isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch((err) => {
          console.error('Failed to play audio:', err)
        })
      }
      return
    }

    // Mark as loading SYNCHRONOUSLY before async work starts,
    // so the isPlaying effect won't try to play the old audio
    isLoadingRef.current = true
    loadedFilePathRef.current = currentTrack.filePath
    audioRef.current.pause()

    // Preview tracks carry a data URL; local files use the custom audio:// protocol
    const src = currentTrack.filePath.startsWith('data:')
      ? currentTrack.filePath
      : `audio://play?path=${encodeURIComponent(currentTrack.filePath)}`

    audioRef.current.src = src
    audioRef.current.load()

    // Wait for audio to be ready before playing
    audioRef.current.oncanplay = () => {
      const state = useAudioPlayerStore.getState()
      if (audioRef.current && state.pendingSeekTime != null) {
        audioRef.current.currentTime = state.pendingSeekTime
        state.clearPendingSeek()
      }
      if (audioRef.current && state.isPlaying) {
        audioRef.current.play().catch((err) => {
          console.error('Failed to play audio:', err)
        })
      }
      if (audioRef.current) {
        audioRef.current.oncanplay = null
      }
      isLoadingRef.current = false
    }

    // Handle load errors (file not found, unsupported format, etc.)
    audioRef.current.onerror = () => {
      console.error('[AudioPlayer] Failed to load:', currentTrack.filePath)
      isLoadingRef.current = false
      loadedFilePathRef.current = ''
      if (audioRef.current) audioRef.current.onerror = null
    }
  }, [currentTrack])

  // Handle pending seek from external callers (e.g., Timeline click)
  useEffect(() => {
    if (!audioRef.current || pendingSeekTime == null || isLoadingRef.current)
      return
    audioRef.current.currentTime = pendingSeekTime
    clearPendingSeek()
  }, [pendingSeekTime, clearPendingSeek])

  // Handle loop region — seek back to start when reaching end
  useEffect(() => {
    if (!loopRegion || !isPlaying || !audioRef.current) return
    if (currentTime >= loopRegion.endTime) {
      audioRef.current.currentTime = loopRegion.startTime
      useAudioPlayerStore.getState().setCurrentTime(loopRegion.startTime)
    }
  }, [currentTime, loopRegion, isPlaying])

  // Handle trimEnd auto-advance (skip when loop region is active)
  useEffect(() => {
    if (loopRegion) return
    if (!currentTrack?.trimEnd || !isPlaying) return
    if (currentTime >= currentTrack.trimEnd) {
      useAudioPlayerStore.getState().next()
    }
  }, [currentTime, currentTrack, isPlaying, loopRegion])

  // Handle play/pause state changes (only when NOT loading a new track)
  useEffect(() => {
    if (!audioRef.current || isLoadingRef.current) return

    if (isPlaying) {
      audioRef.current.play().catch((err) => {
        console.error('Failed to play audio:', err)
      })
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying])

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  return audioRef
}
