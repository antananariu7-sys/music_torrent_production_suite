# Mix Preparation View v2 — Advanced Features Plan (Draft)

**Date:** 2026-02-26
**Status:** Draft
**Feature spec:** [docs/features/mix-preparation-v2.md](../mix-preparation-v2.md)
**Prerequisite plan:** [mix-preparation-v2-plan.md](mix-preparation-v2-plan.md) (Phases 1–5 must be complete)

---

## Scope

This plan covers the higher-effort v2 features deferred from the main v2 plan: Audio System Unification, Auto Section Detection, EQ & Effects Preview, Advanced Mix-Point Detection, Beat-Sync Export, Volume Automation, Waveform Editing, and Collaborative Sharing.

Phases are ordered by dependency chain, not priority alone.

---

## Decisions (Pending)

| Question                  | Options                                                          | Leaning                                                                     |
| ------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Time-stretch library      | SoundTouch.js (JS, proven) vs Rubber Band (WASM, higher quality) | SoundTouch.js — simpler integration, acceptable quality for DJ use          |
| Undo/redo approach        | `zundo` (Zustand temporal) vs custom history stack               | `zundo` — aligns with Zustand stack, minimal code                           |
| Section detection compute | Main process (Essentia.js) vs renderer (Web Audio AnalyserNode)  | Main process — reuse existing Essentia.js WASM, matches KeyDetector pattern |
| EQ persistence            | Persist EQ per transition vs preview-only                        | Preview-only initially — export uses FFmpeg filters separately if needed    |
| Collaborative sharing     | JSON export only vs full CRDT real-time                          | JSON export only for v2 — CRDT is v3+ scope                                 |

---

## Phase 6 — Audio System Unification

**Goal:** Merge `useCrossfadePreview` into `WebAudioEngine` so there is one `AudioContext` for all playback. Required before EQ (Phase 8).

**Problem:** Two independent `AudioContext` instances (`WebAudioEngine` singleton + `useCrossfadePreview` hook-scoped). Chrome limits AudioContexts and they compete for resources.

### Changes to existing files

| File                                        | Change                                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/renderer/services/WebAudioEngine.ts`   | Add `scheduleCrossfade(options)` method using the existing AudioContext and deck buffers             |
| `src/renderer/hooks/useCrossfadePreview.ts` | Rewrite to delegate to `WebAudioEngine.scheduleCrossfade()` instead of managing its own AudioContext |

### Step-by-step

#### 6a. Add crossfade scheduling to WebAudioEngine

Move the curve generation and gain scheduling logic from `useCrossfadePreview` into the engine:

```typescript
// New exports on WebAudioEngine
interface CrossfadeScheduleOptions {
  crossfadeDuration: number
  curveType: CrossfadeCurveType
  leadSeconds?: number          // Default 5s
  deckAStartOffset: number      // Where in track A to begin (e.g., trimEnd - crossfade - lead)
  deckBStartOffset: number      // Where in track B to begin (e.g., trimStart)
}

