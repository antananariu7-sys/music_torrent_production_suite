# Mix Preparation View — Implementation Plan

**Date:** 2026-02-24
**Status:** Done
**Feature spec:** [docs/features/mix-preparation-view.md](../mix-preparation-view.md)
**v2 roadmap:** [docs/features/mix-preparation-v2.md](../mix-preparation-v2.md)

---

## Decisions from Architecture Review

| Question                  | Decision                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| EnergyAnalyzer location   | **Renderer utility** — derive from existing peaks in waveformCache (~1ms), no IPC                       |
| Essentia.js key detection | **Main process** — matches BpmDetector pattern, WASM in Node.js                                         |
| Dual-deck playback        | **Refactor AudioPlayer** — migrate from HTML `<audio>` to Web Audio API for unified dual-source support |
| Waveform component        | **Adapt WaveformCanvas** — add "full-track mode" to existing component                                  |

---

## Phase 1 — Split-Panel Layout + Tracklist

**Goal:** Rewrite MixTab as a split-panel view with tracklist on the left and transition detail placeholder on the right.

### New files

| File                                                                   | Purpose                                                                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/MixPrepView.tsx`            | Root split-panel layout: tracklist (left, ~250px) + detail panel (right)                        |
| `src/renderer/components/features/mix-prep/MixPrepTracklist.tsx`       | Left-panel tracklist: compact track rows with order number, title, BPM, selection state         |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`       | Right-panel container: renders stacked waveforms + comparison strip (placeholder in this phase) |
| `src/renderer/components/features/mix-prep/hooks/usePairNavigation.ts` | Hook managing selected pair index, keyboard navigation (← →), pair computation from song list   |

### Changes to existing files

| File                                                            | Change                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/pages/ProjectOverview/components/tabs/MixTab.tsx` | Replace content with `<MixPrepView>`. Keep existing export modal/progress bar rendering. Move `syncAudioFolder` call into `MixPrepView`. |

### Layout structure

```
MixPrepView (Flex, row)
├── MixPrepTracklist (Box, w="250px", borderRight)
│   ├── Track rows (clickable, drag-and-drop)
│   └── Add Files button
└── TransitionDetail (Flex, flex=1)
    ├── Outgoing waveform area (placeholder)
    ├── Comparison strip (placeholder)
    └── Incoming waveform area (placeholder)
```

### Tracklist component

- Compact rows: order number, title (1-line clamp), BPM badge, format badge
- Active pair highlighted: selected track + its predecessor both highlighted with `bg.elevated`
- Connector between paired tracks: dashed line or accent left-border
- Drag-and-drop reorder: reuse HTML5 native drag pattern from existing `MixTracklist.tsx`
- On reorder: call `window.api.mix.reorderSongs()`, update transition detail immediately

### Pair selection logic

- Click Track N → shows pair (Track N-1, Track N)
- Track 1 selected → single-track view (no incoming transition)
- Default: Track 2 selected (shows first transition)
- Pair navigation: arrow buttons + keyboard ← → to step through pairs
- `usePairNavigation(songs)` returns `{ selectedIndex, outgoingTrack, incomingTrack, canPrev, canNext, goNext, goPrev }`

### States

- **Empty**: No songs — "Add songs from Search or import files to build your mix"
- **Single track**: Only 1 song — single waveform view, "Add more tracks to see transitions"
- **First track selected**: Track 1 solo — "First track in mix — select track 2+ to see transitions"
- **Transition view**: Normal paired view

### Acceptance criteria

- [x] MixTab shows split-panel layout
- [x] Tracklist displays all songs with order, title, BPM
- [x] Clicking track N selects the (N-1, N) pair
- [x] Drag-and-drop reorder works
- [x] Pair navigation via arrows and keyboard ← →
- [x] Empty, single-track, first-track states handled
- [x] Export button + progress bar still functional

---

## Phase 2 — Transition Waveforms

**Goal:** Render full-track waveforms for the selected pair. Adapt WaveformCanvas for non-tiled full-track rendering.

### Changes to existing files

| File                                                             | Change                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`   | Add `fullTrack?: boolean` prop. When true: skip tiling, render entire peaks array at container width in a single canvas pass. Use existing `drawWaveform()` with downsampled peaks matching pixel width. |
| `src/renderer/components/features/timeline/waveformTileCache.ts` | No changes — full-track mode bypasses the tile cache entirely                                                                                                                                            |
| `TransitionDetail.tsx`                                           | Render two `WaveformCanvas` instances (outgoing above, incoming below) in full-track mode. Load peaks data via `useWaveformData` or direct IPC call.                                                     |

