import { memo } from 'react'
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
import { useShallow } from 'zustand/react/shallow'
import { useTimelineStore } from '@/store/timelineStore'
import { MIN_ZOOM, MAX_ZOOM } from './TimelineLayout'

interface ZoomControlsProps {
  totalDuration: number
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export const ZoomControls = memo(function ZoomControls({
  totalDuration,
}: ZoomControlsProps): JSX.Element {
  // State values grouped with useShallow to prevent re-renders on unrelated store changes
  const {
    zoomLevel,
    snapMode,
    frequencyColorMode,
    waveformStyle,
    showBeatGrid,
  } = useTimelineStore(
    useShallow((s) => ({
      zoomLevel: s.zoomLevel,
      snapMode: s.snapMode,
      frequencyColorMode: s.frequencyColorMode,
      waveformStyle: s.waveformStyle,
      showBeatGrid: s.showBeatGrid,
    }))
  )

  // Action selectors are stable refs from create() — keep separate
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)
  const zoomIn = useTimelineStore((s) => s.zoomIn)
  const zoomOut = useTimelineStore((s) => s.zoomOut)
  const toggleSnapMode = useTimelineStore((s) => s.toggleSnapMode)
  const toggleFrequencyColorMode = useTimelineStore(
    (s) => s.toggleFrequencyColorMode
  )
  const toggleWaveformStyle = useTimelineStore((s) => s.toggleWaveformStyle)
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
        min={MIN_ZOOM}
        max={MAX_ZOOM}
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
        onClick={() => setZoomLevel(MIN_ZOOM)}
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
})