scheduleCrossfade(options: CrossfadeScheduleOptions): void
```

Implementation:

1. Reuse existing `generateFadeOutCurve` / `generateFadeInCurve` (move from `useCrossfadePreview.ts` to `WebAudioEngine.ts` or a shared `audioCurves.ts` utility)
2. Create two source nodes from deck A/B buffers
3. Schedule gain automation via `setValueCurveAtTime()` on each deck's GainNode
4. Schedule `source.start()` with computed offsets and durations
5. Auto-stop via `source.onended` on deck B

#### 6b. Simplify useCrossfadePreview

Rewrite to ~50 lines: just a thin wrapper that calls `WebAudioEngine.getInstance().scheduleCrossfade()` and tracks `isPlaying`/`isLoading` state.

```typescript
export function useCrossfadePreview(options: CrossfadePreviewOptions | null) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const play = useCallback(async () => {
    if (!options) return
    setIsLoading(true)
    const engine = WebAudioEngine.getInstance()
    await engine.loadDeck('A', options.trackA.filePath)
    await engine.loadDeck('B', options.trackB.filePath)
    setIsLoading(false)
    engine.scheduleCrossfade({ ... })
    setIsPlaying(true)
  }, [options])

  const stop = useCallback(() => {
    WebAudioEngine.getInstance().stopAll()
    setIsPlaying(false)
  }, [])

  return { isPlaying, isLoading, play, stop }
}
```

#### 6c. Extract shared curve utilities

Create `src/renderer/services/audioCurves.ts`:

```typescript
export function generateFadeOutCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array
export function generateFadeInCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array
```

Move from `useCrossfadePreview.ts`. Both `WebAudioEngine` and future volume automation will import from here.

### Acceptance criteria

- [ ] Only one `AudioContext` exists across the entire app
- [ ] Crossfade preview plays via `WebAudioEngine`
- [ ] `useCrossfadePreview` is a thin wrapper (~50 lines)
- [ ] Curve generators extracted to shared utility
- [ ] All existing crossfade preview functionality preserved (lead-in/out, curve types, auto-stop)
- [ ] No regression in dual-deck playback (Play A / Play B / Play Both)

### Code size note

`WebAudioEngine.ts` is currently **318 lines**. Phases 6, 8, and 11 all add methods to it:

- Phase 6: `scheduleCrossfade()` (~60–80 lines)
- Phase 8: EQ nodes + `setDeckEQ()`/`getDeckEQ()`/`resetDeckEQ()` (~80–100 lines)
- Phase 11: `scheduleVolumeEnvelope()` (~30–40 lines)

**Projected: ~490–530 lines** — at the critical threshold (>500). To prevent this:

- Phase 6c already extracts curve utilities to `audioCurves.ts` (good).
- Phase 8 should extract EQ filter management into a `DeckEQManager` class (~100 lines) in `src/renderer/services/DeckEQManager.ts`. `WebAudioEngine` delegates to it, keeping the engine under 400 lines.
- Alternative: extract the crossfade scheduling into a `CrossfadeScheduler` class if EQ extraction alone isn't enough.

---

## Phase 7 — Auto Section Detection & Labels

**Goal:** Detect track sections (intro, buildup, drop, breakdown, outro) via Essentia.js and render as colored bands on waveforms.

### Prerequisites

- Essentia.js WASM already loaded in main process (`KeyDetector.ts`)

### New files

| File                                                         | Purpose                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/SectionDetector.ts`              | Main process service: extract spectral features, detect section boundaries, classify sections |
| `src/main/ipc/sectionHandlers.ts`                            | IPC handlers: `section:detect`, `section:detect-batch`, `section:progress`                    |
| `src/shared/types/sectionDetection.types.ts`                 | Types: `TrackSection`, `SectionDetectionRequest`, `SectionDetectionResponse`                  |
| `src/shared/schemas/sectionDetection.schema.ts`              | Zod validation schemas                                                                        |
| `src/renderer/components/features/mix-prep/SectionBands.tsx` | Canvas overlay rendering colored section bands behind waveform                                |
| `src/renderer/components/features/timeline/SectionBands.tsx` | Timeline version of section bands (reuses same rendering logic)                               |
| `src/renderer/hooks/useSectionData.ts`                       | Hook: triggers section detection, tracks progress                                             |

### Changes to existing files

| File                                                                    | Change                                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts`                                     | Add `sections?: TrackSection[]` to `Song` interface                                                 |
| `src/shared/constants.ts`                                               | Add `SECTION_DETECT`, `SECTION_DETECT_BATCH`, `SECTION_PROGRESS` IPC channels                       |
| `src/main/ipc/index.ts`                                                 | Register section handlers                                                                           |
| `src/preload/api/section.ts`                                            | New preload module: `api.section.detect()`, `api.section.detectBatch()`, `api.section.onProgress()` |
| `src/preload/index.ts`                                                  | Register section preload API                                                                        |
| `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` | Add `SectionBands` overlay when `song.sections` available                                           |

### Step-by-step

#### 7a. SectionDetector service

Follow `KeyDetector.ts` pattern exactly (348 lines, same Essentia.js instance):

```typescript
class SectionDetector {
  private essentiaInstance: Essentia | null = null