### New files

| File                                                                    | Purpose                                                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` | Single waveform panel: WaveformCanvas (full-track) + track metadata header (artist, title, BPM, format, bitrate) + cue point markers + beat grid overlay |
| `src/renderer/components/features/mix-prep/hooks/useTransitionData.ts`  | Hook that loads waveform peaks + metadata for both tracks in the selected pair. Returns loading/error states.                                            |

### WaveformCanvas full-track mode

When `fullTrack={true}`:

1. Skip `getTilesForTrack()` entirely
2. Downsample 8000 peaks to canvas pixel width (e.g., 800px container → 800 bars)
3. Draw directly on the main canvas via `drawWaveform()`
4. Frequency coloring still works (peaksLow/Mid/High downsampled equally)
5. Canvas height default 100px (taller than timeline's 80px for better visibility)

### Waveform data loading

- `useTransitionData(outgoingId, incomingId)` calls `window.api.waveform.generate()` for each track if not already in `timelineStore.waveformCache`
- Returns `{ outgoing: { peaks, song, isLoading }, incoming: { peaks, song, isLoading } }`
- Loading state: skeleton placeholder (pulsing gray bar matching waveform dimensions)

### Track metadata header (per waveform panel)

```
▸ Artist - Title            128 BPM  8A  320k FLAC
```

- Play button (▸) — wired in Phase 6
- Artist + title (from Song)
- BPM badge
- Key badge (placeholder "—" until Phase 4)
- Bitrate + format

### Cue points on waveforms

- Render existing `CuePoint` markers from `song.cuePoints`
- Adapt `CuePointMarker` positioning: instead of timeline pixel coordinates, compute position as `(timestamp / duration) * canvasWidth`
- Trim-start / trim-end markers visible with dimmed regions outside trim bounds
- Cue points not editable in this view (edit via Timeline tab) — click opens a tooltip with label/type/timestamp

### Acceptance criteria

- [x] WaveformCanvas renders in full-track mode (no tiling)
- [x] Frequency coloring works in full-track mode
- [x] Two stacked waveforms shown for selected pair
- [x] Track metadata header on each waveform
- [x] Cue points visible with correct positioning
- [x] Trim bounds shown (dimmed regions)
- [x] Loading skeleton while peaks load

---

## Phase 3 — Comparison Strip + Crossfade Controls + Navigation

**Goal:** Add the metadata comparison strip between waveforms, crossfade controls, and polished pair navigation.

### New files

| File                                                                       | Purpose                                                                                                                       |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/ComparisonStrip.tsx`            | Horizontal strip between waveforms: BPM delta, key compatibility (placeholder), bitrate/format comparison, crossfade controls |
| `src/renderer/components/features/mix-prep/TransitionCrossfadeControl.tsx` | Inline crossfade editing: duration slider (0–30s), curve type buttons (linear / equal-power / s-curve), preview button        |
| `src/renderer/components/features/mix-prep/PairNavigationBar.tsx`          | Bottom bar: prev/next pair buttons, current pair indicator ("2 / 4"), keyboard hint                                           |

### Changes to existing files

| File                   | Change                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `TransitionDetail.tsx` | Compose: `TransitionWaveformPanel` (outgoing) → `ComparisonStrip` → `TransitionWaveformPanel` (incoming) → `PairNavigationBar` |

