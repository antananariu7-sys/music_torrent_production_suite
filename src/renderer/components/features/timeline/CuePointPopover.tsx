import { useState, useRef, useEffect } from 'react'
import { Box, VStack, HStack, Text, Input, Button } from '@chakra-ui/react'
import { nanoid } from 'nanoid'
import { useProjectStore } from '@/store/useProjectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { snapToNearestBeat } from './utils/snapToBeat'
import type { CuePoint } from '@shared/types/waveform.types'

interface CuePointPopoverProps {
  songId: string
  projectId: string
  existingCuePoints: CuePoint[]
  cuePoint?: CuePoint
  timestamp: number
  position: { x: number; y: number }
  bpm?: number
  firstBeatOffset?: number
  onClose: () => void
}

type CueType = CuePoint['type']

function formatTimestamp(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = (seconds % 60).toFixed(1)
  return `${min}:${sec.padStart(4, '0')}`
}

export function CuePointPopover({
  songId,
  projectId,
  existingCuePoints,
  cuePoint,
  timestamp: rawTimestamp,
  position,
  bpm,
  firstBeatOffset,
  onClose,
}: CuePointPopoverProps): JSX.Element {
  const isEditing = cuePoint != null
  const snapMode = useTimelineStore((s) => s.snapMode)

  // Apply snap-to-beat if enabled and BPM available
  const timestamp =
    !isEditing &&
    snapMode === 'beat' &&
    bpm &&
    bpm > 0 &&
    firstBeatOffset != null
      ? snapToNearestBeat(rawTimestamp, bpm, firstBeatOffset)
      : rawTimestamp

  const [label, setLabel] = useState(
    cuePoint?.label ?? `Cue ${existingCuePoints.length + 1}`
  )
  const [type, setType] = useState<CueType>(cuePoint?.type ?? 'marker')
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const containerRef = useRef<HTMLDivElement>(null)

  // ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  async function handleSave(): Promise<void> {
    const newCuePoint: CuePoint = {
      id: cuePoint?.id ?? nanoid(),
      timestamp: cuePoint?.timestamp ?? timestamp,
      label,
      type,
    }

    // Build updated cue points array
    let updatedCuePoints: CuePoint[]
    if (isEditing) {
      updatedCuePoints = existingCuePoints.map((cp) =>
        cp.id === cuePoint!.id ? newCuePoint : cp
      )
    } else {
      // For trim types, replace existing one of same type
      updatedCuePoints = existingCuePoints.filter(
        (cp) => cp.type !== type || type === 'marker'
      )
      updatedCuePoints.push(newCuePoint)
    }

    // Compute trim fields from cue points
    const trimStart = updatedCuePoints.find(
      (cp) => cp.type === 'trim-start'
    )?.timestamp
    const trimEnd = updatedCuePoints.find(
      (cp) => cp.type === 'trim-end'
    )?.timestamp

    const response = await window.api.mix.updateSong({
      projectId,
      songId,
      updates: {
        cuePoints: updatedCuePoints,
        trimStart,
        trimEnd,
      },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
    }
    onClose()
  }

  async function handleDelete(): Promise<void> {
    if (!cuePoint) return

    const updatedCuePoints = existingCuePoints.filter(
      (cp) => cp.id !== cuePoint.id
    )

    const trimStart = updatedCuePoints.find(
      (cp) => cp.type === 'trim-start'
    )?.timestamp
    const trimEnd = updatedCuePoints.find(
      (cp) => cp.type === 'trim-end'
    )?.timestamp

    const response = await window.api.mix.updateSong({
      projectId,
      songId,
      updates: {
        cuePoints: updatedCuePoints,
        trimStart,
        trimEnd,
      },
    })
    if (response.success && response.data) {
      setCurrentProject(response.data)
    }
    onClose()
  }

  const typeOptions: { value: CueType; label: string; color: string }[] = [
    { value: 'marker', label: 'Marker', color: '#3b82f6' },
    { value: 'trim-start', label: 'Trim Start', color: '#22c55e' },
    { value: 'trim-end', label: 'Trim End', color: '#ef4444' },
  ]

  return (
    <Box
      ref={containerRef}
      position="fixed"
      left={`${position.x}px`}
      top={`${position.y}px`}
      zIndex="popover"
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={3}
      shadow="lg"
      minW="220px"
    >
      <VStack align="stretch" gap={2}>
        <Text fontSize="xs" fontWeight="semibold" color="text.primary">
          {isEditing ? 'Edit Cue Point' : 'New Cue Point'}
        </Text>

        {/* Timestamp (read-only) */}
        <HStack>
          <Text fontSize="xs" color="text.muted" w="70px">
            Time:
          </Text>
          <Text fontSize="xs" color="text.primary" fontFamily="monospace">
            {formatTimestamp(cuePoint?.timestamp ?? timestamp)}
          </Text>
        </HStack>

        {/* Label */}
        <HStack>
          <Text fontSize="xs" color="text.muted" w="70px">
            Label:
          </Text>
          <Input
            size="xs"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Cue name"
          />
        </HStack>

        {/* Type selection */}
        <VStack align="stretch" gap={1}>
          <Text fontSize="xs" color="text.muted">
            Type:
          </Text>
          <HStack gap={1}>
            {typeOptions.map((opt) => (
              <Button
                key={opt.value}
                size="xs"
                variant={type === opt.value ? 'solid' : 'outline'}
                onClick={() => setType(opt.value)}
                flex={1}
                style={
                  type === opt.value
                    ? { backgroundColor: opt.color }
                    : undefined
                }
              >
                {opt.label}
              </Button>
            ))}
          </HStack>
        </VStack>

        {/* Actions */}
        <HStack justify="flex-end" gap={1} pt={1}>
          {isEditing && (
            <Button
              size="xs"
              variant="ghost"
              colorPalette="red"
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xs" colorPalette="blue" onClick={handleSave}>
            Save
          </Button>
        </HStack>
      </VStack>
    </Box>
  )
}