  async detectSections(
    filePath: string,
    options: {
      bpm?: number
      firstBeatOffset?: number
    }
  ): Promise<TrackSection[]> {
    // 1. Extract PCM (reuse KeyDetector's FFmpeg PCM extraction)
    // 2. Compute chromagram (HPCP) via essentia.HPCP()
    // 3. Compute MFCC via essentia.MFCC()
    // 4. Build self-similarity matrix from MFCC frames
    // 5. Detect novelty peaks (high dissimilarity = section boundary)
    // 6. Classify sections by energy + spectral characteristics
    // 7. Snap boundaries to beat grid if BPM available
  }
}
```

**Novelty function algorithm:**

1. Compute MFCC features per frame (hop size ~0.5s, 13 coefficients)
2. Build self-similarity matrix: `S[i][j] = cosine_similarity(mfcc[i], mfcc[j])`
3. Compute novelty curve: checkerboard kernel convolution along diagonal
4. Peak-pick novelty curve (minimum peak distance: 8 bars if BPM known, else 10s)
5. Boundaries = novelty peaks

**Section classification heuristics:**

- Compute mean energy per segment from peaks/energy profile
- First segment → `intro` (if energy < 0.4)
- Segment with highest energy → `drop`
- Segment before drop with rising energy → `buildup`
- Segment after drop with sudden energy dip → `breakdown`
- Last segment → `outro` (if energy < 0.4)
- Everything else → `custom` (user can relabel)

**Confidence scoring:**

- Based on novelty peak prominence (peak height / average novelty)
- High prominence → high confidence boundaries

#### 7b. Section data model

```typescript
interface TrackSection {
  id: string
  type: 'intro' | 'buildup' | 'drop' | 'breakdown' | 'outro' | 'custom'
  startTime: number
  endTime: number
  label?: string // User override
  confidence: number // 0–1
}
```

#### 7c. SectionBands component

Canvas overlay drawn behind waveform:

```typescript
interface SectionBandsProps {
  sections: TrackSection[]
  duration: number
  width: number
  height: number
}
```

Rendering:

- Each section: `x = (startTime / duration) * width`, `w = ((endTime - startTime) / duration) * width`
- Colors: intro=#6366f1 (indigo), buildup=#f59e0b (amber), drop=#ef4444 (red), breakdown=#8b5cf6 (violet), outro=#06b6d4 (cyan), custom=#6b7280 (gray) — all at 15% opacity
- Label text centered in each band (skip if band < 40px wide)
- Positioned via `position: absolute; pointerEvents: none;` over waveform canvas

#### 7d. Manual correction (drag boundaries, rename)

Deferred to a sub-phase. Initially sections are read-only analysis results. Manual editing adds complexity (drag handles, context menu) that can come later.

### IPC channels

| Channel                | Direction | Payload                                                   | Response                                   |
| ---------------------- | --------- | --------------------------------------------------------- | ------------------------------------------ |
| `section:detect`       | R → M     | `{ projectId, songId, filePath, bpm?, firstBeatOffset? }` | `{ sections: TrackSection[] }`             |
| `section:detect-batch` | R → M     | `{ projectId }`                                           | `{ results: Map<songId, TrackSection[]> }` |
| `section:progress`     | M → R     | `{ songId, current, total }`                              | — (push)                                   |

### Cache strategy

Same as KeyDetector:

- Disk cache: `<projectDir>/assets/waveforms/<songId>.sections.json`
- Cache key: file hash (`size-mtimeMs`)
- Persisted to `Song.sections` via `updateSong` IPC

### Acceptance criteria

- [ ] Essentia.js chromagram + MFCC extraction works in main process
- [ ] Section boundaries detected via novelty function
- [ ] Sections classified by energy heuristics
- [ ] Sections persisted to Song in project.json
- [ ] Colored section bands visible on mix-prep waveforms
- [ ] Batch detection with progress reporting
- [ ] Disk caching with hash invalidation
- [ ] Graceful fallback when detection fails or produces low-confidence results

### Code size note

`TransitionWaveformPanel.tsx` is currently **371 lines** (approaching the 400-line warning zone). Phase 7 adds a `SectionBands` overlay and Phase 11 adds `VolumeEnvelopeEditor`. While these are separate components, the conditional rendering + props threading will push this file further. If it exceeds 400 lines during Phase 7, extract the trim/cue-point overlay logic into a `TrackAnnotationOverlays` component.

---

## Phase 8 — EQ & Effects Preview

**Goal:** Add 3-band EQ per deck for preview during transitions.

### Prerequisites

- Phase 6 (Audio System Unification) — single AudioContext

### Changes to existing files

| File                                      | Change                                                             |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/renderer/services/WebAudioEngine.ts` | Add `BiquadFilterNode` chain per deck, expose `setDeckEQ()` method |

### New files

| File                                                              | Purpose                               |
| ----------------------------------------------------------------- | ------------------------------------- |
| `src/renderer/components/features/mix-prep/EQControls.tsx`        | 3-band EQ sliders for one deck        |
| `src/renderer/components/features/mix-prep/TransitionEQPanel.tsx` | Side-by-side EQ panels for both decks |

### Step-by-step

#### 8a. Add EQ nodes to WebAudioEngine

Modify audio graph per deck:

```
BufferSourceNode → LowShelf → Peaking (Mid) → HighShelf → GainNode → destination
```

```typescript
interface DeckChannel {
  // ... existing fields ...
  eqLow: BiquadFilterNode | null
  eqMid: BiquadFilterNode | null
  eqHigh: BiquadFilterNode | null
}

// EQ band configuration
const EQ_BANDS = {
  low:  { type: 'lowshelf',  frequency: 250,  Q: 0.7 },
  mid:  { type: 'peaking',   frequency: 1000, Q: 1.0 },
  high: { type: 'highshelf', frequency: 4000, Q: 0.7 },
}

// New methods
setDeckEQ(deck: 'A' | 'B', band: 'low' | 'mid' | 'high', gainDb: number): void
getDeckEQ(deck: 'A' | 'B'): { low: number; mid: number; high: number }
resetDeckEQ(deck: 'A' | 'B'): void
```