### Comparison strip content

```
┌─ Comparison Strip ─────────────────────────────────────────┐
│ BPM: 128 → 126 (−2) ⚠    Key: — → — (—)    320k → 256k ⚠│
│ ┌─Crossfade───────────────────────────────────────────────┐│
│ │ Duration: [━━━━●━━━━━] 8s                               ││
│ │ Curve: [linear] [equal-power] [s-curve]                 ││
│ │ [▸ Preview crossfade]                                   ││
│ └─────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

### BPM delta logic

- Show: `{bpmA} → {bpmB} ({delta})`
- Warning icon (orange `FiAlertTriangle`) if `|delta| > 3`
- Prominent warning (red) if `|delta| > 10`
- If either BPM unknown: show "BPM: {known} → ?" or "BPM: ? → ?"

### Bitrate/format comparison

- Show: `{bitrateA}{formatA} → {bitrateB}{formatB}`
- Warning if bitrate drops >64kbps
- Warning if format changes (FLAC → MP3)
- Color: green when matched, orange when mismatched

### Crossfade controls

- Duration: range slider 0–30s (step 0.5), matching `CrossfadePopover` behavior
- Curve type: 3 segmented buttons (linear / equal-power / s-curve)
- Preview button: invokes `useCrossfadePreview` with current pair
- Persist changes: debounced `window.api.mix.updateSong()` (500ms, same as CrossfadePopover)
- Reads `song.crossfadeDuration` and `song.crossfadeCurveType` from the outgoing track

### Pair navigation bar

- `◁ prev pair    2 / 4    next pair ▷`
- Keyboard: `←` / `→` arrow keys (via `usePairNavigation` from Phase 1)
- Disabled state when at first/last pair
- Click also updates tracklist selection highlight

### Acceptance criteria

- [x] BPM delta shown with warnings for >3 and >10 BPM difference
- [x] Bitrate/format comparison with mismatch warnings
- [x] Crossfade duration slider + curve type selector functional
- [x] Crossfade preview plays the overlap zone
- [x] Changes persist to Song entity
- [x] Pair navigation bar with prev/next + keyboard
- [x] Key comparison shows placeholder "—" (wired in Phase 4)

---

## Phase 4 — Key Detection (Essentia.js)

**Goal:** Integrate Essentia.js WASM in main process for musical key detection. Display key in Camelot notation with compatibility scoring.

### New files

| File                                        | Purpose                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/KeyDetector.ts` | Service: loads Essentia.js WASM, extracts PCM via FFmpeg, runs key detection, caches to disk |
| `src/main/ipc/keyHandlers.ts`               | IPC handlers: `key:detect`, `key:detect-batch`, `key:detect-song`                            |
| `src/shared/utils/camelotWheel.ts`          | Static Camelot compatibility map + `isCompatible(keyA, keyB)` utility                        |
| `src/shared/types/keyDetection.types.ts`    | Types: `KeyData`, `KeyDetectionProgress`, `KeyDetectionRequest`, `KeyDetectionResponse`      |
| `src/shared/schemas/keyDetection.schema.ts` | Zod schemas for IPC validation                                                               |
| `src/renderer/hooks/useKeyData.ts`          | Hook: triggers batch key detection for project songs, tracks progress                        |
| `src/main/types/essentia.d.ts`              | Type declarations for essentia.js package                                                    |

### Changes to existing files

