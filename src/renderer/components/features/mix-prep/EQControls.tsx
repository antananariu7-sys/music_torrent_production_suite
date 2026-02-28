import { VStack, HStack, Text, Button } from '@chakra-ui/react'
import { Slider } from '@/components/ui/slider'
import type { DeckEQState } from '@/services/WebAudioEngine'

type EQBand = 'low' | 'mid' | 'high'

interface EQControlsProps {
  label: string
  color: string
  eq: DeckEQState
  onChange: (band: EQBand, gainDb: number) => void
  onReset: () => void
}

const BANDS: { key: EQBand; label: string }[] = [
  { key: 'low', label: 'Lo' },
  { key: 'mid', label: 'Mid' },
  { key: 'high', label: 'Hi' },
]

function formatDb(value: number): string {
  if (value === 0) return '0'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

export function EQControls({
  label,
  color,
  eq,
  onChange,
  onReset,
}: EQControlsProps): JSX.Element {
  const isZero = eq.low === 0 && eq.mid === 0 && eq.high === 0

  return (
    <VStack gap={1} minW="100px">
      <Text fontSize="2xs" fontWeight="semibold" color={color}>
        {label}
      </Text>

      <HStack gap={3} align="flex-end" h="100px">
        {BANDS.map(({ key, label: bandLabel }) => (
          <VStack key={key} gap={0.5} align="center">
            <Text fontSize="2xs" color="text.muted" lineHeight="1">
              {formatDb(eq[key])}
            </Text>
            <Slider
              orientation="vertical"
              value={[eq[key]]}
              onValueChange={(vals) => onChange(key, vals[0])}
              min={-12}
              max={12}
              step={0.5}
              size="sm"
              h="72px"
              colorPalette={color === '#3b82f6' ? 'blue' : 'purple'}
            />
            <Text fontSize="2xs" color="text.muted" lineHeight="1">
              {bandLabel}
            </Text>
          </VStack>
        ))}
      </HStack>

      <Button
        size="2xs"
        variant="ghost"
        onClick={onReset}
        disabled={isZero}
        fontSize="2xs"
      >
        Reset
      </Button>
    </VStack>
  )
}