Create filter nodes when deck loads (after `decodeAudioData`), reconnect graph:

```typescript
// In loadDeck(), after creating gainNode:
const eqLow = ctx.createBiquadFilter()
eqLow.type = 'lowshelf'
eqLow.frequency.value = 250
eqLow.gain.value = 0
const eqMid = ctx.createBiquadFilter()
eqMid.type = 'peaking'
eqMid.frequency.value = 1000
eqMid.Q.value = 1.0
eqMid.gain.value = 0
const eqHigh = ctx.createBiquadFilter()
eqHigh.type = 'highshelf'
eqHigh.frequency.value = 4000
eqHigh.gain.value = 0

// Connect chain:
source
  .connect(eqLow)
  .connect(eqMid)
  .connect(eqHigh)
  .connect(gainNode)
  .connect(ctx.destination)
```

EQ gain range: -12dB to +12dB (clamped).

#### 8b. EQControls component

```typescript
interface EQControlsProps {
  deck: 'A' | 'B'
  label: string // "Track A" / "Track B"
  color: string // Blue / Purple
  eq: { low: number; mid: number; high: number }
  onChange: (band: 'low' | 'mid' | 'high', gainDb: number) => void
  onReset: () => void
}
```

Layout: three vertical Chakra `Slider` components (oriented vertically):

```
┌─ EQ: Track A ─┐
│  Lo   Mid   Hi │
│  ┃     ┃     ┃ │
│  ┃     ●     ┃ │
│  ●     ┃     ┃ │
│  ┃     ┃     ● │
│  ┃     ┃     ┃ │
│     [Reset]    │
└────────────────┘
```

Each slider: min=-12, max=12, step=0.5, default=0. Labels show current dB value.

#### 8c. TransitionEQPanel component

Side-by-side wrapper:

```typescript
interface TransitionEQPanelProps {
  dualDeck: DualDeckReturn
}
```

Renders two `EQControls` in an `HStack`. Calls `dualDeck.setDeckEQ(deck, band, gain)` on change. Collapsible (hidden by default, toggle via button in `TransitionDetail`).

#### 8d. Integrate into TransitionDetail

Add EQ toggle button near DualDeckControls:

```tsx
const [showEQ, setShowEQ] = useState(false)

// In JSX:
<Button size="2xs" variant={showEQ ? 'solid' : 'outline'}
  onClick={() => setShowEQ(prev => !prev)}>
  EQ
</Button>
{showEQ && <TransitionEQPanel dualDeck={dualDeck} />}
```

### Acceptance criteria

- [ ] 3-band EQ per deck (low shelf, mid peak, high shelf)
- [ ] EQ gain range: -12dB to +12dB
- [ ] Changes audible in real-time during dual-deck playback
- [ ] Reset button zeroes all bands
- [ ] EQ panel collapsible (hidden by default)
- [ ] No EQ persistence (preview-only for now)
- [ ] No regression in existing playback

---

## Phase 9 — Advanced Mix-Point Detection

**Goal:** Upgrade `MixPointSuggester` with phrase-aware suggestions, key-aware scoring, and user preference learning.

### Prerequisites

- Phase 7 (Section Detection) — for phrase boundaries
- v2 Phase 5 (Mix Health Dashboard) — for global energy arc data

### Changes to existing files

| File                                                             | Change                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/MixPointSuggester.ts` | Extend algorithm with phrase detection, key scoring, learning weights |
| `src/main/services/ConfigService.ts`                             | Add mix-point preference storage                                      |

### New files

| File                                                                   | Purpose                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/shared/utils/phraseDetector.ts`                                   | Pure function: detect phrase boundaries from beat grid + energy   |
| `src/renderer/components/features/mix-prep/MixPointSuggestionCard.tsx` | Rich suggestion UI showing reasoning breakdown with accept/reject |

### Step-by-step

#### 9a. Phrase detection utility

```typescript
interface PhraseBoundary {
  time: number
  barNumber: number
  strength: number // 0–1, how strong the boundary is
  type: 'phrase-4' | 'phrase-8' | 'phrase-16' | 'phrase-32'
}

function detectPhrases(options: {
  bpm: number
  firstBeatOffset: number
  duration: number
  energyProfile: number[]
  sections?: TrackSection[]
}): PhraseBoundary[]
```

Algorithm:

1. Compute beat grid: `beatTimes = [firstBeatOffset, firstBeatOffset + 60/bpm, ...]`
2. Group into bars (4 beats per bar for 4/4 time)
3. Mark phrase boundaries at bar multiples: every 4, 8, 16, 32 bars
4. Score boundaries by energy change at that point (stronger energy change = stronger boundary)
5. If sections available, boost boundaries that align with section boundaries

#### 9b. Enhanced MixPointSuggester