| File                                | Change                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts` | Add `musicalKey?: string`, `musicalKeyConfidence?: number` to `Song` interface                  |
| `src/shared/constants.ts`           | Add `KEY_DETECT`, `KEY_DETECT_BATCH`, `KEY_DETECT_SONG`, `KEY_PROGRESS` IPC channel constants   |
| `src/main/ipc/index.ts`             | Register key handlers                                                                           |
| `src/preload/index.ts`              | Add `api.key.detect()`, `api.key.detectBatch()`, `api.key.detectSong()`, `api.key.onProgress()` |
| `ComparisonStrip.tsx`               | Wire key comparison: show Camelot notation + compatibility indicator (✓ compatible / ⚠ clash)   |
| `MixPrepTracklist.tsx`              | Show key badge per track                                                                        |
| `TransitionWaveformPanel.tsx`       | Show key in metadata header                                                                     |

### KeyDetector service pattern

Follows BpmDetector pattern exactly:

1. **Extract PCM**: FFmpeg → 44.1kHz mono float32 (same as BpmDetector)
2. **Run Essentia.js**: Load WASM module → create Essentia instance → call `keyExtractor(signal)` → returns `{ key, scale, strength }`
3. **Convert to Camelot**: Map standard key notation (e.g., "C major") → Camelot ("8B")
4. **Cache to disk**: `<projectDir>/assets/waveforms/<songId>.key.json` (same directory as BPM cache)
5. **File hash**: `"${size}-${mtimeMs}"` for cache invalidation (same as BpmDetector)
6. **Persist to Song**: Update `musicalKey` + `musicalKeyConfidence` on Song entity

### Essentia.js integration

```
npm package: essentia.js (includes WASM binary)
Loading in Node.js: require('essentia.js') — provides EssentiaWASM + EssentiaJS classes
Key extraction: essentia.KeyExtractor(signal, { sampleRate: 44100 })
Returns: { key: 'C', scale: 'major', strength: 0.87 }
```

Note: essentia.js provides a Node.js compatible build. If import issues arise, may need to load WASM binary manually via `fs.readFileSync` + `WebAssembly.instantiate`.

### Camelot wheel (`camelotWheel.ts`)

Static map:

```
C major → 8B    C minor → 5A
D major → 10B   D minor → 7A
...
```

Compatibility rules (all return `compatible: true`):

- Same key (8A → 8A)
- +1/-1 on same letter (8A → 7A, 8A → 9A)
- Same number, different letter (8A → 8B)

Everything else: `compatible: false`

### IPC channels

| Channel            | Direction | Payload                            | Response                       |
| ------------------ | --------- | ---------------------------------- | ------------------------------ |
| `key:detect`       | R → M     | `{ songId, filePath }`             | `{ key, openKey, confidence }` |
| `key:detect-batch` | R → M     | `{ projectId }`                    | `{ results: KeyData[] }`       |
| `key:detect-song`  | R → M     | `{ projectId, songId }`            | `{ key, openKey, confidence }` |
| `key:progress`     | M → R     | `{ songId, current, total, key? }` | — (push)                       |

### Acceptance criteria

- [x] Essentia.js WASM loads in main process
- [x] Key detected and displayed in Camelot notation per track
- [x] Batch detection with progress (via `useKeyData` hook)
- [x] Key cached to disk, invalidated on file hash change
- [x] Key persisted to Song entity in project.json
- [x] Camelot compatibility indicator in ComparisonStrip
- [x] Tracklist and waveform headers show key
- [x] Graceful fallback when key detection fails ("Key: unknown")

---

## Phase 5 — Energy Analysis + Mix Point Suggestion

**Goal:** Compute energy envelopes from existing peaks, overlay on waveforms, suggest optimal mix points.

### New files

| File                                                             | Purpose                                                                                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/utils/energyAnalyzer.ts`                             | Pure function: `computeEnergyProfile(peaks: number[], pointCount?: number): number[]` — windowed RMS, smoothed, normalized 0–1. Default ~200 points.            |
| `src/renderer/components/features/mix-prep/MixPointSuggester.ts` | Renderer-side analysis: `suggestMixPoint(outgoing, incoming): MixPointSuggestion` — analyzes energy + beats to suggest crossfade start, duration, cue positions |
| `src/renderer/components/features/mix-prep/EnergyOverlay.tsx`    | Canvas overlay component: renders smoothed energy curve on top of waveform                                                                                      |

### Changes to existing files

