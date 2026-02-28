import { useCallback, useState } from 'react'
import { HStack, Box } from '@chakra-ui/react'
import { EQControls } from './EQControls'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import type { DeckEQState } from '@/services/WebAudioEngine'

type DeckId = 'A' | 'B'
type EQBand = 'low' | 'mid' | 'high'

/**
 * Side-by-side EQ panel for deck A (outgoing) and deck B (incoming).
 * Reads/writes EQ state directly from/to the WebAudioEngine singleton.
 */
export function TransitionEQPanel(): JSX.Element {
  const engine = WebAudioEngine.getInstance()

  // Local state mirrors engine EQ — triggers re-render on change
  const [eqA, setEqA] = useState<DeckEQState>(() => engine.getDeckEQ('A'))
  const [eqB, setEqB] = useState<DeckEQState>(() => engine.getDeckEQ('B'))

  const handleChange = useCallback(
    (deck: DeckId, band: EQBand, gainDb: number) => {
      engine.setDeckEQ(deck, band, gainDb)
      if (deck === 'A') {
        setEqA(engine.getDeckEQ('A'))
      } else {
        setEqB(engine.getDeckEQ('B'))
      }
    },
    [engine]
  )

  const handleReset = useCallback(
    (deck: DeckId) => {
      engine.resetDeckEQ(deck)
      if (deck === 'A') {
        setEqA(engine.getDeckEQ('A'))
      } else {
        setEqB(engine.getDeckEQ('B'))
      }
    },
    [engine]
  )

  return (
    <HStack
      gap={4}
      justify="center"
      py={2}
      px={3}
      bg="bg.card"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border.base"
    >
      <EQControls
        label="Track A"
        color="#3b82f6"
        eq={eqA}
        onChange={(band, gain) => handleChange('A', band, gain)}
        onReset={() => handleReset('A')}
      />
      <Box w="1px" h="100px" bg="border.base" />
      <EQControls
        label="Track B"
        color="#8b5cf6"
        eq={eqB}
        onChange={(band, gain) => handleChange('B', band, gain)}
        onReset={() => handleReset('B')}
      />
    </HStack>
  )
}