Extend the existing 115-line `suggestMixPoint()` with new scoring dimensions:

```typescript
interface EnhancedMixPointSuggestion extends MixPointSuggestion {
  phraseAligned: boolean
  keyScore: number // 0–1 based on Camelot compatibility
  energyScore: number // 0–1 from existing energy analysis
  phraseScore: number // 0–1 based on boundary alignment
  breakdown: string[] // Detailed reasoning per factor
}

function suggestMixPoint(
  outgoing: TrackInfo,
  incoming: TrackInfo,
  options?: {
    weights?: MixPointWeights // User preference weights
    outSections?: TrackSection[]
    inSections?: TrackSection[]
  }
): EnhancedMixPointSuggestion
```

Scoring:

- **Energy score** (existing): quality of energy drop/rise curves
- **Phrase score** (new): `1.0` if crossfade starts on a 16/32 bar boundary, `0.7` for 8-bar, `0.5` for 4-bar, `0.2` otherwise
- **Key score** (new): `1.0` if Camelot compatible, `0.5` if same key, `0.2` if incompatible
- **Overall**: `energyScore * weights.energy + phraseScore * weights.phrase + keyScore * weights.key`

Default weights: `{ energy: 0.5, phrase: 0.35, key: 0.15 }`

#### 9c. User preference learning

Track accept/reject on suggestions via `ConfigService`:

```typescript
// When user accepts suggestion:
ConfigService.setSetting(`mixpoint-accepts:${projectId}`, {
  totalAccepted: N,
  totalRejected: M,
  avgAcceptedDuration: X, // Running average of accepted crossfade durations
  preferredPhraseLength: 16, // Most commonly accepted phrase alignment
})
```

Adjust weights over time:

- If user frequently adjusts crossfade duration after accepting → lower energy weight
- If user frequently rejects phrase-misaligned suggestions → increase phrase weight
- Simple exponential moving average, not ML

#### 9d. MixPointSuggestionCard component

Replace the simple toast notification with a richer suggestion UI:

```
┌─ Mix Point Suggestion ────────────────────┐
│ Crossfade: 12.0s (16 bars at 128 BPM)    │
│                                            │
│ Energy:  ████████░░ 82%  (clean drop)     │
│ Phrase:  ██████████ 100% (16-bar aligned) │
│ Key:     ██████░░░░ 60%  (8A → 9A)       │
│ Overall: ████████░░ 85%                    │
│                                            │
│ [Accept]  [Adjust...]  [Reject]           │
└────────────────────────────────────────────┘
```

Accept → applies suggestion + records preference.
Reject → records rejection, optionally shows alternative suggestion.
Adjust → opens crossfade control pre-filled with suggestion.

### Acceptance criteria

- [ ] Phrase boundaries detected from beat grid + energy
- [ ] Crossfade suggestions snap to phrase boundaries when possible
- [ ] Key compatibility factored into suggestion scoring
- [ ] Suggestion card shows scoring breakdown
- [ ] Accept/reject tracked for preference learning
- [ ] Preferences persist across sessions via ConfigService
- [ ] Backwards-compatible: still works without BPM/sections/key data

---

## Phase 10 — Beat-Sync Phase B (Export with Time-Stretch)

**Goal:** Apply tempo adjustment during mix export using pitch-preserving time-stretch.

### Prerequisites

- v2 Phase 3 (Actionable Tempo Sync) — `Song.tempoAdjustment` field exists

### Changes to existing files

| File                                                | Change                                                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/main/services/mixExport/FilterGraphBuilder.ts` | Add `atempo` or `rubberband` filter to per-track chain when `song.tempoAdjustment` is set      |
| `src/main/services/mixExport/MixExportService.ts`   | Pass `tempoAdjustment` through to filter graph builder; check rubberband availability at start |

### Step-by-step

#### 10a. FFmpeg atempo filter integration

Insert tempo filter in the FFmpeg filter graph per track that has `tempoAdjustment`:

```
// Current filter chain per track:
[input] → atrim → loudnorm → crossfade

// With tempo adjustment:
[input] → atrim → atempo=<rate> → loudnorm → crossfade
```

FFmpeg `atempo` constraints:

- Range: 0.5 to 100.0 (but practical: 0.5 to 2.0)
- For rates outside 0.5–2.0: chain multiple `atempo` filters (e.g., `atempo=0.7,atempo=0.7` for 0.49x)
- Pitch shifts proportionally (not pitch-preserving)

For pitch-preserving: use `rubberband` filter (requires FFmpeg compiled with `librubberband`):

```
[input] → atrim → rubberband=tempo=<rate> → loudnorm → crossfade
```

#### 10b. Check FFmpeg rubberband availability

```typescript
// At export start, check if rubberband is available:
const hasRubberband = await checkFFmpegFilter('rubberband')

