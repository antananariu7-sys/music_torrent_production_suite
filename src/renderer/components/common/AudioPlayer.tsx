import {
  Box,
  HStack,
  VStack,
  Text,
  IconButton,
  Icon,
  Badge,
} from '@chakra-ui/react'
import {
  FiPlay,
  FiPause,
  FiSkipBack,
  FiSkipForward,
  FiVolume2,
  FiVolumeX,
  FiX,
} from 'react-icons/fi'
import { useState } from 'react'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { useStreamPreviewStore } from '@/store/streamPreviewStore'
import { Slider } from '@/components/ui/slider'
import { useAudioEngine } from './useAudioEngine'

export function AudioPlayer(): JSX.Element | null {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack)
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying)
  const currentTime = useAudioPlayerStore((s) => s.currentTime)
  const duration = useAudioPlayerStore((s) => s.duration)
  const volume = useAudioPlayerStore((s) => s.volume)
  const playlist = useAudioPlayerStore((s) => s.playlist)
  const currentIndex = useAudioPlayerStore((s) => s.currentIndex)

  const stopPreview = useStreamPreviewStore((s) => s.stopPreview)
  const isFullyBuffered = useStreamPreviewStore((s) => s.isFullyBuffered)
  const bufferFraction = useStreamPreviewStore((s) => s.bufferFraction)

  const togglePlayPause = useAudioPlayerStore((s) => s.togglePlayPause)
  const seek = useAudioPlayerStore((s) => s.seek)
  const setVolume = useAudioPlayerStore((s) => s.setVolume)
  const next = useAudioPlayerStore((s) => s.next)
  const previous = useAudioPlayerStore((s) => s.previous)
  const clearPlaylist = useAudioPlayerStore((s) => s.clearPlaylist)

  const audioRef = useAudioEngine()

  const [isMuted, setIsMuted] = useState(false)
  const [previousVolume, setPreviousVolume] = useState(volume)

  // Don't show player if no track
  if (!currentTrack) return null

  const isPreview = !!currentTrack.isPreview
  const isPartialPreview = isPreview && !isFullyBuffered
  const seekMax = isPartialPreview ? duration * bufferFraction : duration
  const hasNext = !isPreview && currentIndex < playlist.length - 1
  const hasPrevious = !isPreview && currentIndex > 0

  const handleSeek = (value: number[]) => {
    const newTime = Math.min(value[0], seekMax)
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
          <Box flex="1" position="relative">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              size="sm"
            />
            {isPartialPreview && (
              <Box
                position="absolute"
                top="50%"
                transform="translateY(-50%)"
                left={`${bufferFraction * 100}%`}
                right={0}
                height="6px"
                bg="bg.elevated"
                opacity={0.7}
                borderRadius="full"
                pointerEvents="none"
              />
            )}
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
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  color="text.primary"
                  lineClamp={1}
                >
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
              <Icon
                as={isMuted || volume === 0 ? FiVolumeX : FiVolume2}
                boxSize={4}
              />
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
