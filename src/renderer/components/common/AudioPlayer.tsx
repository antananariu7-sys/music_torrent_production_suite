import { Box, HStack, VStack, Text, IconButton, Icon } from '@chakra-ui/react'
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiVolume2, FiVolumeX } from 'react-icons/fi'
import { useEffect, useRef, useState } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { Slider } from '@/components/ui/slider'

export function AudioPlayer(): JSX.Element | null {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const currentTime = useAudioPlayerStore((s) => s.currentTime)
  const duration = useAudioPlayerStore((s) => s.duration)
  const volume = useAudioPlayerStore((s) => s.volume)
  const playlist = useAudioPlayerStore((s) => s.playlist)
  const currentIndex = useAudioPlayerStore((s) => s.currentIndex)

  const togglePlayPause = useAudioPlayerStore((s) => s.togglePlayPause)
  const seek = useAudioPlayerStore((s) => s.seek)
  const setVolume = useAudioPlayerStore((s) => s.setVolume)
  const next = useAudioPlayerStore((s) => s.next)
  const previous = useAudioPlayerStore((s) => s.previous)
  const setCurrentTime = useAudioPlayerStore((s) => s.setCurrentTime)
  const setDuration = useAudioPlayerStore((s) => s.setDuration)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(volume)
  const isLoadingRef = useRef(false)

  // Initialize audio element ONCE on mount
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    // Event listeners
    const handleTimeUpdate = () => {
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

    const loadAudio = async () => {
      if (!audioRef.current || !currentTrack || isLoadingRef.current) return

      isLoadingRef.current = true

      try {
        // Read audio file through IPC
        const response = await window.api.audio.readFile(currentTrack.filePath)

        if (!response.success || !response.dataUrl) {
          console.error('Failed to load audio file:', response.error)
          isLoadingRef.current = false
          return
        }

        if (!audioRef.current) {
          isLoadingRef.current = false
          return
        }

        audioRef.current.src = response.dataUrl
        audioRef.current.load()

        // Wait for audio to be ready before playing
        audioRef.current.oncanplay = () => {
          const shouldPlay = useAudioPlayerStore.getState().isPlaying
          if (audioRef.current && shouldPlay) {
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
      }
    }

    loadAudio()
  }, [currentTrack])

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

  const hasNext = currentIndex < playlist.length - 1
  const hasPrevious = currentIndex > 0

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
              <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={1}>
                {currentTrack.name}
              </Text>
              {playlist.length > 1 && (
                <Text fontSize="xs" color="text.muted">
                  {currentIndex + 1} / {playlist.length}
                </Text>
              )}
            </VStack>
          </HStack>

          {/* Playback controls */}
          <HStack gap={1}>
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