| File                                | Change                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts` | Add `energyProfile?: number[]` to `Song` interface                                                                                                                    |
| `WaveformCanvas.tsx`                | Accept optional `energyProfile?: number[]` prop. When provided and `fullTrack={true}`, render as a second layer (semi-transparent line/fill on top of waveform bars). |
| `TransitionWaveformPanel.tsx`       | Pass `energyProfile` to WaveformCanvas. Compute on first render via `computeEnergyProfile(peaks)` if not cached on Song.                                              |
| `TransitionDetail.tsx`              | Add "Suggest mix point" button. On click, run `suggestMixPoint()` and apply result (update crossfade start/duration, place cue markers).                              |
| `ComparisonStrip.tsx`               | Show mix point suggestion button                                                                                                                                      |

### Energy computation (`energyAnalyzer.ts`)

```typescript
function computeEnergyProfile(peaks: number[], pointCount = 200): number[] {
  const windowSize = Math.floor(peaks.length / pointCount)
  const profile: number[] = []
  for (let i = 0; i < pointCount; i++) {
    const start = i * windowSize
    const end = Math.min(start + windowSize, peaks.length)
    let rms = 0
    for (let j = start; j < end; j++) rms += peaks[j] * peaks[j]
    profile.push(Math.sqrt(rms / (end - start)))
  }
  // Smooth with 3-point moving average
  // Normalize to 0–1
  return normalize(smooth(profile))
}
```

### Energy overlay rendering

- Semi-transparent filled area chart on top of waveform
- Color: `brand.400` at 15% opacity (fill), `brand.400` at 40% opacity (line)
- Y-axis: 0 = bottom of canvas, 1 = top of canvas
- Computed from `energyProfile` (200 points → interpolated to canvas width)

### MixPointSuggester algorithm

1. Get energy profiles for both tracks
2. Find where outgoing energy is declining (last 30% of track)
3. Find where incoming energy is rising (first 30% of track)
4. Optimal crossfade start: where outgoing energy drops below 0.5 AND incoming energy starts rising above 0.3
5. Snap to nearest beat if `firstBeatOffset` and `bpm` are available
6. Suggested duration: proportional to the overlap zone (typically 4–16s)
7. Returns: `{ crossfadeStartTime, suggestedDuration, outgoingCuePoint?, incomingCuePoint? }`

### Persisting energy profile

- Computed in renderer from peaks (no IPC needed)
- Cached on `Song.energyProfile` via `window.api.mix.updateSong()` for quick access across sessions
- Recomputed if peaks change (waveform rebuild)

### Acceptance criteria

- [x] Energy envelope overlaid on both waveforms
- [x] Energy profile computed from existing peaks (no FFmpeg call)
- [x] Energy profile persisted to Song entity
- [x] "Suggest mix point" button analyzes both tracks
- [x] Suggestion adjusts crossfade duration (cue marker placement deferred)
- [x] Suggestions snap to beat grid when available
- [x] Works without BPM data (no snap, just energy-based)

---

## Phase 6 — AudioPlayer Web Audio Migration + Dual-Deck Playback

**Goal:** Migrate AudioPlayer from HTML `<audio>` to Web Audio API. Enable simultaneous dual-source playback for the transition view.

### New files

| File                                                             | Purpose                                                                                                                                                                                      |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/services/WebAudioEngine.ts`                        | Singleton Web Audio engine: manages `AudioContext`, creates source nodes, handles decoding, scheduling. Exposes: `play(buffer, startTime?, gain?)`, `stop()`, `seek()`, `getPlaybackTime()`. |
| `src/renderer/components/features/mix-prep/DualDeckControls.tsx` | Playback control bar: Play A / Play B / Play Both / Stop buttons. Displays independent playhead times.                                                                                       |
| `src/renderer/components/features/mix-prep/hooks/useDualDeck.ts` | Hook managing dual-deck state: two source channels, independent playheads, crossfade preview mode                                                                                            |

### Changes to existing files

