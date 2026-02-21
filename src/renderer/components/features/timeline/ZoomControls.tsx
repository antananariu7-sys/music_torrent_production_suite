import { HStack, Text, IconButton, Box } from '@chakra-ui/react'
import {
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
  FiGrid,
  FiBarChart2,
  FiActivity,
  FiMusic,
} from 'react-icons/fi'
import { useTimelineStore } from '@/store/timelineStore'

interface ZoomControlsProps {
  totalDuration: number
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function ZoomControls({
  totalDuration,
}: ZoomControlsProps): JSX.Element {
  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)
  const zoomIn = useTimelineStore((s) => s.zoomIn)
  const zoomOut = useTimelineStore((s) => s.zoomOut)
  const snapMode = useTimelineStore((s) => s.snapMode)
  const toggleSnapMode = useTimelineStore((s) => s.toggleSnapMode)
  const frequencyColorMode = useTimelineStore((s) => s.frequencyColorMode)
  const toggleFrequencyColorMode = useTimelineStore(
    (s) => s.toggleFrequencyColorMode
  )
  const waveformStyle = useTimelineStore((s) => s.waveformStyle)
  const toggleWaveformStyle = useTimelineStore((s) => s.toggleWaveformStyle)
  const showBeatGrid = useTimelineStore((s) => s.showBeatGrid)
  const toggleBeatGrid = useTimelineStore((s) => s.toggleBeatGrid)

  return (
    <HStack gap={3} align="center">
      <IconButton
        aria-label="Zoom out"
        size="xs"
        variant="ghost"
        onClick={zoomOut}
      >
        <FiZoomOut />
      </IconButton>

      <input
        type="range"
        min={1}
        max={50}
        step={0.1}
        value={zoomLevel}
        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
        style={{ width: '120px', cursor: 'pointer' }}
      />

      <IconButton
        aria-label="Zoom in"
        size="xs"
        variant="ghost"
        onClick={zoomIn}
      >
        <FiZoomIn />
      </IconButton>

      <IconButton
        aria-label="Fit to view"
        size="xs"
        variant="ghost"
        onClick={() => setZoomLevel(1)}
      >
        <FiMaximize2 />
      </IconButton>

      <Text fontSize="xs" color="text.muted" ml={2}>
        {zoomLevel.toFixed(1)}x
      </Text>

      <Box w="1px" h="16px" bg="border.base" mx={1} />

      <IconButton
        aria-label="Toggle snap to beat"
        size="xs"
        variant={snapMode === 'beat' ? 'solid' : 'ghost'}
        colorPalette={snapMode === 'beat' ? 'purple' : 'gray'}
        onClick={toggleSnapMode}
      >
        <FiGrid />
      </IconButton>
      <Text
        fontSize="xs"
        color={snapMode === 'beat' ? 'text.primary' : 'text.muted'}
      >
        Snap
      </Text>

      <IconButton
        aria-label="Toggle beat grid"
        size="xs"
        variant={showBeatGrid ? 'solid' : 'ghost'}
        colorPalette={showBeatGrid ? 'purple' : 'gray'}
        onClick={toggleBeatGrid}
      >
        <FiMusic />
      </IconButton>
      <Text fontSize="xs" color={showBeatGrid ? 'text.primary' : 'text.muted'}>
        Beats
      </Text>

      <Box w="1px" h="16px" bg="border.base" mx={1} />

      <IconButton
        aria-label="Toggle frequency color mode"
        size="xs"
        variant={frequencyColorMode ? 'solid' : 'ghost'}
        colorPalette={frequencyColorMode ? 'teal' : 'gray'}
        onClick={toggleFrequencyColorMode}
      >
        <FiBarChart2 />
      </IconButton>
      <Text
        fontSize="xs"
        color={frequencyColorMode ? 'text.primary' : 'text.muted'}
      >
        Frequency
      </Text>

      <Box w="1px" h="16px" bg="border.base" mx={1} />

      <IconButton
        aria-label="Toggle waveform style"
        size="xs"
        variant={waveformStyle === 'smooth' ? 'solid' : 'ghost'}
        colorPalette={waveformStyle === 'smooth' ? 'blue' : 'gray'}
        onClick={toggleWaveformStyle}
      >
        <FiActivity />
      </IconButton>
      <Text
        fontSize="xs"
        color={waveformStyle === 'smooth' ? 'text.primary' : 'text.muted'}
      >
        Smooth
      </Text>

      {totalDuration > 0 && (
        <Text fontSize="xs" color="text.muted" ml="auto">
          Total: {formatDuration(totalDuration)}
        </Text>
      )}
    </HStack>
  )
}
