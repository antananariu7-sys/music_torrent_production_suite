import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, VStack, HStack, Text, Input, Button } from '@chakra-ui/react'
import { useProjectStore } from '@/store/useProjectStore'
import type { CrossfadeCurveType } from '@shared/types/project.types'

interface CrossfadePopoverProps {
  songId: string
  projectId: string
  currentValue: number
  currentCurveType: CrossfadeCurveType
  position: { x: number; y: number }
  onClose: () => void
}

const CURVE_OPTIONS: { value: CrossfadeCurveType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'equal-power', label: 'Equal Power' },
  { value: 's-curve', label: 'S-Curve' },
]

export function CrossfadePopover({
  songId,
  projectId,
  currentValue,
  currentCurveType,
  position,
  onClose,
}: CrossfadePopoverProps): JSX.Element {
  const [value, setValue] = useState(currentValue)
  const [curveType, setCurveType] =
    useState<CrossfadeCurveType>(currentCurveType)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

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
    // Delay to avoid closing on the same click that opened
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const persistUpdates = useCallback(
    (updates: {
      crossfadeDuration?: number
      crossfadeCurveType?: CrossfadeCurveType
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId,
          songId,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, 500)
    },
    [projectId, songId, setCurrentProject]
  )

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const newValue = parseFloat(e.target.value)
    setValue(newValue)
    persistUpdates({ crossfadeDuration: newValue })
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = parseFloat(e.target.value)
    if (isNaN(raw)) return
    const clamped = Math.min(30, Math.max(0, raw))
    setValue(clamped)
    persistUpdates({ crossfadeDuration: clamped })
  }

  function handleCurveChange(newCurve: CrossfadeCurveType): void {
    setCurveType(newCurve)
    persistUpdates({ crossfadeCurveType: newCurve })
  }

  function handleReset(): void {
    setValue(5)
    setCurveType('linear')
    persistUpdates({ crossfadeDuration: 5, crossfadeCurveType: 'linear' })
  }

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
          Crossfade Duration
        </Text>

        <input
          type="range"
          min={0}
          max={30}
          step={0.5}
          value={value}
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer' }}
        />

        <HStack gap={2}>
          <Input
            size="xs"
            type="number"
            value={value}
            min={0}
            max={30}
            step={0.5}
            w="70px"
            textAlign="center"
            fontFamily="monospace"
            onChange={handleInputChange}
          />
          <Text fontSize="xs" color="text.muted">
            seconds
          </Text>
        </HStack>

        {/* Curve type selector */}
        <Text fontSize="xs" fontWeight="semibold" color="text.primary">
          Curve
        </Text>
        <HStack gap={1}>
          {CURVE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="xs"
              variant={curveType === opt.value ? 'solid' : 'outline'}
              colorPalette={curveType === opt.value ? 'blue' : undefined}
              flex={1}
              onClick={() => handleCurveChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </HStack>

        <HStack justify="space-between">
          <Button
            size="xs"
            variant="ghost"
            color="text.muted"
            onClick={handleReset}
          >
            Reset to default
          </Button>
          <Button size="xs" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </HStack>
      </VStack>
    </Box>
  )
}