if (hasRubberband) {
  // Use rubberband for pitch-preserving time-stretch
  filterChain += `rubberband=tempo=${rate}`
} else {
  // Fallback to atempo (pitch shifts)
  filterChain += buildAtempoChain(rate) // Handles chaining for extreme rates
}
```

#### 10c. Gradual tempo ramp (optional)

For smooth tempo transitions during crossfade:

- Linear interpolation from source BPM to target BPM over crossfade duration
- FFmpeg: use `asetrate` + `atempo` with keyframe expressions
- Complex: defer to a future iteration

### Acceptance criteria

- [ ] Tracks with `tempoAdjustment` are time-stretched during export
- [ ] Pitch-preserving stretch when rubberband available
- [ ] Fallback to `atempo` with pitch shift + user warning
- [ ] Filter graph handles chaining for extreme rate adjustments
- [ ] Export progress unaffected (time-stretch is a filter, not a separate pass)

---

## Phase 11 — Per-Track Volume & Gain Automation

**Goal:** Volume envelope editor for manual gain curves on waveforms, with export integration.

### Prerequisites

- Phase 6 (Audio System Unification) — for `setValueCurveAtTime` reuse
- Undo/redo infrastructure (Phase 12 prerequisite)

### New files

| File                                                                   | Purpose                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/VolumeEnvelopeEditor.tsx`   | Canvas-based breakpoint editor overlaid on waveform              |
| `src/renderer/components/features/mix-prep/hooks/useVolumeEnvelope.ts` | Hook: manages breakpoint CRUD, snapping, persistence             |
| `src/shared/utils/volumeInterpolation.ts`                              | Pure function: interpolate volume curve for Web Audio and FFmpeg |

### Changes to existing files

| File                                                                    | Change                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts`                                     | Add `gainDb?: number`, `volumeEnvelope?: VolumePoint[]` to Song                    |
| `src/renderer/services/WebAudioEngine.ts`                               | Add `scheduleVolumeEnvelope(deck, envelope, duration)` using `setValueCurveAtTime` |
| `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` | Add `VolumeEnvelopeEditor` overlay when in edit mode                               |
| `src/main/services/mixExport/MixExportService.ts`                       | Add `volume` FFmpeg filter with keyframes from envelope                            |

### Data model

```typescript
interface VolumePoint {
  time: number // Seconds from track start
  value: number // 0–1 linear gain
}
```

### Step-by-step

#### 11a. VolumeEnvelopeEditor component

Canvas overlay positioned over waveform:

- Click empty area → add breakpoint at click position
- Drag breakpoint → move in time (x) and gain (y)
- Right-click breakpoint → delete
- Line interpolation between breakpoints
- Default: single point at (0, 1.0) — flat full volume

```typescript
interface VolumeEnvelopeEditorProps {
  envelope: VolumePoint[]
  duration: number
  width: number
  height: number
  onChange: (envelope: VolumePoint[]) => void
}
```

Rendering:

- Breakpoints as 6px circles with hover/active states
- Lines between breakpoints: 2px, white at 60% opacity
- Semi-transparent fill below the curve
- Time → x: `(point.time / duration) * width`
- Value → y: `height - point.value * height`

#### 11b. Volume curve for Web Audio preview

Reuse `setValueCurveAtTime` pattern from crossfade:

```typescript
scheduleVolumeEnvelope(deck: 'A' | 'B', envelope: VolumePoint[], duration: number): void {
  const curve = interpolateEnvelope(envelope, duration, 256)  // 256 samples
  this.decks[deck].gainNode.gain.setValueCurveAtTime(curve, startTime, duration)
}
```

`interpolateEnvelope()`: linear interpolation between breakpoints, sampled to N points.

#### 11c. FFmpeg export integration

Convert envelope to FFmpeg `volume` filter with keyframes:

```
volume='if(lt(t,10),1,if(lt(t,20),1-((t-10)/10)*0.5,0.5))'
```

Or more cleanly with the `aeval` filter for complex curves.

Simpler approach: chunk envelope into segments and use `afade` per segment.

#### 11d. Static gain offset

Simple dB offset applied globally to the track:

- UI: small input field or knob showing dB value
- Applied as constant multiplier: `gainNode.gain.value = dbToLinear(gainDb) * envelopeValue`
- FFmpeg: `volume=<linear_value>` prepended to filter chain

### Acceptance criteria

- [ ] Breakpoint editor renders on waveform with add/drag/delete
- [ ] Volume envelope previews via Web Audio during playback
- [ ] Static gain offset (dB) adjustable per track
- [ ] Volume envelope persisted to Song
- [ ] FFmpeg export applies volume curve
- [ ] Predefined shapes available: fade-in, fade-out, constant

---

## Phase 12 — Undo/Redo Infrastructure + Waveform Editing

**Goal:** Add undo/redo via `zundo` and implement non-destructive waveform editing (split, remove region).

### Sub-phase 12a — Undo/Redo Infrastructure

#### New dependencies

| Package | Purpose                                   | Size |
| ------- | ----------------------------------------- | ---- |
| `zundo` | Zustand temporal middleware for undo/redo | ~5KB |

#### Changes to existing files

| File                                                   | Change                                               |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `src/renderer/store/useProjectStore.ts`                | Wrap with `temporal()` middleware from zundo         |
| `src/renderer/components/common/UndoRedoBar.tsx` (new) | Keyboard shortcut handler + optional toolbar buttons |

#### Step-by-step

1. Install `zundo`:

   ```bash
   yarn add zundo
   ```

2. Wrap project store:

   ```typescript
   import { temporal } from 'zundo'

   export const useProjectStore = create<ProjectState>()(
     temporal(
       (set, get) => ({
         /* existing store */
       }),
       {
         limit: 50, // Max history depth
         equality: (a, b) => a.currentProject === b.currentProject,
       }
     )
   )

   // Access temporal store:
   export const useProjectTemporalStore = useProjectStore.temporal
   ```

3. Add keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z):
   ```typescript
   useEffect(() => {
     const handler = (e: KeyboardEvent) => {
       if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
         useProjectStore.temporal.getState().undo()
       }
       if (e.ctrlKey && e.key === 'z' && e.shiftKey) {
         useProjectStore.temporal.getState().redo()
       }
     }
     window.addEventListener('keydown', handler)
     return () => window.removeEventListener('keydown', handler)
   }, [])
   ```

### Sub-phase 12b — Non-Destructive Waveform Editing

#### New files

| File                                                                    | Purpose                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/WaveformEditor.tsx`          | Waveform editing toolbar: split, delete region, toggle regions |
| `src/renderer/components/features/mix-prep/RegionOverlay.tsx`           | Visual overlay showing cut regions on waveform                 |
| `src/renderer/components/features/mix-prep/hooks/useWaveformEditing.ts` | Hook: manages regions, split operations, region CRUD           |

