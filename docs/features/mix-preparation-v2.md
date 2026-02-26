# Feature: Mix Preparation View — v2 Roadmap

> Advanced DJ features building on top of the v1 Mix Preparation View.
> Prerequisites: all 5 phases of [mix-preparation-view.md](done/mix-preparation-view.md) completed.
> Implementation plan: [plans/mix-preparation-v2-plan.md](plans/mix-preparation-v2-plan.md)
> Last updated: 2026-02-26

---

## v1 Status & Known Gaps

All 5 v1 phases are **complete** and merged. Before planning v2, these v1 gaps should be acknowledged:

| Gap                                             | Impact                                                                                                   | Notes                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Song.energyProfile` never persisted by backend | Low — recomputed renderer-side from cached peaks each render                                             | Could be fixed with a batch pipeline in `WaveformExtractor` |
| `openKey` (Open Key notation) not implemented   | Low — Camelot is the primary notation used                                                               | `KeyData` only stores Camelot + original key name           |
| `setPlaybackRate` has no UI                     | Medium — WebAudioEngine supports it, `TempoSyncIndicator` shows suggestion text but no "Apply" button    | Directly feeds into v2 Beat-Sync feature                    |
| Beat grid not shown in transition panels        | Low — mix-prep waveforms are read-only previews                                                          | Would be useful for phrase-aligned transitions              |
| Two separate audio systems                      | Medium — `WebAudioEngine` (dual-deck) and `useCrossfadePreview` (own AudioContext) coexist independently | Must unify before adding EQ/effects                         |

---

## 1. Auto Section Detection & Labels

**Problem**: v1 shows a raw energy envelope — DJs must mentally interpret where the intro, buildup, drop, breakdown, and outro are. Pro tools like rekordbox auto-label these sections, letting DJs instantly see track structure.

**Approach**:

- Spectral novelty function: compute a self-similarity matrix from chromagram / MFCC features, then detect boundaries via novelty peaks
- Classify sections by energy level + spectral characteristics:
  - **Intro** — low energy, first segment
  - **Buildup** — rising energy trend
  - **Drop** — sustained high energy, strong bass
  - **Breakdown** — sudden energy dip after drop
  - **Outro** — declining energy, final segment
- Render as colored bands behind the waveform with text labels
- Allow manual correction: drag section boundaries, rename labels
- Persist section data per song in project.json

**Existing foundation**: Essentia.js WASM is already loaded for key detection in `KeyDetector.ts`. Chromagram and MFCC extractors are available in the same Essentia module — no new WASM dependencies needed.

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  sections?: TrackSection[]
}

interface TrackSection {
  id: string
  type: 'intro' | 'buildup' | 'drop' | 'breakdown' | 'outro' | 'custom'
  startTime: number
  endTime: number
  label?: string // User override label
  confidence: number // 0–1, analysis confidence
}
```

**Complexity**: High — spectral feature extraction + novelty peak picking + classification heuristics.

**UX sketch**:

```
┌─────────────────────────────────────────────────────────┐
│ [intro ][  buildup  ][    drop    ][breakdn][  outro  ] │
│ ░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒░░░░░░░░░░░ │
│ ╌╌╌╌╌╌╌╌╌╌╌waveform with section colors╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Automatic Beat-Sync (Tempo Matching)

**Problem**: v1 shows BPM difference and suggests tempo adjustment percentage (`TempoSyncIndicator`), but doesn't actually modify playback or export. DJs need tracks to play at the same BPM for a smooth transition.

**Existing foundation**: `WebAudioEngine.setDeckPlaybackRate(deck, rate)` already works (clamped 0.5–2.0). `TempoSyncIndicator` already calculates the percentage needed. The gap is purely UI — a button to apply the suggestion.

**Approach**:

- **Phase A — Preview via playbackRate** (Medium effort):
  - Add "Apply Sync" button in `TempoSyncIndicator` that calls `dualDeck.setPlaybackRate('B', rate)`
  - Persist `tempoAdjustment` to Song model
  - Beat grid alignment indicator when both tracks are synced
- **Phase B — Export with time-stretch** (High effort):
  - Integrate SoundTouch.js or Rubber Band via WASM into the `MixExportService` FFmpeg pipeline
  - Preserves pitch while adjusting tempo
  - Gradual tempo ramp option over the crossfade zone

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  tempoAdjustment?: number // Playback rate multiplier (e.g., 1.015 = +1.5%)
  tempoSyncEnabled?: boolean // Whether this track should be tempo-matched
}
```

