/**
 * WebAudioEngine — singleton service for Web Audio API playback.
 *
 * Manages an AudioContext, decodes files via the custom audio:// protocol,
 * and provides dual-deck playback for the mix-prep transition view.
 *
 * Usage:
 *   const engine = WebAudioEngine.getInstance()
 *   await engine.loadDeck('A', '/path/to/track.flac')
 *   engine.playDeck('A')
 */

import type { CrossfadeCurveType } from '@shared/types/project.types'
import { generateFadeInCurve, generateFadeOutCurve } from './audioCurves'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeckChannel {
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  gainNode: GainNode | null
  /** 3-band EQ filter nodes (transient, created per playback) */
  eqLow: BiquadFilterNode | null
  eqMid: BiquadFilterNode | null
  eqHigh: BiquadFilterNode | null
  /** AudioContext.currentTime when playback started */
  contextStartTime: number
  /** Offset into the buffer when playback started */
  bufferOffset: number
  isPlaying: boolean
  /** Duration of the loaded buffer */
  duration: number
  /** Playback rate (1.0 = normal speed) */
  playbackRate: number
  /** Persisted EQ gain values (dB), survive stop/start cycles */
  eqGains: { low: number; mid: number; high: number }
}

type EQBand = 'low' | 'mid' | 'high'

export interface DeckEQState {
  low: number
  mid: number
  high: number
}

/** EQ band configuration */
const EQ_CONFIG = {
  low: { type: 'lowshelf' as BiquadFilterType, frequency: 250, Q: 0.7 },
  mid: { type: 'peaking' as BiquadFilterType, frequency: 1000, Q: 1.0 },
  high: { type: 'highshelf' as BiquadFilterType, frequency: 4000, Q: 0.7 },
} as const

/** EQ gain range in dB */
const EQ_MIN_DB = -12
const EQ_MAX_DB = 12

type DeckId = 'A' | 'B'

type DeckEventType = 'play' | 'stop' | 'loaded' | 'ended'

interface DeckEvent {
  deck: DeckId
  type: DeckEventType
}

type DeckEventListener = (event: DeckEvent) => void

export interface CrossfadeScheduleOptions {
  crossfadeDuration: number
  curveType: CrossfadeCurveType
  leadSeconds?: number
  deckAStartOffset: number
  deckBStartOffset: number
}

export interface CrossfadePlaybackInfo {
  /** AudioContext.currentTime when playback started */
  startTime: number
  /** Buffer offset for deck A */
  deckAOffset: number
  /** Buffer offset for deck B */
  deckBOffset: number
  /** Seconds from start until crossfade begins (and B starts) */
  fadeStartDelay: number
  /** Total preview duration */
  totalDuration: number
}

/** Number of gain curve samples for setValueCurveAtTime */
const CURVE_SAMPLES = 128

// ─── Engine ─────────────────────────────────────────────────────────────────

export class WebAudioEngine {
  private static instance: WebAudioEngine | null = null

  private context: AudioContext | null = null
  private bufferCache = new Map<string, AudioBuffer>()
  private decks: Record<DeckId, DeckChannel> = {
    A: this.createEmptyChannel(),
    B: this.createEmptyChannel(),
  }
  private masterVolume = 0.7
  private listeners = new Set<DeckEventListener>()

  private constructor() {
    // Private — use getInstance()
  }

  static getInstance(): WebAudioEngine {
    if (!WebAudioEngine.instance) {
      WebAudioEngine.instance = new WebAudioEngine()
    }
    return WebAudioEngine.instance
  }

  // ── AudioContext management ─────────────────────────────────────────────