#### Data model

```typescript
interface AudioRegion {
  id: string
  startTime: number
  endTime: number
  enabled: boolean // Can disable without deleting
}

interface Song {
  // ... existing ...
  regions?: AudioRegion[] // Non-destructive edit regions (removed segments)
}
```

#### Step-by-step

1. **Split operation**: Click waveform at timestamp → creates two regions from the gap
   - Actually: adds a "cut" at the timestamp. Regions represent removed content.
   - Split → inserts a zero-width marker. User then selects and removes a segment.

2. **Remove region**: Select region on waveform (reuse `useRegionSelection` pattern from timeline) → mark as removed
   - `regions.push({ id: uuid(), startTime, endTime, enabled: true })`
   - Visual: dimmed/hatched overlay on removed regions

3. **Toggle region**: Click region overlay → toggle `enabled` flag (non-destructive restore)

4. **FFmpeg export**: Convert regions to `atrim` + `concat` filter chain:

   ```
   // For a track with regions removed at [30-45s] and [90-100s]:
   [0:a]atrim=0:30[seg1]; [0:a]atrim=45:90[seg2]; [0:a]atrim=100[seg3];
   [seg1][seg2][seg3]concat=n=3:v=0:a=1[out]
   ```

5. **Undo/redo**: All region operations mutate `Song.regions` via project store → automatically tracked by `zundo`

#### Web Audio preview with regions

When playing a track with removed regions:

- Skip over removed segments by scheduling multiple `source.start()` calls with appropriate offsets
- Or: pre-build a new AudioBuffer excluding removed regions (simpler but uses more memory)

### Acceptance criteria

- [ ] Ctrl+Z / Ctrl+Shift+Z work for undo/redo across the app
- [ ] History depth: 50 states
- [ ] Split creates a marker on the waveform
- [ ] Region selection + delete removes a segment visually
- [ ] Removed regions shown with dimmed/hatched overlay
- [ ] Regions can be toggled enabled/disabled
- [ ] Regions persist to Song in project.json
- [ ] FFmpeg export respects regions (uses `atrim` + `concat`)
- [ ] Undo/redo works for all region operations

---

## Phase 13 — Collaborative Mix Sharing (Minimal)

**Goal:** Export/import mix project as a shareable JSON package (no audio files).

### New files

| File                                                        | Purpose                                         |
| ----------------------------------------------------------- | ----------------------------------------------- |
| `src/main/services/mixExport/MixShareService.ts`            | Export project metadata to zip, import from zip |
| `src/main/ipc/shareHandlers.ts`                             | IPC handlers: `share:export`, `share:import`    |
| `src/renderer/components/features/mix-prep/ShareButton.tsx` | Export/import UI buttons                        |

