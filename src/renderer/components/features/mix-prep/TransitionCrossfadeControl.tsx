import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Box, VStack, HStack, Text, Button } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import { useCrossfadePreview } from '@/hooks/useCrossfadePreview'
import type { Song, CrossfadeCurveType } from '@shared/types/project.types'

const CURVE_OPTIONS: { value: CrossfadeCurveType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'equal-power', label: 'Equal Power' },
  { value: 's-curve', label: 'S-Curve' },
]

interface TransitionCrossfadeControlProps {
  /** The outgoing song (crossfade settings live on this song) */
  outgoing: Song
  /** The incoming song */
  incoming: Song
  projectId: string
}

/**
 * Inline crossfade editing: duration slider, curve type buttons, preview button.
 * Reads crossfadeDuration and crossfadeCurveType from the outgoing track.
 */
export function TransitionCrossfadeControl({
  outgoing,
  incoming,
  projectId,
}: TransitionCrossfadeControlProps): JSX.Element {
  const [duration, setDuration] = useState(outgoing.crossfadeDuration ?? 5)
  const [curveType, setCurveType] = useState<CrossfadeCurveType>(
    outgoing.crossfadeCurveType ?? 'linear'
  )
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when outgoing song changes (pair navigation)
  useEffect(() => {
    setDuration(outgoing.crossfadeDuration ?? 5)
    setCurveType(outgoing.crossfadeCurveType ?? 'linear')
  }, [outgoing.id, outgoing.crossfadeDuration, outgoing.crossfadeCurveType])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Persistence ──────────────────────────────────────────────────────────

  const persistUpdates = useCallback(
    (updates: {
      crossfadeDuration?: number
      crossfadeCurveType?: CrossfadeCurveType
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId,
          songId: outgoing.id,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, 500)
    },
    [projectId, outgoing.id, setCurrentProject]
  )

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = parseFloat(e.target.value)
    setDuration(val)
    persistUpdates({ crossfadeDuration: val })
  }

  function handleCurveChange(newCurve: CrossfadeCurveType): void {
    setCurveType(newCurve)
    persistUpdates({ crossfadeCurveType: newCurve })
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  const outFilePath = outgoing.localFilePath ?? outgoing.externalFilePath ?? ''
  const inFilePath = incoming.localFilePath ?? incoming.externalFilePath ?? ''

  const previewOptions = useMemo(
    () =>
      outFilePath && inFilePath
        ? {
            trackA: {
              filePath: outFilePath,
              duration: outgoing.duration ?? 0,
              trimEnd: outgoing.trimEnd,
            },
            trackB: {
              filePath: inFilePath,
              trimStart: incoming.trimStart,
            },
            crossfadeDuration: duration,
            curveType,
          }
        : null,
    [
      outFilePath,
      inFilePath,
      outgoing.duration,
      outgoing.trimEnd,
      incoming.trimStart,
      duration,
      curveType,
    ]
  )
  const preview = useCrossfadePreview(previewOptions)

  return (
    <Box
      bg="bg.elevated"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      px={3}
      py={2}
      mt={1}
    >
      <VStack align="stretch" gap={2}>
        <HStack justify="space-between">
          <Text fontSize="xs" fontWeight="semibold" color="text.primary">
            Crossfade
          </Text>
          <Text fontSize="xs" fontFamily="monospace" color="text.muted">
            {duration.toFixed(1)}s
          </Text>
        </HStack>

        {/* Duration slider */}
        <input
          type="range"
          min={0}
          max={30}
          step={0.5}
          value={duration}
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer' }}
        />

        {/* Curve type selector */}
        <HStack gap={1}>
          {CURVE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="2xs"
              variant={curveType === opt.value ? 'solid' : 'outline'}
              colorPalette={curveType === opt.value ? 'blue' : undefined}
              flex={1}
              onClick={() => handleCurveChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </HStack>

        {/* Preview button */}
        <Button
          size="2xs"
          variant="outline"
          colorPalette="purple"
          w="100%"
          onClick={preview.isPlaying ? preview.stop : preview.play}
          disabled={!previewOptions || preview.isLoading}
          loading={preview.isLoading}
        >
          {preview.isPlaying ? 'Stop Preview' : 'Preview Crossfade'}
        </Button>
      </VStack>
    </Box>
  )
}
