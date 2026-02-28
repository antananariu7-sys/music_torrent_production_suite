# Mix & Timeline Improvements Plan

## Overview

Two groups of improvements: (A) Mix-prep tab UX enhancements — better crossfade visibility, simplified playback controls, region-aware playback fixes, speed adjustment regions, undo/redo buttons; (B) Timeline tab — full-mix playback with all effects combined.

---

## Phase 1: Crossfade Visibility on Mix-Prep Waveforms

**Goal**: Show colored overlay zones on both track waveforms indicating where the crossfade happens.

### What to build

Create a `CrossfadeOverlay` component rendered inside `TransitionWaveformPanel` (similar stacking to `RegionOverlay`). For **track A (outgoing)**: a semi-transparent gradient zone at the end of the trimmed region, width = crossfade duration in pixels. For **track B (incoming)**: a matching zone at the beginning of the trimmed region.

### Implementation

1. **New component**: `src/renderer/components/features/mix-prep/CrossfadeOverlay.tsx`
   - Props: `crossfadeDuration`, `trimStart`, `trimEnd`, `duration`, `containerWidth`, `role: 'outgoing' | 'incoming'`
   - Canvas overlay (same approach as `RegionOverlay` — DPI-aware canvas)
   - Outgoing: gradient from transparent to orange/amber at the right edge (last N seconds)
   - Incoming: gradient from orange/amber to transparent at the left edge (first N seconds)
   - Label text: "Crossfade {duration}s"

2. **Wire into `TransitionWaveformPanel.tsx`**:
   - Add `CrossfadeOverlay` after `EnergyOverlay`, before `VolumeEnvelopeEditor`
   - Pass crossfade duration from the outgoing song's `crossfadeDuration` prop
   - Only render when `crossfadeDuration > 0`

### Files changed

- `src/renderer/components/features/mix-prep/CrossfadeOverlay.tsx` (new)
- `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` (add overlay)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (pass crossfade duration to panel)

---

## Phase 2: Region-Aware Playback Fix

**Goal**: When playing a track, playback should skip over enabled regions (muted segments) instead of playing through them.

### Current state

`WebAudioEngine.playDeckWithRegions()` exists and computes kept segments. It creates multiple `AudioBufferSourceNode`s scheduled at the right times. The issue is likely that regions aren't being synced to the engine before playback starts, or `playDeck()` is called instead of region-aware playback.

### Investigation & fix

1. **Audit `TransitionDetail.tsx` useEffect** that syncs regions to engine:
   - Verify `engine.setDeckRegions(deck, regions)` is called with the correct filtered (enabled-only) regions
   - Verify timing: regions must be set BEFORE `playDeck()` is triggered
   - Check that `playDeckWithRegions()` is actually invoked (not bypassed by `playDeck()`)

2. **Audit `WebAudioEngine.playDeck()`**:
   - Confirm it checks `this.decks[deck].regions` and routes to `playDeckWithRegions()` when regions exist
   - Confirm `playDeckWithRegions()` correctly computes kept segments using `computeKeptSegments()`
   - Verify the scheduled source timing math is correct

3. **Fix the gap**: Whatever causes regions to be ignored during playback — likely a missing call or incorrect region sync timing.

### Files changed

- `src/renderer/services/WebAudioEngine.ts` (fix region-aware routing)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (fix sync timing if needed)

---

## Phase 3: Undo/Redo Visible Buttons

**Goal**: Show undo/redo as visible icon buttons in the mix-prep UI, not just keyboard shortcuts.

### Implementation

1. **Update `UndoRedoBar.tsx`**:
   - Currently it's a keyboard-only handler; add visible `IconButton`s with undo/redo icons (`FiRotateCcw` / `FiRotateCw`)
   - Track `canUndo` / `canRedo` state by subscribing to `useProjectStore.temporal`
   - Disable buttons when no history available
   - Keep existing keyboard shortcut handling