| File                                                                                | Change                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/store/audioPlayerStore.ts`                                            | Refactor internal playback to use `WebAudioEngine` instead of HTML `<audio>` element. Maintain identical public API (playTrack, playlist, seek, volume, etc.). Add: `playDual(trackA, trackB)`, `stopDual()`, `isDualMode`. |
| `src/renderer/components/AudioPlayer.tsx` (or wherever the `<audio>` element lives) | Replace HTML `<audio>` with Web Audio API calls via `WebAudioEngine`. Current time updates via `requestAnimationFrame` polling of `AudioContext.currentTime`.                                                               |
| `TransitionDetail.tsx`                                                              | Add `DualDeckControls` below pair navigation                                                                                                                                                                                |
| `TransitionWaveformPanel.tsx`                                                       | Show moving playhead line during playback (synced to `currentTime` from engine)                                                                                                                                             |

### WebAudioEngine design

```typescript
class WebAudioEngine {
  private context: AudioContext
  private channels: Map<string, AudioChannel> // 'main' | 'deckA' | 'deckB'

  // Single-track playback (replaces <audio>)
  async playFile(filePath: string, startTime?: number): Promise<void>
  pause(): void
  resume(): void
  seek(time: number): void
  setVolume(volume: number): void
  getCurrentTime(): number

  // Dual-deck playback
  async loadDeck(deck: 'A' | 'B', filePath: string): Promise<void>
  playDeck(deck: 'A' | 'B', startTime?: number): void
  playBoth(startTimeA?: number, startTimeB?: number): void
  stopDeck(deck: 'A' | 'B'): void
  getDeckTime(deck: 'A' | 'B'): number
}
```

### Audio loading strategy

- Fetch audio via existing `audio://play?path=...` custom protocol (already used by `useCrossfadePreview`)
- Decode to `AudioBuffer` via `AudioContext.decodeAudioData()`
- Cache decoded buffers (same pattern as `useCrossfadePreview.bufferCache`)
- For long tracks: consider `MediaElementSourceNode` as fallback (streams instead of full decode)

### Migration strategy (backward compatibility)

1. Create `WebAudioEngine` as a standalone service
2. Wire it into `audioPlayerStore` — replace the current mechanism that signals `<audio>` element
3. Keep the same store API: `playTrack()`, `seek()`, `setVolume()`, etc.
4. `currentTime` updates: replace `<audio>.ontimeupdate` with `requestAnimationFrame` loop reading `context.currentTime - startOffset`
5. `duration`: read from decoded `AudioBuffer.duration`
6. All existing callers (MixTab, TimelineTab, playlist, etc.) should work without changes

### Dual-deck controls

```
[|◁]  [▸ Play A]  [▸ Play B]  [▸ Both]  [■ Stop]  [▷|]
◁ prev pair          2 / 4          next pair ▷
```

- Play A: plays outgoing track from trim-start (or beginning)
- Play B: plays incoming track from beginning
- Play Both: plays both simultaneously, offset so crossfade zone overlaps
- Stop: stops all playback
- Prev/next: stops playback, navigates pairs (merged with PairNavigationBar from Phase 3)

### Playhead visualization

- During playback, a vertical line moves across the waveform
- Position: `(currentTime / duration) * canvasWidth`
- Updated via `requestAnimationFrame` for smooth animation
- Color: `brand.400` (outgoing) / `green.400` (incoming)

### Risk: full AudioBuffer decode for long tracks

- A 10-minute FLAC track at 44.1kHz stereo = ~200MB AudioBuffer
- Mitigation: use `MediaElementSourceNode` for tracks >5 minutes (streams, no full decode)
- Dual-deck always uses `BufferSourceNode` (needed for precise scheduling)
- Consider: decode only the relevant portion (last 60s of track A, first 60s of track B) for dual-deck

### Acceptance criteria

