import { useRef, useState, useEffect, useCallback } from 'react'
import { WebAudioEngine } from '@/services/WebAudioEngine'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'

type DeckId = 'A' | 'B'

interface DualDeckState {
  /** Whether deck buffers are being loaded */
  isLoading: boolean
  /** Per-deck playback state */
  deckA: { isPlaying: boolean; currentTime: number; duration: number }
  deckB: { isPlaying: boolean; currentTime: number; duration: number }
}

interface DualDeckActions {
  /** Load both decks from file paths */
  loadDecks: (filePathA: string, filePathB: string) => Promise<void>
  /** Play a single deck from optional start time */
  playDeck: (deck: DeckId, startTime?: number) => Promise<void>
  /** Play both decks simultaneously */
  playBoth: (startTimeA?: number, startTimeB?: number) => Promise<void>
  /** Stop a single deck */
  stopDeck: (deck: DeckId) => void
  /** Stop all playback */
  stopAll: () => void
}

export type DualDeckReturn = DualDeckState & DualDeckActions

/**
 * Hook for dual-deck playback in the mix-prep transition view.
 * Uses WebAudioEngine singleton for Web Audio API playback.
 * Provides rAF-driven playhead position updates at ~60fps.
 */
export function useDualDeck(): DualDeckReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [deckAPlaying, setDeckAPlaying] = useState(false)
  const [deckBPlaying, setDeckBPlaying] = useState(false)
  const [deckATime, setDeckATime] = useState(0)
  const [deckBTime, setDeckBTime] = useState(0)
  const [deckADuration, setDeckADuration] = useState(0)
  const [deckBDuration, setDeckBDuration] = useState(0)

  const rafRef = useRef<number>(0)
  const loadedPathsRef = useRef<{ a: string; b: string }>({ a: '', b: '' })

  const engine = WebAudioEngine.getInstance()

  // ── rAF loop for smooth playhead updates ──────────────────────────────

  const updatePlayheads = useCallback(() => {
    const aPlaying = engine.isDeckPlaying('A')
    const bPlaying = engine.isDeckPlaying('B')

    if (aPlaying) setDeckATime(engine.getDeckTime('A'))
    if (bPlaying) setDeckBTime(engine.getDeckTime('B'))

    setDeckAPlaying(aPlaying)
    setDeckBPlaying(bPlaying)

    if (aPlaying || bPlaying) {
      rafRef.current = requestAnimationFrame(updatePlayheads)
    }
  }, [engine])

  const startRaf = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(updatePlayheads)
  }, [updatePlayheads])

  // ── Engine event listener ─────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'play') {
        startRaf()
      }
      if (event.type === 'stop' || event.type === 'ended') {
        // Update state for the stopped deck
        if (event.deck === 'A') {
          setDeckAPlaying(false)
          setDeckATime(engine.getDeckTime('A'))
        } else {
          setDeckBPlaying(false)
          setDeckBTime(engine.getDeckTime('B'))
        }
        // Stop rAF if nothing is playing
        if (!engine.isAnyPlaying()) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    })

    return () => {
      unsubscribe()
      cancelAnimationFrame(rafRef.current)
    }
  }, [engine, startRaf])

  // ── Cleanup on unmount ────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      engine.stopAll()
      cancelAnimationFrame(rafRef.current)
    }
  }, [engine])

  // ── Actions ───────────────────────────────────────────────────────────

  const loadDecks = useCallback(
    async (filePathA: string, filePathB: string) => {
      // Skip if same files already loaded
      if (
        loadedPathsRef.current.a === filePathA &&
        loadedPathsRef.current.b === filePathB
      ) {
        return
      }

      engine.stopAll()
      setIsLoading(true)

      try {
        await Promise.all([
          engine.loadDeck('A', filePathA),
          engine.loadDeck('B', filePathB),
        ])
        loadedPathsRef.current = { a: filePathA, b: filePathB }
        setDeckADuration(engine.getDeckDuration('A'))
        setDeckBDuration(engine.getDeckDuration('B'))
        setDeckATime(0)
        setDeckBTime(0)
      } catch (err) {
        console.error('[useDualDeck] Failed to load decks:', err)
        loadedPathsRef.current = { a: '', b: '' }
      } finally {
        setIsLoading(false)
      }
    },
    [engine]
  )

  const playDeck = useCallback(
    async (deck: DeckId, startTime = 0) => {
      // Pause main audio player to avoid overlap
      useAudioPlayerStore.getState().pause()
      await engine.playDeck(deck, startTime)
    },
    [engine]
  )

  const playBoth = useCallback(
    async (startTimeA = 0, startTimeB = 0) => {
      useAudioPlayerStore.getState().pause()
      await engine.playBoth(startTimeA, startTimeB)
    },
    [engine]
  )

  const stopDeck = useCallback(
    (deck: DeckId) => {
      engine.stopDeck(deck)
    },
    [engine]
  )

  const stopAll = useCallback(() => {
    engine.stopAll()
  }, [engine])

  return {
    isLoading,
    deckA: {
      isPlaying: deckAPlaying,
      currentTime: deckATime,
      duration: deckADuration,
    },
    deckB: {
      isPlaying: deckBPlaying,
      currentTime: deckBTime,
      duration: deckBDuration,
    },
    loadDecks,
    playDeck,
    playBoth,
    stopDeck,
    stopAll,
  }
}