2. **Place in `TransitionDetail.tsx`**:
   - Render `UndoRedoBar` in the top toolbar area of the detail panel (near existing controls)
   - Small, unobtrusive — two icon buttons with tooltips

### Files changed

- `src/renderer/components/common/UndoRedoBar.tsx` (add visible buttons + canUndo/canRedo state)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (render UndoRedoBar in toolbar)

---

## Phase 4: Click-to-Play on Waveform

**Goal**: Clicking anywhere on the waveform (outside a region) starts playback from that position.

### Implementation

1. **Add click handler to `TransitionWaveformPanel.tsx`**:
   - On `onClick` of the waveform container:
     - Convert click X position to time using `pixelsPerSecond` scale
     - Check if click time falls inside any enabled region — if yes, do nothing (let `RegionOverlay` handle it)
     - If outside all regions, call `playDeck(deck, clickTime)` via the `useDualDeck` hook
   - The handler must be on the container div, behind all overlays, with proper event propagation

2. **Pass playback callback down**:
   - `TransitionDetail` passes `onWaveformClick(deck, time)` to `TransitionWaveformPanel`
   - `TransitionWaveformPanel` wires it to container click, converting px → time

### Files changed

- `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` (add click handler)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (pass play callback)

---

## Phase 5: Muted Icon on Regions

**Goal**: Each enabled (muted) region should display a speaker-muted icon for visual clarity.

### Implementation

1. **Update `RegionOverlay.tsx`**:
   - After drawing each enabled region's hatching pattern, draw a small muted speaker icon (`🔇` or a custom SVG path)
   - Position: centered vertically, centered horizontally within the region (or left-aligned if region is wide)
   - Only show icon if region width in pixels > ~40px (skip for very narrow regions)
   - Use canvas `drawImage()` with a pre-rendered icon, or draw a simple speaker path with canvas API

### Files changed

- `src/renderer/components/features/mix-prep/RegionOverlay.tsx` (add muted icon rendering)

---

## Phase 6: Simplified Playback Controls — Unified A+B

**Goal**: Remove the separate "Preview Crossfade" button. Replace with a prominent "Play A → B" button that plays sequentially with automatic crossfade transition.

### Current state

`DualDeckControls.tsx` has: Play A, Play B, Play Both (simultaneous), Stop.
`TransitionDetail.tsx` also renders a crossfade preview button using `useCrossfadePreview`.

### New design

**Buttons**: `▶ A` (play outgoing) | `▶ B` (play incoming) | `▶▶ A → B` (sequential with crossfade, prominent) | `⏹ Stop`