- [ ] AudioPlayer works with Web Audio API (no HTML `<audio>`) — deferred; HTML audio kept for main player to avoid regression
- [x] All existing playback scenarios preserved (single track, playlist, seek, volume)
- [x] Play A / Play B / Play Both buttons functional
- [x] Independent playhead per track during dual playback
- [x] Moving playhead line on both waveforms
- [x] Crossfade preview mode: plays overlap zone with configured curve (via TransitionCrossfadeControl)
- [x] Navigation stops playback
- [x] Memory management: buffers released when navigating away (engine.stopAll on unmount)

---

## Phase 7 — Tempo Sync Display

**Goal:** Show BPM difference visually and suggest tempo adjustments for smooth transitions.

### New files

| File                                                               | Purpose                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/TempoSyncIndicator.tsx` | Visual BPM comparison: slider-style indicator showing how far apart the BPMs are, with colored zones (green=matched, yellow=close, red=far) |

### Changes to existing files

| File                  | Change                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ComparisonStrip.tsx` | Replace simple BPM text with `TempoSyncIndicator`. Add tempo adjustment suggestion text below.                                |
| `useDualDeck.ts`      | Add optional `playbackRate` adjustment per deck. When tempo sync enabled, adjust incoming track's rate to match outgoing BPM. |

### Tempo sync indicator

```
BPM: 128 → 126
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●━━]  −2 BPM
                                ↑
Suggestion: speed up Track B by 1.6%
```

- Visual slider: range covers ±10 BPM
- Green zone: 0 BPM difference
- Yellow zone: 1–3 BPM
- Red zone: >3 BPM
- Needle position shows current delta

### Tempo adjustment suggestion

- Calculate percentage: `((targetBPM / currentBPM) - 1) * 100`
- Display: "Speed up Track B by 1.6%" or "Slow down Track B by 2.3%"
- If both have BPM: show suggestion
- If either missing BPM: show "Detect BPM to enable tempo sync"

### Optional playbackRate preview

- Toggle: "Preview at matched tempo"
- When enabled: sets `playbackRate` on the incoming deck's source node
- `playbackRate = outgoingBPM / incomingBPM` (e.g., 128/126 = 1.016)
- Note: this shifts pitch. Acceptable for preview (spec acknowledges this limitation)
- Visual indicator: "Playing at 101.6% speed (pitch shifted)" warning

### Acceptance criteria

- [x] BPM difference shown with visual slider indicator
- [x] Colored zones (green/yellow/red) based on BPM delta
- [x] Tempo adjustment suggestion text
- [x] playbackRate API available on WebAudioEngine + useDualDeck (UI toggle deferred)
- [ ] Pitch-shift warning displayed when tempo-adjusted playback active (deferred — needs UI toggle first)
- [x] Graceful handling when BPM unavailable

---

## Component Dependency Graph

```
MixTab
└── MixPrepView                              (Phase 1)
    ├── MixPrepTracklist                     (Phase 1)
    │   └── Drag-and-drop rows
    └── TransitionDetail                     (Phase 1, fleshed out in 2-3)
        ├── TransitionWaveformPanel          (Phase 2)
        │   ├── WaveformCanvas (fullTrack)   (Phase 2)
        │   │   └── EnergyOverlay            (Phase 5)
        │   ├── CuePointMarker (adapted)     (Phase 2)
        │   └── Playhead line                (Phase 6)
        ├── ComparisonStrip                  (Phase 3)
        │   ├── TempoSyncIndicator           (Phase 7)
        │   ├── Key compatibility            (Phase 4)
        │   └── TransitionCrossfadeControl   (Phase 3)
        ├── TransitionWaveformPanel          (Phase 2, incoming)
        ├── DualDeckControls                 (Phase 6)
        └── PairNavigationBar               (Phase 3)
```

## State Architecture

```
Existing stores (modified):
├── audioPlayerStore          (Phase 6: Web Audio migration + dual-deck)
├── timelineStore             (unchanged, waveformCache reused)
└── useProjectStore           (Phase 4-5: new Song fields)

New hooks (local state):
├── usePairNavigation         (Phase 1: pair index, navigation)
├── useTransitionData         (Phase 2: load peaks for pair)
├── useKeyData                (Phase 4: batch key detection, progress)
└── useDualDeck               (Phase 6: dual-deck playback control)

New services:
├── WebAudioEngine            (Phase 6: singleton, manages AudioContext)
├── KeyDetector               (Phase 4: main process service)
└── MixPointSuggester         (Phase 5: renderer-side analysis)
```

