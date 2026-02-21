import { Box, HStack, VStack, Text, IconButton, Icon, Badge } from '@chakra-ui/react'
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiVolume2, FiVolumeX, FiX } from 'react-icons/fi'
import { useEffect, useRef, useState } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { useStreamPreviewStore } from '@/store/streamPreviewStore'
import { Slider } from '@/components/ui/slider'

export function AudioPlayer(): JSX.Element | null {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const currentTime = useAudioPlayerStore((s) => s.currentTime)
  const duration = useAudioPlayerStore((s) => s.duration)
  const volume = useAudioPlayerStore((s) => s.volume)
  const playlist = useAudioPlayerStore((s) => s.playlist)
  const currentIndex = useAudioPlayerStore((s) => s.currentIndex)

  const pendingSeekTime = useAudioPlayerStore((s) => s.pendingSeekTime)
  const previewMaxDuration = useAudioPlayerStore((s) => s.previewMaxDuration)

  const stopPreview = useStreamPreviewStore((s) => s.stopPreview)

  const togglePlayPause = useAudioPlayerStore((s) => s.togglePlayPause)
  const seek = useAudioPlayerStore((s) => s.seek)
  const setVolume = useAudioPlayerStore((s) => s.setVolume)
  const next = useAudioPlayerStore((s) => s.next)
  const previous = useAudioPlayerStore((s) => s.previous)
  const setCurrentTime = useAudioPlayerStore((s) => s.setCurrentTime)
  const setDuration = useAudioPlayerStore((s) => s.setDuration)
  const clearPendingSeek = useAudioPlayerStore((s) => s.clearPendingSeek)
  const clearPlaylist = useAudioPlayerStore((s) => s.clearPlaylist)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const loadedFilePathRef = useRef<string>('')
  const [isMuted, setIsMuted] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(volume)
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

    const loadAudio = async () => {
      if (!audioRef.current || !currentTrack) return

      try {
        let dataUrl: string

        // Preview tracks already carry a data URL — skip the IPC read
        if (currentTrack.filePath.startsWith('data:')) {
          dataUrl = currentTrack.filePath
        } else {
          // Read audio file through IPC
          const response = await window.api.audio.readFile(currentTrack.filePath)

          if (!response.success || !response.dataUrl) {
            console.error('Failed to load audio file:', response.error)
            isLoadingRef.current = false
            loadedFilePathRef.current = ''
            return
          }

          dataUrl = response.dataUrl
        }

        if (!audioRef.current) {
          isLoadingRef.current = false
          return
        }

        audioRef.current.src = dataUrl
        audioRef.current.load()

        // Wait for audio to be ready before playing
        audioRef.current.oncanplay = () => {
          const state = useAudioPlayerStore.getState()
          // Apply pending seek if present
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
      } catch (error) {
        console.error('Error loading audio:', error)
        isLoadingRef.current = false
        loadedFilePathRef.current = ''
      }
    }

    loadAudio()
  }, [currentTrack])

  // Handle pending seek from external callers (e.g., Timeline click)
  useEffect(() => {
    if (!audioRef.current || pendingSeekTime == null || isLoadingRef.current) return
    audioRef.current.currentTime = pendingSeekTime
    clearPendingSeek()
  }, [pendingSeekTime, clearPendingSeek])

  // Handle trimEnd auto-advance
  useEffect(() => {
    if (!currentTrack?.trimEnd || !isPlaying) return
    if (currentTime >= currentTrack.trimEnd) {
      useAudioPlayerStore.getState().next()
    }
  }, [currentTime, currentTrack, isPlaying])

  // Auto-stop preview after max duration
  useEffect(() => {
    if (!currentTrack?.isPreview || !isPlaying) return
    if (currentTime >= previewMaxDuration) {
      stopPreview()
    }
  }, [currentTime, currentTrack, isPlaying, previewMaxDuration, stopPreview])

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

  // Don't show player if no track
  if (!currentTrack) return null

  const handleSeek = (value: number[]) => {
    const newTime = value[0]
    seek(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    if (isMuted) {
      setVolume(previousVolume > 0 ? previousVolume : 0.7)
      setIsMuted(false)
    } else {
      setPreviousVolume(volume)
      setVolume(0)
      setIsMuted(true)
    }
  }

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isPreview = !!currentTrack.isPreview
  const hasNext = !isPreview && currentIndex < playlist.length - 1
  const hasPrevious = !isPreview && currentIndex > 0

  const handleClose = () => {
    if (isPreview) {
      stopPreview()
    } else {
      clearPlaylist()
    }
  }

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      bg="bg.elevated"
      borderTop="1px solid"
      borderColor="border.base"
      p={4}
      zIndex={100}
    >
      <IconButton
        aria-label="Close player"
        size="xs"
        variant="ghost"
        position="absolute"
        top={1}
        right={1}
        onClick={handleClose}
        title="Close player"
      >
        <Icon as={FiX} boxSize={3} />
      </IconButton>
      <VStack gap={2} align="stretch">
        {/* Progress bar */}
        <HStack gap={2} align="center">
          <Text fontSize="xs" color="text.muted" w="45px" textAlign="right">
            {formatTime(currentTime)}
          </Text>
          <Box flex="1">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              size="sm"
            />
          </Box>
          <Text fontSize="xs" color="text.muted" w="45px">
            {formatTime(duration)}
          </Text>
        </HStack>

        {/* Controls */}
        <HStack justify="space-between" align="center">
          {/* Track info */}
          <HStack flex="1" minW={0}>
            <VStack align="start" gap={0} minW={0}>
              <HStack gap={2}>
                <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
                  {currentTrack.name}
                </Text>
                {isPreview && (
                  <Badge colorPalette="purple" size="sm" variant="subtle">
                    Preview
                  </Badge>
                )}
              </HStack>
              {!isPreview && playlist.length > 1 && (
                <Text fontSize="xs" color="text.muted">
                  {currentIndex + 1} / {playlist.length}
                </Text>
              )}
            </VStack>
          </HStack>

          {/* Playback controls */}
          <HStack gap={1}>
            {!isPreview && (
              <IconButton
                aria-label="Previous track"
                size="sm"
                variant="ghost"
                onClick={previous}
                disabled={!hasPrevious && currentTime < 3}
                title="Previous track"
              >
                <Icon as={FiSkipBack} boxSize={4} />
              </IconButton>
            )}

            <IconButton
              aria-label={isPlaying ? 'Pause' : 'Play'}
              size="md"
              variant="solid"
              colorPalette="blue"
              onClick={togglePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <Icon as={isPlaying ? FiPause : FiPlay} boxSize={5} />
            </IconButton>

            {!isPreview && (
              <IconButton
                aria-label="Next track"
                size="sm"
                variant="ghost"
                onClick={next}
                disabled={!hasNext}
                title="Next track"
              >
                <Icon as={FiSkipForward} boxSize={4} />
              </IconButton>
            )}
          </HStack>

          {/* Volume control */}
          <HStack flex="1" justify="flex-end" gap={2}>
            <IconButton
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              size="sm"
              variant="ghost"
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <Icon as={isMuted || volume === 0 ? FiVolumeX : FiVolume2} boxSize={4} />
            </IconButton>
            <Box w="100px">
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                size="sm"
              />
            </Box>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  )
}