The "A → B" button plays from current position in track A. When playback reaches the crossfade zone (last N seconds of A's trimmed region), it automatically fades A out and fades B in, continuing B playback until its trimmed end.

### Implementation

1. **New method in `WebAudioEngine`**: `playSequentialCrossfade(options)`
   - Takes: deck A buffer start time, crossfade zone start time, crossfade duration, curve type, deck B start offset
   - Schedules deck A playback from start
   - At `crossfadeZoneStart`, schedules deck B to start and applies gain curves to both
   - Returns timing info for playhead tracking

2. **Update `DualDeckControls.tsx`**:
   - Remove "Play Both" button (simultaneous mode)
   - Add "A → B" button (larger, accent-colored)
   - Wire to new `playSequentialCrossfade()` method
   - Track which mode is active for stop behavior

3. **Remove crossfade preview**:
   - Remove `useCrossfadePreview` usage from `TransitionDetail.tsx`
   - Remove the crossfade preview button and its state
   - The `useCrossfadePreview` hook can remain in codebase (referenced elsewhere) but unused from mix-prep

4. **Playhead tracking**:
   - During sequential playback, show playhead on A until crossfade starts
   - During crossfade zone, show playhead on both A and B
   - After crossfade completes (A silent), show playhead only on B

### Files changed

- `src/renderer/services/WebAudioEngine.ts` (add `playSequentialCrossfade`)
- `src/renderer/components/features/mix-prep/DualDeckControls.tsx` (replace buttons)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (remove crossfade preview, wire new mode)
- `src/renderer/components/features/mix-prep/hooks/useDualDeck.ts` (expose sequential crossfade)

---

## Phase 7: Speed Adjustment Region

**Goal**: When tempo is adjusted, the adjustment applies within a visible/editable region. The song gradually returns to its original speed towards the end of this region.

### Data model

Add to `Song` type:

```typescript
interface TempoRegion {
  startTime: number // Region start (seconds from track start)
  endTime: number // Region end — speed reaches original BPM here
  rampType: 'linear' // Future: 'ease-in', 'ease-out', 's-curve'
}
```

New field on `Song`: `tempoRegion?: TempoRegion`

### Default behavior

When a user sets `tempoAdjustment` (e.g., 1.02 = +2%), a `tempoRegion` is auto-created:

- `startTime` = 0 (or `trimStart`)
- `endTime` = start of crossfade zone (i.e., `effectiveDuration - crossfadeDuration`)
- The last portion of the region (= crossfade duration by default) is where speed ramps back to 1.0

### UI

1. **New overlay**: `TempoRegionOverlay.tsx` on `TransitionWaveformPanel`
   - Shown only when `tempoAdjustment !== 1.0`
   - Colored zone (blue/purple tint) showing the tempo region
   - Gradient section at the end showing the ramp-back zone
   - Draggable end handle to resize the region
   - Label: "Speed: +2% → normal"

2. **Speed adjustment control** (existing in `TransitionDetail`):
   - When user changes tempo, auto-create/update `tempoRegion` with defaults
   - Show region length info near the speed slider

### Preview (Web Audio)

- During the constant-speed portion: `setDeckPlaybackRate(deck, tempoAdjustment)`
- During the ramp portion: schedule `playbackRate` automation using `AudioParam.linearRampToValueAtTime(1.0, rampEndTime)`
- This gives smooth real-time speed transition

### Export (FFmpeg)

- Modify `FilterGraphBuilder.buildTempoFilter()`:
  - Split track audio into segments: constant-tempo portion + ramp portion
  - For the ramp: use rubberband with time-varying tempo, or approximate with multiple small `atempo` segments
  - Concatenate results

### Files changed

- `src/shared/types/project.types.ts` (add `TempoRegion`, add `tempoRegion` to `Song`)
- `src/renderer/components/features/mix-prep/TempoRegionOverlay.tsx` (new)
- `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` (add overlay)
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx` (auto-create tempoRegion, pass props)
- `src/renderer/services/WebAudioEngine.ts` (playback rate ramping)
- `src/main/services/mixExport/FilterGraphBuilder.ts` (split tempo into segments)
- `src/main/services/mixExport/FilterGraphBuilder.spec.ts` (test new tempo logic)

---

## Phase 8: Timeline Full-Mix Playback (Hybrid)

**Goal**: Play the full mix on the Timeline tab with all effects — crossfades, volume automation, regions skipped, tempo adjustments — applied in real-time for short sections, with FFmpeg pre-render for full playback.

### Architecture

**Hybrid approach**:

- **Quick preview** (all tracks, real-time): WebAudioEngine multi-deck scheduling with LRU buffer cache. Decodes buffers ahead of playhead, evicts old ones to manage memory.
- **Full mix playback**: FFmpeg renders to cached temp WAV, then plays back via HTMLAudioElement. Cache invalidated on any mix parameter change (hash-based staleness check).

### Implementation

#### A. Quick real-time preview (WebAudioEngine)

1. **New method**: `WebAudioEngine.playMixPreview(tracks, startTrackIndex)`
   - Loads all track buffers with LRU cache (decode ahead of playhead, evict distant tracks)
   - Schedules sequential playback with crossfade gain automation between each pair
   - Applies regions (skip), volume envelope, and tempo to each track
   - Returns combined timing info for a unified playhead

2. **Playhead mapping**:
   - Each track's effective duration = `(trimEnd - trimStart - removedRegionsDuration) / tempoAdjustment`
   - Cumulative offset for each track = sum of prior effective durations minus crossfade overlaps
   - Map global playhead position → which track is playing + local position

#### B. Full mix render + playback

1. **New IPC channel**: `mix-export:render-preview`
   - Uses existing `MixExportService` pipeline but outputs to a temp file (WAV for speed)
   - Lower quality settings for faster render (44.1kHz, 16-bit)
   - Returns temp file path when done

2. **New hook**: `useFullMixPlayback`
   - Triggers render via IPC
   - Shows progress indicator during render
   - When done, loads temp WAV into audio player
   - Maps playback time to track positions for visual sync on timeline

#### C. Timeline UI additions

1. **New button** in timeline toolbar: "▶ Play Mix" (accent-colored)
   - Default: real-time preview from current position (all tracks via LRU-cached buffers)
   - Dropdown option: "Render & Play Full Mix" (FFmpeg, cached with hash-based invalidation)
2. **Progress overlay** during FFmpeg render
3. **Unified playhead** that moves across all tracks during full-mix playback

### Files changed

- `src/renderer/services/WebAudioEngine.ts` (add `playMixPreview`)
- `src/renderer/components/features/timeline/TimelineLayout.tsx` (add Play Mix button)
- `src/renderer/hooks/useFullMixPlayback.ts` (new — render + playback orchestration)
- `src/main/services/mixExport/MixExportService.ts` (add `renderPreview` method)
- `src/main/ipc/mixExportHandlers.ts` (add preview render IPC handler)
- `src/shared/constants.ts` (add new IPC channel)
- `src/preload/index.ts` (expose new IPC method)

---

## Implementation Order & Dependencies

```
Phase 1 (Crossfade overlay)          — standalone, no dependencies
Phase 2 (Region playback fix)        — standalone, critical bug fix
Phase 3 (Undo/redo buttons)          — standalone, quick win
Phase 4 (Click-to-play)              — standalone, depends on Phase 2 working
Phase 5 (Muted icon)                 — standalone, quick win
Phase 6 (Unified A→B playback)       — depends on Phase 2 (regions must work)
Phase 7 (Speed adjustment region)    — depends on Phase 1 (overlay pattern reuse)
Phase 8 (Timeline full-mix playback) — depends on Phase 2, 6, 7 (all effects working)
```

**Recommended order**: 2 → 3 → 5 → 1 → 4 → 6 → 7 → 8

Start with the bug fix (Phase 2), then quick wins (3, 5), then visual improvements (1, 4), then the bigger features (6, 7, 8).

---

## Estimated Scope

| Phase | New files | Changed files | Complexity         |
| ----- | --------- | ------------- | ------------------ |
| 1     | 1         | 2             | Low                |
| 2     | 0         | 2             | Medium (debugging) |
| 3     | 0         | 2             | Low                |
| 4     | 0         | 2             | Low                |
| 5     | 0         | 1             | Low                |
| 6     | 0         | 4             | High               |
| 7     | 1         | 6+            | High               |
| 8     | 1         | 5+            | High               |

---

## Decisions (Resolved)

1. **Speed ramp for FFmpeg export**: Use **rubberband** for smooth time-varying tempo ramping. Rubberband supports pitch-preserved tempo changes natively — no need for discrete atempo step approximation.

2. **Timeline real-time preview track count**: Attempt **all tracks** in the mix for real-time preview, not just 2-3. Will need a caching strategy for decoded audio buffers to keep memory manageable (LRU cache, decode ahead of playhead).

3. **Full mix render caching**: **Cache the rendered preview** WAV file. Invalidate when any mix parameter changes (crossfade, regions, volume, tempo, trim, track order). Store a hash of relevant parameters alongside the cached file to detect staleness.
