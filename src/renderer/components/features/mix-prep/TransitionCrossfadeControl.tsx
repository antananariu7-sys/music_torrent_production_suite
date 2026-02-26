import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Box, VStack, HStack, Text, Button, Icon } from '@chakra-ui/react'
import { FiCheck, FiZap } from 'react-icons/fi'
import { Slider } from '@/components/ui/slider'
import { useProjectStore } from '@/store/useProjectStore'
import { useCrossfadePreview } from '@/hooks/useCrossfadePreview'
import { CrossfadeCurveCanvas } from '../timeline/CrossfadeCurveCanvas'
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
  onSuggestMixPoint?: () => void
  isSuggesting?: boolean
  canSuggest?: boolean
}

/**
 * Inline crossfade editing: Chakra slider, curve type buttons with preview canvas,
 * save indicator, suggest mix point button, and crossfade preview.
 */
export function TransitionCrossfadeControl({
  outgoing,
  incoming,
  projectId,
  onSuggestMixPoint,
  isSuggesting,
  canSuggest,
}: TransitionCrossfadeControlProps): JSX.Element {
  const [duration, setDuration] = useState(outgoing.crossfadeDuration ?? 5)
  const [curveType, setCurveType] = useState<CrossfadeCurveType>(
    outgoing.crossfadeCurveType ?? 'linear'
  )
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  )
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when outgoing song changes (pair navigation)
  useEffect(() => {
    setDuration(outgoing.crossfadeDuration ?? 5)
    setCurveType(outgoing.crossfadeCurveType ?? 'linear')
    setSaveState('idle')
  }, [outgoing.id, outgoing.crossfadeDuration, outgoing.crossfadeCurveType])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  // ── Persistence with save indicator ────────────────────────────────────────

  const persistUpdates = useCallback(
    (updates: {
      crossfadeDuration?: number
      crossfadeCurveType?: CrossfadeCurveType
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setSaveState('saving')
      debounceRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId,
          songId: outgoing.id,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
          setSaveState('saved')
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
          saveTimeoutRef.current = setTimeout(() => setSaveState('idle'), 1500)
        } else {
          setSaveState('idle')
        }
      }, 500)
    },
    [projectId, outgoing.id, setCurrentProject]
  )

  function handleSliderChange(val: number): void {
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
        {/* Header: title + helper text | duration + save indicator + suggest button */}
        <HStack justify="space-between">
          <VStack gap={0} align="start">
            <Text fontSize="xs" fontWeight="semibold" color="text.primary">
              Crossfade
            </Text>
            <Text fontSize="2xs" color="text.muted">
              How long the outgoing and incoming tracks overlap
            </Text>
          </VStack>
          <HStack gap={1}>
            <Text fontSize="xs" fontFamily="monospace" color="text.muted">
              {duration.toFixed(1)}s
            </Text>
            {saveState === 'saved' && (
              <Icon
                as={FiCheck}
                boxSize={3}
                color="green.400"
                animation="fadeIn 0.2s ease"
              />
            )}
            {onSuggestMixPoint && (
              <Button
                size="2xs"
                variant="ghost"
                colorPalette="blue"
                onClick={onSuggestMixPoint}
                disabled={!canSuggest || isSuggesting}
                loading={isSuggesting}
                title="Suggest optimal crossfade duration based on energy analysis"
              >
                <Icon as={FiZap} boxSize={3} />
              </Button>
            )}
          </HStack>
        </HStack>

        {/* Duration slider */}
        <Slider
          min={0}
          max={30}
          step={0.5}
          value={[duration]}
          onValueChange={(value) => handleSliderChange(value[0])}
        />

        {/* Curve type selector + inline curve preview */}
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
          <Box
            borderWidth="1px"
            borderColor="border.base"
            borderRadius="sm"
            overflow="hidden"
            w="120px"
            h="40px"
            flexShrink={0}
          >
            <CrossfadeCurveCanvas
              width={120}
              height={40}
              curveType={curveType}
              colorA="#3b82f6"
              colorB="#8b5cf6"
            />
          </Box>
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