  private getContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext()
    }
    return this.context
  }

  private async ensureContextResumed(): Promise<AudioContext> {
    const ctx = this.getContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    return ctx
  }

  // ── Buffer loading ──────────────────────────────────────────────────────

  async loadFile(filePath: string): Promise<AudioBuffer> {
    // Check cache first
    const cached = this.bufferCache.get(filePath)
    if (cached) return cached

    const ctx = await this.ensureContextResumed()
    const url = `audio://play?path=${encodeURIComponent(filePath)}`

    console.log('[WebAudioEngine] Loading:', filePath)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio: ${response.status} ${response.statusText}`
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    console.log(
      '[WebAudioEngine] Decoding:',
      filePath,
      `(${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`
    )
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    console.log(
      '[WebAudioEngine] Loaded:',
      filePath,
      `(${audioBuffer.duration.toFixed(1)}s)`
    )

    this.bufferCache.set(filePath, audioBuffer)
    return audioBuffer
  }

  // ── Deck operations ─────────────────────────────────────────────────────

  async loadDeck(deck: DeckId, filePath: string): Promise<void> {
    // Stop current playback on this deck
    this.stopDeck(deck)

    const buffer = await this.loadFile(filePath)
    this.decks[deck].buffer = buffer
    this.decks[deck].duration = buffer.duration
    this.emit({ deck, type: 'loaded' })
  }

  async playDeck(deck: DeckId, startTime = 0): Promise<void> {
    const channel = this.decks[deck]
    if (!channel.buffer) return

    // Stop if already playing
    this.stopDeckInternal(deck)

    // Resume suspended context (browser autoplay policy)
    const ctx = await this.ensureContextResumed()

    // Create source
    const source = ctx.createBufferSource()
    source.buffer = channel.buffer
    source.playbackRate.value = channel.playbackRate

    // Create gain
    const gainNode = ctx.createGain()
    gainNode.gain.value = this.masterVolume

    // Create EQ chain: source → eqLow → eqMid → eqHigh → gainNode → destination
    const { eqLow, eqMid, eqHigh } = this.createEQChain(ctx, channel.eqGains)
    source
      .connect(eqLow)
      .connect(eqMid)
      .connect(eqHigh)
      .connect(gainNode)
      .connect(ctx.destination)

    // Handle natural end
    source.onended = () => {
      if (channel.source === source) {
        channel.isPlaying = false
        channel.source = null
        this.emit({ deck, type: 'ended' })
      }
    }

    // Start
    const offset = Math.max(0, Math.min(startTime, channel.buffer.duration))
    source.start(0, offset)

    channel.source = source
    channel.gainNode = gainNode
    channel.eqLow = eqLow
    channel.eqMid = eqMid
    channel.eqHigh = eqHigh
    channel.contextStartTime = ctx.currentTime
    channel.bufferOffset = offset
    channel.isPlaying = true

    this.emit({ deck, type: 'play' })
  }

  async playBoth(startTimeA = 0, startTimeB = 0): Promise<void> {
    // Resume context once, then play both
    await this.ensureContextResumed()
    await this.playDeck('A', startTimeA)
    await this.playDeck('B', startTimeB)
  }

  stopDeck(deck: DeckId): void {
    this.stopDeckInternal(deck)
    this.emit({ deck, type: 'stop' })
  }

  stopAll(): void {
    this.stopDeckInternal('A')
    this.stopDeckInternal('B')
    this.emit({ deck: 'A', type: 'stop' })
    this.emit({ deck: 'B', type: 'stop' })
  }

  private stopDeckInternal(deck: DeckId): void {
    const channel = this.decks[deck]
    if (channel.source) {
      try {
        channel.source.stop()
      } catch {
        /* already stopped */
      }
      channel.source.disconnect()
      channel.source = null
    }
    if (channel.eqLow) {
      channel.eqLow.disconnect()
      channel.eqLow = null
    }
    if (channel.eqMid) {
      channel.eqMid.disconnect()
      channel.eqMid = null
    }
    if (channel.eqHigh) {
      channel.eqHigh.disconnect()
      channel.eqHigh = null
    }
    if (channel.gainNode) {
      channel.gainNode.disconnect()
      channel.gainNode = null
    }
    channel.isPlaying = false
  }

  // ── Playback rate ──────────────────────────────────────────────────────

  setDeckPlaybackRate(deck: DeckId, rate: number): void {
    const channel = this.decks[deck]
    channel.playbackRate = Math.max(0.5, Math.min(2.0, rate))
    // Apply to live source if playing
    if (channel.source) {
      channel.source.playbackRate.value = channel.playbackRate
    }
  }

  getDeckPlaybackRate(deck: DeckId): number {
    return this.decks[deck].playbackRate
  }

  // ── Playhead & state queries ────────────────────────────────────────────

  getDeckTime(deck: DeckId): number {
    const channel = this.decks[deck]
    if (!channel.isPlaying || !this.context) return channel.bufferOffset

    // Clamp to 0 — elapsed can be negative for scheduled-start sources
    const elapsed = Math.max(
      0,
      this.context.currentTime - channel.contextStartTime
    )
    // Account for playback rate: audio advances faster/slower
    return Math.min(
      channel.bufferOffset + elapsed * channel.playbackRate,
      channel.duration
    )
  }

  getDeckDuration(deck: DeckId): number {
    return this.decks[deck].duration
  }

  isDeckPlaying(deck: DeckId): boolean {
    return this.decks[deck].isPlaying
  }

  isDeckLoaded(deck: DeckId): boolean {
    return this.decks[deck].buffer !== null
  }

  isAnyPlaying(): boolean {
    return this.decks.A.isPlaying || this.decks.B.isPlaying
  }

  /** Current AudioContext time (seconds). Returns 0 if no context exists. */
  getContextTime(): number {
    return this.context?.currentTime ?? 0
  }

  // ── Crossfade scheduling ──────────────────────────────────────────────

  /**
   * Schedule a crossfade preview between deck A and deck B.
   * Both decks must already have buffers loaded via loadDeck().
   * Returns timing info for playhead tracking in the UI layer.
   */
  scheduleCrossfade(options: CrossfadeScheduleOptions): CrossfadePlaybackInfo {
    const {
      crossfadeDuration,
      curveType,
      leadSeconds = 5,
      deckAStartOffset,
      deckBStartOffset,
    } = options

    const deckA = this.decks.A
    const deckB = this.decks.B
    if (!deckA.buffer || !deckB.buffer) {
      throw new Error(
        '[WebAudioEngine] Both decks must be loaded before scheduling crossfade'
      )
    }

    // Stop any existing playback
    this.stopDeckInternal('A')
    this.stopDeckInternal('B')

    const ctx = this.getContext()
    const now = ctx.currentTime

    // Compute timing
    const aOffset = deckAStartOffset
    const bOffset = deckBStartOffset
    const fadeStartDelay = leadSeconds
    const aDuration = fadeStartDelay + crossfadeDuration
    const bDuration = crossfadeDuration + leadSeconds

    // ── Deck A: source → EQ → gain → destination ──
    const sourceA = ctx.createBufferSource()
    sourceA.buffer = deckA.buffer
    sourceA.playbackRate.value = deckA.playbackRate
    const gainA = ctx.createGain()
    gainA.gain.value = this.masterVolume
    const eqA = this.createEQChain(ctx, deckA.eqGains)
    sourceA
      .connect(eqA.eqLow)
      .connect(eqA.eqMid)
      .connect(eqA.eqHigh)
      .connect(gainA)
      .connect(ctx.destination)

    // Schedule fade-out on A
    const fadeOut = generateFadeOutCurve(curveType, CURVE_SAMPLES)
    for (let i = 0; i < fadeOut.length; i++) fadeOut[i] *= this.masterVolume
    gainA.gain.setValueCurveAtTime(
      fadeOut,
      now + fadeStartDelay,
      crossfadeDuration
    )

    // ── Deck B: source → EQ → gain → destination ──
    const sourceB = ctx.createBufferSource()
    sourceB.buffer = deckB.buffer
    sourceB.playbackRate.value = deckB.playbackRate
    const gainB = ctx.createGain()
    gainB.gain.value = 0
    const eqB = this.createEQChain(ctx, deckB.eqGains)
    sourceB
      .connect(eqB.eqLow)
      .connect(eqB.eqMid)
      .connect(eqB.eqHigh)
      .connect(gainB)
      .connect(ctx.destination)

    // Schedule fade-in on B
    const fadeIn = generateFadeInCurve(curveType, CURVE_SAMPLES)
    for (let i = 0; i < fadeIn.length; i++) fadeIn[i] *= this.masterVolume
    gainB.gain.setValueCurveAtTime(
      fadeIn,
      now + fadeStartDelay,
      crossfadeDuration
    )

    // ── Start sources ──
    sourceA.start(now, aOffset, aDuration)
    sourceB.start(now + fadeStartDelay, bOffset, bDuration)

    // ── Update deck channel state ──
    deckA.source = sourceA
    deckA.gainNode = gainA
    deckA.eqLow = eqA.eqLow
    deckA.eqMid = eqA.eqMid
    deckA.eqHigh = eqA.eqHigh
    deckA.contextStartTime = now
    deckA.bufferOffset = aOffset
    deckA.isPlaying = true

    deckB.source = sourceB
    deckB.gainNode = gainB
    deckB.eqLow = eqB.eqLow
    deckB.eqMid = eqB.eqMid
    deckB.eqHigh = eqB.eqHigh
    deckB.contextStartTime = now + fadeStartDelay
    deckB.bufferOffset = bOffset
    deckB.isPlaying = true

    // ── Auto-stop on end ──
    const totalDuration = fadeStartDelay + crossfadeDuration + leadSeconds

    sourceA.onended = () => {
      if (deckA.source === sourceA) {
        deckA.isPlaying = false
        deckA.source = null
        this.emit({ deck: 'A', type: 'ended' })
      }
    }

    sourceB.onended = () => {
      if (deckB.source === sourceB) {
        deckB.isPlaying = false
        deckB.source = null
        this.emit({ deck: 'B', type: 'ended' })
      }
    }

    this.emit({ deck: 'A', type: 'play' })
    this.emit({ deck: 'B', type: 'play' })

    return {
      startTime: now,
      deckAOffset: aOffset,
      deckBOffset: bOffset,
      fadeStartDelay,
      totalDuration,
    }
  }

  // ── Volume ──────────────────────────────────────────────────────────────

  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    // Update live gain nodes
    for (const deck of ['A', 'B'] as DeckId[]) {
      const channel = this.decks[deck]
      if (channel.gainNode) {
        channel.gainNode.gain.value = this.masterVolume
      }
    }
  }

  getVolume(): number {
    return this.masterVolume
  }

  // ── Event system ────────────────────────────────────────────────────────

  addEventListener(listener: DeckEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: DeckEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[WebAudioEngine] Listener error:', err)
      }
    }
  }

  // ── EQ ──────────────────────────────────────────────────────────────────

  /**
   * Set EQ gain for a specific band on a deck.
   * Value persists across stop/start cycles. Applied in real-time if playing.
   */
  setDeckEQ(deck: DeckId, band: EQBand, gainDb: number): void {
    const clamped = Math.max(EQ_MIN_DB, Math.min(EQ_MAX_DB, gainDb))
    const channel = this.decks[deck]
    channel.eqGains[band] = clamped

    // Apply to live filter node if playing
    const filterNode =
      band === 'low'
        ? channel.eqLow
        : band === 'mid'
          ? channel.eqMid
          : channel.eqHigh
    if (filterNode) {
      filterNode.gain.value = clamped
    }
  }

  getDeckEQ(deck: DeckId): DeckEQState {
    return { ...this.decks[deck].eqGains }
  }

  resetDeckEQ(deck: DeckId): void {
    this.setDeckEQ(deck, 'low', 0)
    this.setDeckEQ(deck, 'mid', 0)
    this.setDeckEQ(deck, 'high', 0)
  }

  /** Create a 3-band EQ filter chain for a given AudioContext. */
  private createEQChain(
    ctx: AudioContext,
    gains: { low: number; mid: number; high: number }
  ): {
    eqLow: BiquadFilterNode
    eqMid: BiquadFilterNode
    eqHigh: BiquadFilterNode
  } {
    const eqLow = ctx.createBiquadFilter()
    eqLow.type = EQ_CONFIG.low.type
    eqLow.frequency.value = EQ_CONFIG.low.frequency
    eqLow.gain.value = gains.low

    const eqMid = ctx.createBiquadFilter()
    eqMid.type = EQ_CONFIG.mid.type
    eqMid.frequency.value = EQ_CONFIG.mid.frequency
    eqMid.Q.value = EQ_CONFIG.mid.Q
    eqMid.gain.value = gains.mid

    const eqHigh = ctx.createBiquadFilter()
    eqHigh.type = EQ_CONFIG.high.type
    eqHigh.frequency.value = EQ_CONFIG.high.frequency
    eqHigh.gain.value = gains.high

    return { eqLow, eqMid, eqHigh }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  clearCache(): void {
    this.bufferCache.clear()
  }

  dispose(): void {
    this.stopAll()
    this.clearCache()
    this.listeners.clear()
    if (this.context && this.context.state !== 'closed') {
      this.context.close()
    }
    this.context = null
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private createEmptyChannel(): DeckChannel {
    return {
      buffer: null,
      source: null,
      gainNode: null,
      eqLow: null,
      eqMid: null,
      eqHigh: null,
      contextStartTime: 0,
      bufferOffset: 0,
      isPlaying: false,
      duration: 0,
      playbackRate: 1.0,
      eqGains: { low: 0, mid: 0, high: 0 },
    }
  }
}