### Step-by-step

#### 13a. Export format

```json
{
  "version": "1.0",
  "exportedAt": "2026-02-26T12:00:00Z",
  "project": {
    "name": "My DJ Set",
    "songs": [
      {
        "title": "Track A",
        "artist": "Artist A",
        "bpm": 128,
        "musicalKey": "8A",
        "duration": 300,
        "crossfadeDuration": 12,
        "crossfadeCurveType": "equal-power",
        "tempoAdjustment": 1.015,
        "sections": [...],
        "regions": [...],
        "volumeEnvelope": [...]
        // NO file paths, NO audio data
      }
    ]
  }
}
```

#### 13b. Export flow

1. Serialize current project (strip file paths, audio data)
2. Write to `.mixshare.json` file
3. Optionally zip with any transition notes/annotations
4. Show save dialog → user picks location

#### 13c. Import flow

1. Open file dialog → select `.mixshare.json`
2. Parse and validate (Zod schema)
3. Show preview: tracklist, transition settings, notes
4. User confirms → create new project from import
5. Songs created without audio files (user must add files separately)
6. Match imported songs to local files by title+artist fuzzy match (optional enhancement)

### Acceptance criteria

- [ ] Export creates a `.mixshare.json` file with all mix settings (no audio)
- [ ] Import reads the file and shows a preview
- [ ] Import creates a new project with all transition settings preserved
- [ ] Missing audio files handled gracefully (songs show as "file missing")

---

## Execution Order & Dependencies

```
Phase 6 (Audio Unification)
  ├── Phase 8 (EQ & Effects) ← requires unified AudioContext
  └── Phase 11 (Volume Automation) ← reuses setValueCurveAtTime

Phase 7 (Section Detection) ← independent, can start anytime
  └── Phase 9 (Advanced Mix-Point) ← uses sections + phrases

Phase 10 (Beat-Sync Export) ← independent, requires only Song.tempoAdjustment from v2 Phase 3

Phase 12 (Undo/Redo + Waveform Editing) ← independent foundation, but benefits from all above

Phase 13 (Sharing) ← last, depends on all data model additions being finalized
```

**Suggested grouping:**

| Group | Phases | Theme                     |
| ----- | ------ | ------------------------- |
| A     | 6, 8   | Audio infrastructure + EQ |
| B     | 7, 9   | Analysis + intelligence   |
| C     | 10     | Export enhancement        |
| D     | 11, 12 | Editing infrastructure    |
| E     | 13     | Sharing                   |

Groups A and B can run in parallel. C is standalone. D depends on A (for volume preview). E is last.

---

## New dependencies

| Package | Purpose                                 | Size | Phase |
| ------- | --------------------------------------- | ---- | ----- |
| `zundo` | Zustand temporal middleware (undo/redo) | ~5KB | 12    |

No other new npm dependencies. Essentia.js already installed. FFmpeg rubberband requires checking build flags (not an npm dependency).

---

## Files touched summary

| File                                                                    | Phases                       |
| ----------------------------------------------------------------------- | ---------------------------- |
| `src/renderer/services/WebAudioEngine.ts`                               | 6, 8, 11                     |
| `src/renderer/hooks/useCrossfadePreview.ts`                             | 6                            |
| `src/shared/types/project.types.ts`                                     | 7, 11, 12                    |
| `src/main/services/waveform/KeyDetector.ts`                             | 7 (shared Essentia instance) |
| `src/main/services/mixExport/MixExportService.ts`                       | 10, 11, 12                   |
| `src/main/services/ConfigService.ts`                                    | 9                            |
| `src/renderer/components/features/mix-prep/MixPointSuggester.ts`        | 9                            |
| `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` | 7, 11                        |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`        | 8                            |
| `src/renderer/store/useProjectStore.ts`                                 | 12                           |
| **New files**                                                           | ~15 across all phases        |

---

## Risk notes

- **Essentia.js MFCC extraction** (Phase 7): Not all Essentia extractors may work identically in Node.js WASM. Test chromagram + MFCC extraction early in isolation before building the full pipeline.
- **FFmpeg rubberband** (Phase 10): The bundled FFmpeg binary may not include librubberband. Need to check at runtime and provide fallback to `atempo`.
- **zundo memory** (Phase 12): With 50 history states of full project objects, memory could grow. Consider storing only diffs or limiting which state slices are tracked.
- **Canvas overlay stacking** (Phases 7, 11): Multiple overlays on waveforms (sections + energy + volume + regions + playhead) may have z-index or click-target conflicts. Define a clear layer order.
- **Volume envelope + crossfade interaction** (Phase 11): When both volume envelope and crossfade gain are active, they multiply. Need to document this behavior clearly in the UI.
