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

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeckChannel {
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  gainNode: GainNode | null
  /** AudioContext.currentTime when playback started */
  contextStartTime: number
  /** Offset into the buffer when playback started */
  bufferOffset: number
  isPlaying: boolean
  /** Duration of the loaded buffer */
  duration: number
}

type DeckId = 'A' | 'B'

type DeckEventType = 'play' | 'stop' | 'loaded' | 'ended'

interface DeckEvent {
  deck: DeckId
  type: DeckEventType
}

type DeckEventListener = (event: DeckEvent) => void

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

    // Create gain
    const gainNode = ctx.createGain()
    gainNode.gain.value = this.masterVolume
    source.connect(gainNode).connect(ctx.destination)

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
    if (channel.gainNode) {
      channel.gainNode.disconnect()
      channel.gainNode = null
    }
    channel.isPlaying = false
  }

  // ── Playhead & state queries ────────────────────────────────────────────

  getDeckTime(deck: DeckId): number {
    const channel = this.decks[deck]
    if (!channel.isPlaying || !this.context) return channel.bufferOffset

    const elapsed = this.context.currentTime - channel.contextStartTime
    return Math.min(channel.bufferOffset + elapsed, channel.duration)
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
      contextStartTime: 0,
      bufferOffset: 0,
      isPlaying: false,
      duration: 0,
    }
  }
}