## Files Created / Modified per Phase

| Phase | New files                                                                                                                                  | Modified files                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `MixPrepView.tsx`, `MixPrepTracklist.tsx`, `TransitionDetail.tsx`, `usePairNavigation.ts`                                                  | `MixTab.tsx`                                                                                                                                         |
| 2     | `TransitionWaveformPanel.tsx`, `useTransitionData.ts`                                                                                      | `WaveformCanvas.tsx`                                                                                                                                 |
| 3     | `ComparisonStrip.tsx`, `TransitionCrossfadeControl.tsx`, `PairNavigationBar.tsx`                                                           | `TransitionDetail.tsx`                                                                                                                               |
| 4     | `KeyDetector.ts`, `keyHandlers.ts`, `camelotWheel.ts`, `keyDetection.types.ts`, `keyDetection.schema.ts`, `useKeyData.ts`, `essentia.d.ts` | `project.types.ts`, `constants.ts`, `ipc/index.ts`, `preload/index.ts`, `ComparisonStrip.tsx`, `MixPrepTracklist.tsx`, `TransitionWaveformPanel.tsx` |
| 5     | `energyAnalyzer.ts`, `MixPointSuggester.ts`, `EnergyOverlay.tsx`                                                                           | `project.types.ts`, `WaveformCanvas.tsx`, `TransitionWaveformPanel.tsx`, `TransitionDetail.tsx`, `ComparisonStrip.tsx`                               |
| 6     | `WebAudioEngine.ts`, `DualDeckControls.tsx`, `useDualDeck.ts`                                                                              | `audioPlayerStore.ts`, `AudioPlayer.tsx`, `TransitionDetail.tsx`, `TransitionWaveformPanel.tsx`                                                      |
| 7     | `TempoSyncIndicator.tsx`                                                                                                                   | `ComparisonStrip.tsx`, `useDualDeck.ts`                                                                                                              |

## New Dependencies

| Package       | Purpose                      | Size | Phase |
| ------------- | ---------------------------- | ---- | ----- |
| `essentia.js` | Musical key detection (WASM) | ~5MB | 4     |

No other new npm dependencies. All other features use existing packages (Web Audio API is browser-native).

## Testing Strategy

- **Utility functions** (phases 4, 5): Unit tests for `camelotWheel.ts`, `energyAnalyzer.ts`, `MixPointSuggester.ts` — `.spec.ts` files alongside source
- **KeyDetector** (phase 4): Unit test with mocked FFmpeg + Essentia.js
- **WebAudioEngine** (phase 6): Unit test with mocked AudioContext (jest-mock-web-audio or manual mock)
- **usePairNavigation** (phase 1): Unit test for pair computation and navigation logic
- **UI components**: No UI tests per project convention — verify manually

## Risk Notes

- **Essentia.js in Node.js (Phase 4)**: WASM loading in main process may require manual binary loading if the npm package doesn't provide a Node.js compatible entry. Fallback: run key detection in a hidden BrowserWindow (renderer context) as a worker.
- **AudioPlayer migration (Phase 6)**: Replacing the playback engine is high-risk — all existing playback must continue working. Implement behind a feature flag initially: `useWebAudioEngine: true/false` in settings.
- **Memory (Phase 6)**: Full `AudioBuffer` decode for long tracks uses significant memory. Implement buffer pooling + release on navigation. For tracks >5 min in single-track mode, consider `MediaElementSourceNode` (streaming).
- **WaveformCanvas adaptation (Phase 2)**: Adding `fullTrack` mode must not regress the existing timeline rendering. The mode switch should be clean — no shared mutable state between the two paths.