**Complexity**: Low (Phase A — UI + 1 button) to High (Phase B — time-stretch export).

---

## 3. EQ & Effects Preview

**Problem**: DJs routinely use EQ (cutting bass, boosting highs) during transitions. Without EQ preview, the user can't hear how the transition will actually sound with frequency adjustments.

**Prerequisite**: Unify audio systems first — `WebAudioEngine` and `useCrossfadePreview` currently manage separate `AudioContext` instances. EQ nodes must plug into the dual-deck graph, not a third system.

**Approach**:

- Add `BiquadFilterNode` chain (low/mid/high) per deck in `WebAudioEngine`
- EQ knobs in the transition panel, one set per track
- Optional filter sweep (low-pass / high-pass) as a transition effect
- **Preview only** — not baked into export (export uses FFmpeg filters if needed)

**UX sketch**:

```
┌─ EQ: Track A ─┐  ┌─ EQ: Track B ─┐
│ Hi:  [━━●━━━]  │  │ Hi:  [━━━━●━]  │
│ Mid: [━━━●━━]  │  │ Mid: [━━━●━━]  │
│ Lo:  [━●━━━━]  │  │ Lo:  [━━━━━●]  │
│ [Filter sweep] │  │ [Filter sweep] │
└────────────────┘  └────────────────┘
```

**Complexity**: Medium. Web Audio EQ is straightforward. UX for knobs/sliders needs care.

---

## 4. Auto Mix-Point Detection (Advanced)

**Problem**: v1's `MixPointSuggester` uses energy + beats for a basic suggestion (analyzes last 30% outgoing energy drop, first 30% incoming rise, 4–16s clamped). v2 should be smarter — considering phrase boundaries (8/16/32 bar groups), key transitions, and energy arc across the entire mix.

**Existing foundation**: `MixPointSuggester.ts` returns `{ crossfadeDuration, confidence, reason }`. BPM + `firstBeatOffset` available per song. Key compatibility via `camelotWheel.ts`.

**Approach**:

- **Phrase detection**: Use beat grid + energy to identify phrase boundaries (every 8/16/32 bars). Crossfade should start/end on phrase boundaries for musical transitions.
- **Global energy arc**: Analyze the full mix's energy flow. Suggest track order changes if the energy arc has unnatural dips or spikes.
- **Key-aware suggestions**: Prefer transition points where key change is harmonically smooth (Camelot +1/-1 or relative major/minor).
- **Learning from user edits**: Track which suggestions the user accepts/rejects. Adjust weighting over time (local heuristic, no ML needed).

**Complexity**: High. Phrase detection requires reliable downbeat tracking. Global optimization is an interesting algorithmic problem.

---

## 5. Per-Track Volume & Gain Automation

**Problem**: Some tracks are louder than others. The current loudnorm pass normalizes everything, but DJs sometimes want manual gain adjustment or volume curves — e.g., gradually reducing volume during an outro.

**Existing foundation**: `WebAudioEngine` has per-deck `GainNode` but only supports master volume (0.7 default). `useCrossfadePreview` uses `setValueCurveAtTime()` with 128-sample Float32Arrays for crossfade curves — same approach can be used for volume envelopes.

**Approach**:

- Volume envelope editor per track: draw a curve on the waveform
- Breakpoint-based: click to add points, drag to adjust, delete to remove
- Predefined shapes: fade-in, fade-out, constant
- Export integration: FFmpeg `volume` filter with keyframes
- Preview via Web Audio `GainNode` with scheduled value changes

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  gainDb?: number // Static gain offset in dB
  volumeEnvelope?: VolumePoint[] // Automation curve
}

interface VolumePoint {
  time: number // seconds from track start
  value: number // 0–1 (linear gain)
}
```

**UX sketch**:

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ │  waveform
│ ────────────────●                       │
│                  ╲                      │  volume envelope
│                   ╲____●────────        │
│ [+3dB gain]            [-6dB]           │
└─────────────────────────────────────────┘
```

**Complexity**: Medium-High. The envelope editor UI is the main challenge. FFmpeg integration is straightforward.

---

## 6. Waveform Editing (Non-Destructive)

**Problem**: Sometimes a track has an unwanted section (long ambient intro, spoken word segment, silence gap) that should be cut — not just trimmed from the edges.

**Prerequisite**: Undo/redo infrastructure (see Technical Debt below).

**Approach**:

- **Split**: Click to split a track into segments at a timestamp. Segments can be independently removed or reordered.
- **Remove region**: Select a region → delete. Waveform closes the gap. (Region selection already exists in timeline — `useRegionSelection` hook).
- **Non-destructive**: All edits stored as a list of cuts/regions in project.json. Original audio file untouched. Export applies `atrim` + `concat` filters.
- **Undo/redo**: Essential for editing operations. Implement as an edit history stack.

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  regions?: AudioRegion[] // Non-destructive edit regions
}

interface AudioRegion {
  id: string
  startTime: number
  endTime: number
  enabled: boolean // Can disable a region without deleting
}
```

**Complexity**: High. Non-destructive editing with undo/redo is a significant architectural addition. FFmpeg filter graph becomes more complex.

---

## 7. Mix Health Dashboard

**Problem**: After preparing individual transitions, the DJ needs a bird's-eye view of the entire mix's quality: are there any problematic transitions, bitrate drops, large BPM jumps, key clashes?

**Existing foundation**: `ComparisonStrip` already computes BPM delta, key compatibility, and bitrate comparison per transition. `camelotWheel.ts` has `isCompatible()` and `getCompatibilityLabel()`. `energyAnalyzer.ts` computes energy profiles. All data is available — just needs aggregation.

**Approach**:

- Summary panel (collapsible section in the Mix tab or Timeline tab):
  - **Transition quality scores**: green/yellow/red per transition based on BPM delta, key compatibility, bitrate match
  - **Energy flow graph**: full-mix energy curve showing the overall arc
  - **Mix duration**: total with breakdown per track
  - **Format/quality report**: list any quality drops or format inconsistencies
  - **Key journey**: Camelot wheel visualization showing the key path through the mix
- Clicking any issue navigates to that transition in the Mix tab (via `usePairNavigation`)

**UX sketch**:

```
┌─ Mix Health ─────────────────────────────────┐
│ Duration: 1:23:45  │  7 tracks  │  Score: 8/10 │
│                                                │
│ Energy: ╱╲╱╲___╱╲╲╱╲___╱╲                    │
│                                                │
│ Transitions:                                   │
│  1→2  128→128 BPM ✓  8A→8A ✓  320→320 ✓  ●   │
│  2→3  128→126 BPM ⚠  8A→11B ✓  320→256 ⚠ ●   │
│  3→4  126→130 BPM ✗  11B→3A ✗  256→320 ✓  ●   │
│  ...                                           │
│                                                │
│ Key path: 8A → 8A → 11B → 3A → ...           │
│ ⚠ 1 key clash (transition 3→4)                │
│ ⚠ 1 bitrate drop (transition 2→3)            │
└────────────────────────────────────────────────┘
```

**Complexity**: Medium. Mostly data aggregation + visualization. All underlying data already exists.

---

## 8. Collaborative Mix Sharing

**Problem**: DJs sometimes prepare mixes together or want feedback from collaborators on their tracklist and transitions before exporting.

**Approach**:

- Export mix project as a shareable package (zip of project.json + metadata, no audio)
- Import shared package to view the tracklist, transition settings, and notes — even without the audio files
- Comment/annotation system per transition: "I think the crossfade is too long here"
- Future: real-time collaborative editing via CRDT (ambitious, likely v3+)

**Complexity**: Low (export/import) to Very High (real-time collaboration).

---

## 9. UX Polish — Transition Panel Clarity

**Problem**: Several v1 controls are confusing or feel dead-end:

### 9a. Crossfade control is opaque

The crossfade section shows a raw `<input type="range">` slider with "Crossfade" label and a duration value (e.g. "5.0s"), but:

- No explanation of **what** the crossfade does (overlap zone between outgoing and incoming tracks)
- No visual preview of the crossfade curve shape — the curve type buttons (Linear / Equal Power / S-Curve) are abstract labels with no indication of how they differ
- The HTML range input doesn't match the Chakra UI design language

**Improvements**:

- Replace raw `<input type="range">` with Chakra `Slider` component (consistent with `AudioPlayer`)
- Add a small inline curve visualization (mini `CrossfadeCurveCanvas`, ~60x30px) that updates live as curve type changes — this already exists in the timeline (`CrossfadeCurveCanvas.tsx`), just needs to be reused
- Add helper text: "How much the outgoing and incoming tracks overlap during transition"
- Show the overlap zone visually on the waveform panels (dim the overlapping regions, similar to how `TrimOverlay` works in the timeline)

**Effort**: Low — reuse existing components, mostly layout/copy changes.

### 9b. Tempo sync suggestion is not actionable

`TempoSyncIndicator` shows "Slow down Track B by 31.2% to match" as dead text. The user sees the problem but can't do anything about it from this UI.

**Improvements**:

- Add an "Apply" button next to the suggestion text that calls `dualDeck.setPlaybackRate('B', adjustment)` for preview
- Show a "Synced" badge when tempo adjustment is active
- Persist `tempoAdjustment` to the Song model so it survives pair navigation
- Add a "Reset" button to revert to original BPM
- Note: this overlaps with Feature 2 (Beat-Sync Phase A) — implement together

**Effort**: Low — `WebAudioEngine.setDeckPlaybackRate` already works, just wire UI.

### 9c. Transition panel layout density

The middle section between waveforms stacks 4 elements vertically (ComparisonStrip → Crossfade → Suggest button → DualDeckControls). On smaller windows this pushes the incoming waveform far down, reducing waveform visibility.

**Improvements**:

- Consolidate: merge "Suggest Mix Point" into the crossfade control as a small icon button (already has `FiZap` icon)
- Consider side-by-side layout: crossfade control left, dual-deck controls right
- Make ComparisonStrip more compact — single-row horizontal layout with BPM/Key/Quality as inline chips

**Effort**: Low — layout rearrangement only.

### 9d. Missing "what changed" feedback

When the user adjusts crossfade duration or curve type, changes persist silently (debounced 500ms). There's no visual confirmation that the setting was saved.

**Improvements**:

- Brief "Saved" micro-indicator (fade in/out text or checkmark) after debounce completes
- Or use Chakra toast (like the Suggest Mix Point already does) — but lighter, non-intrusive

**Effort**: Very low.

---

## Priority Matrix

| Feature                | Impact     | Effort        | Suggested Order                                       |
| ---------------------- | ---------- | ------------- | ----------------------------------------------------- |
| UX Polish (9a-d)       | High       | Low           | 1st — immediate quality-of-life, no new infra         |
| Mix Health Dashboard   | High       | Medium        | 2nd — aggregates existing data, high value            |
| Auto Beat-Sync (A)     | High       | Low           | with 1st — 9b and Beat-Sync Phase A are the same work |
| Auto Section Detection | High       | High          | 3rd — most visible improvement to waveform UX         |
| EQ & Effects Preview   | Medium     | Medium        | 4th — requires audio system unification first         |
| Advanced Mix-Point     | Medium     | High          | 5th — builds on section detection                     |
| Volume Automation      | Medium     | Medium-High   | 6th — useful but less critical                        |
| Waveform Editing       | Low-Medium | High          | 7th — trim + cue points cover most cases              |
| Collaborative Sharing  | Low        | Low-Very High | 8th — nice to have, scope varies wildly               |

**Priority rationale**: UX Polish moves to 1st — these are the cheapest, most impactful changes. They fix confusing UI that users encounter every session. Beat-Sync Phase A (the "Apply" button) is folded into the UX polish pass since it's the same work as 9b.

---

## Technical Debt to Address Before v2

- ~~**TimelineLayout.tsx (~950 lines)**: Should be split into smaller components~~ **DONE** (2026-02-26) — refactored to 495 lines with 6 extracted hooks + `CrossfadeZones` component. Full code size refactoring completed across all critical files (see [code-size-refactoring-plan.md](done/plans/code-size-refactoring-plan.md)).
- **Undo/redo infrastructure**: Needed for waveform editing, useful everywhere. Zero undo/redo exists in the codebase. Consider `zundo` (Zustand temporal middleware) for store-level undo. Must be in place before Feature 6.
- **Web Audio system unification**: `WebAudioEngine` (dual-deck, 318 lines) and `useCrossfadePreview` (256 lines) manage separate `AudioContext` instances. Must merge crossfade preview into `WebAudioEngine` before adding EQ/effects (Feature 3). Proposed: add `scheduleCrossfade(curveType, duration)` to WebAudioEngine using existing `generateFadeOutCurve`/`generateFadeInCurve` from `useCrossfadePreview`.
- **Essentia.js scope**: Key detection works well (`KeyDetector.ts`). Reuse Essentia.js for section detection — chromagram + MFCC extractors are available in the same WASM module. No new dependencies needed.
- **Energy profile persistence**: `Song.energyProfile` field exists but is never written by any IPC handler — always recomputed renderer-side. Should be computed once during `WaveformExtractor.generateBatch()` and persisted to the Song, especially before Mix Health Dashboard aggregates energy data across all tracks.
