# Waveform Interaction Improvements — Implementation Plan

**Feature spec**: [waveform-interaction-improvements.md](waveform-interaction-improvements.md)
**Date**: 2026-02-22

---

## Current State Assessment

| Capability            | Status      | Notes                                                    |
| --------------------- | ----------- | -------------------------------------------------------- |
| Beat grid toggle      | **Done**    | `showBeatGrid` in timelineStore + ZoomControls toggle    |
| Snap-to-beat          | **Partial** | Only in CuePointPopover; needs extraction to shared util |
| Trim overlay          | **Visual**  | Static dimmed regions, no handles, no dragging           |
| Cue point markers     | **Click**   | Memo'd, click → popover. Not draggable                   |
| Crossfade zones       | **Click**   | Semi-transparent Box → opens slider popover              |
| Crossfade curves      | **None**    | Flat box only, no fade-in/fade-out curve visualization   |
| Crossfade curve types | **None**    | FilterGraphBuilder hardcodes `c1=tri:c2=tri` (linear)    |
| Crossfade preview     | **None**    | No Web Audio API integration, no preview playback        |
| Region selection      | **None**    | Click = play, double-click = cue popover, no drag-select |
| Drag infrastructure   | **None**    | No `dragState` in store, no pointer capture patterns     |

**Key files that will be modified or created**:

```
src/renderer/components/features/timeline/
├── TimelineLayout.tsx          — modify (gesture handling, trim handles, drag wiring)
├── CuePointMarker.tsx          — modify (add drag behavior)
├── TrimOverlay.tsx             — modify (add drag handles)
├── TrimHandle.tsx              — NEW (draggable grip handle component)
├── CrossfadePopover.tsx        — modify (add curve selector + preview button)
├── CrossfadeCurveCanvas.tsx    — NEW (canvas rendering fade curves in overlap zone)
├── RegionSelection.tsx         — NEW (Phase 5 — selection highlight + toolbar)
├── hooks/
│   ├── useDragInteraction.ts   — NEW (shared pointer capture drag hook)
│   └── useRegionSelection.ts   — NEW (Phase 5 — drag-select gesture hook)
├── utils/
│   └── snapToBeat.ts           — NEW (extracted from CuePointPopover)

src/renderer/store/
├── timelineStore.ts            — modify (add dragState, activeSelection)

src/renderer/hooks/
├── useCrossfadePreview.ts      — NEW (Web Audio API crossfade preview)

src/shared/types/
├── project.types.ts            — modify (add crossfadeCurveType to Song)

src/main/services/mixExport/
├── FilterGraphBuilder.ts       — modify (support curve type parameter)
```

---

## Phase 1 — Drag Infrastructure + Trim Handles

**Goal**: Foundational drag system + first visible interaction improvement.
**Estimated effort**: 4-6 hours

### 1.1 Extract snap-to-beat utility

**From**: `CuePointPopover.tsx` (lines 8-12)
**To**: `src/renderer/components/features/timeline/utils/snapToBeat.ts`

```typescript
export function snapToNearestBeat(
  timestamp: number,
  bpm: number,
  firstBeatOffset: number
): number {
  const beatInterval = 60 / bpm
  const beatIndex = Math.round((timestamp - firstBeatOffset) / beatInterval)
  return firstBeatOffset + beatIndex * beatInterval
}
```

Update CuePointPopover to import from the shared location.

### 1.2 Add drag state to timelineStore

Add to `TimelineState` interface:

```typescript
// Drag interaction tracking
dragState: {
  type: 'trim-start' | 'trim-end' | 'cue-point'
  songId: string
  startX: number          // Initial pointer X at drag start
  initialValue: number    // Timestamp at drag start (for delta computation)
} | null

// Actions
setDragState: (state: TimelineState['dragState']) => void
clearDragState: () => void
```

### 1.3 Create `useDragInteraction` hook

Shared hook for pointer-capture drag behavior used by trim handles and cue points.

**File**: `src/renderer/components/features/timeline/hooks/useDragInteraction.ts`

```typescript
interface UseDragInteractionOptions {
  onDragStart?: (e: PointerEvent) => void
  onDragMove: (deltaX: number, e: PointerEvent) => void
  onDragEnd: (deltaX: number, e: PointerEvent) => void
  threshold?: number // px before drag activates (default: 3)
}

export function useDragInteraction(options: UseDragInteractionOptions) {
  // Returns: { onPointerDown: handler }
  // Uses setPointerCapture for reliable tracking
  // Tracks startX/startY, activates drag after threshold
  // Calls onDragMove with deltaX on pointermove
  // Calls onDragEnd on pointerup
  // Prevents text selection during drag
}
```

### 1.4 Create `TrimHandle` component

**File**: `src/renderer/components/features/timeline/TrimHandle.tsx`

```typescript
interface TrimHandleProps {
  side: 'start' | 'end'
  x: number // Pixel position
  trackHeight: number
  onDrag: (deltaSeconds: number) => void
  onDragEnd: () => void
}
```

**Visual**: 8px-wide vertical bar at trim boundary with grip texture (3 horizontal lines). `col-resize` cursor on hover. Positioned absolutely.

### 1.5 Add trim handles to TrimOverlay

Modify `TrimOverlay.tsx` to accept new props:

```typescript
interface TrimOverlayProps {
  // ... existing props
  onTrimStartDrag: (newTimestamp: number) => void
  onTrimEndDrag: (newTimestamp: number) => void
  onTrimDragEnd: () => void
  snapMode: 'off' | 'beat'
  bpm?: number
  firstBeatOffset?: number
}
```

- Render `TrimHandle` at left/right edges of the active waveform region
- If no trim set, handles appear at track absolute start/end (dragging inward creates the trim)
- During drag: compute new timestamp from pointer delta, apply snap-to-beat if active, clamp to valid range
- Minimum 1s gap between trimStart and trimEnd
- Debounced persist (300ms) via IPC `window.api.mix.updateSong()`

### 1.6 Wire drag into TimelineLayout

In `TimelineLayout.tsx`:

- Pass trim drag callbacks to TrimOverlay
- On drag: update local state immediately (for visual responsiveness)
- On drag end: persist via IPC, update project store
- Show warning indicator if effective duration < crossfade to neighbor

**Constraints enforcement**:

- `trimStart >= 0`
- `trimEnd <= song.duration`
- `trimStart < trimEnd - 1` (minimum 1s gap)
- Neither can extend beyond track's actual duration

### 1.7 Tests

- `snapToBeat.spec.ts` — unit tests for snap function
- `useDragInteraction.spec.ts` — test threshold, pointer capture
- TrimOverlay visual behavior verified manually (drag precision, snapping, constraints)

---

## Phase 2 — Draggable Cue Points

**Goal**: Make cue point markers repositionable via drag.
**Estimated effort**: 3-4 hours
**Depends on**: Phase 1 (useDragInteraction hook)

### 2.1 Add drag behavior to CuePointMarker

Modify `CuePointMarker.tsx`:

```typescript
interface CuePointMarkerProps {
  cuePoint: CuePoint
  x: number
  trackHeight: number
  pixelsPerSecond: number // NEW — for drag delta → time conversion
  onClick: (cuePoint: CuePoint) => void
  onDrag: (cuePoint: CuePoint, newTimestamp: number) => void // NEW
  onDragEnd: (cuePoint: CuePoint, newTimestamp: number) => void // NEW
  snapMode: 'off' | 'beat' // NEW
  bpm?: number // NEW
  firstBeatOffset?: number // NEW
  minTimestamp: number // NEW — track start bound (trimStart or 0)
  maxTimestamp: number // NEW — track end bound (trimEnd or duration)
}
```

**Behavior**:

- Use `useDragInteraction` with 3px threshold
- Pointer down → `cursor: grabbing`
- Below threshold: interpreted as click → opens popover
- Above threshold: marker follows cursor horizontally
- Apply snap-to-beat during drag if `snapMode === 'beat'`
- On release: persist new timestamp via debounced IPC

### 2.2 Click vs drag disambiguation

The `useDragInteraction` hook handles this via the `threshold` option:

- If pointer moves < 3px total → `onClick` fires
- If pointer moves >= 3px → `onDragMove` / `onDragEnd` fire
- `onClick` is suppressed when drag activates

### 2.3 Trim-type cue point drag

When a cue point with `type: 'trim-start'` or `type: 'trim-end'` is dragged:

1. Update the cue point's `timestamp`
2. Also update `song.trimStart` or `song.trimEnd` respectively
3. TrimOverlay re-renders with new boundaries
4. Enforce ordering: `trim-start` cannot pass `trim-end`

### 2.4 Wire into TimelineLayout

In the `.map()` loop rendering CuePointMarkers:

- Pass `onDrag` and `onDragEnd` callbacks
- `onDrag`: update local position for responsiveness
- `onDragEnd`: persist to project via IPC

### 2.5 Tests

- CuePointMarker drag threshold distinction
- Trim-type constraint enforcement
- Boundary clamping (can't drag outside track range)

---

## Phase 3 — Crossfade Curve Visualization + Curve Type Selector

**Goal**: Visual crossfade curves in overlap zones + configurable curve type.
**Estimated effort**: 6-8 hours
**Independent of**: Phase 1-2 (can be done in parallel)

### 3.1 Add crossfade curve type to data model

**File**: `src/shared/types/project.types.ts`

```typescript
export type CrossfadeCurveType = 'linear' | 'equal-power' | 's-curve'

export interface Song {
  // ... existing fields
  crossfadeDuration?: number
  crossfadeCurveType?: CrossfadeCurveType // NEW — default: 'linear'
}
```

### 3.2 Create `CrossfadeCurveCanvas`

**File**: `src/renderer/components/features/timeline/CrossfadeCurveCanvas.tsx`

```typescript
interface CrossfadeCurveCanvasProps {
  width: number // Overlap width in pixels
  height: number // Track height
  curveType: CrossfadeCurveType
  colorA: string // Outgoing track color
  colorB: string // Incoming track color
}
```

**Canvas rendering**:

- Two curves in the overlap zone: fade-out (descending) and fade-in (ascending)
- **Linear**: straight diagonal lines
- **Equal-power**: `Math.cos(t * π/2)` for fade-out, `Math.sin(t * π/2)` for fade-in (ensures constant loudness)
- **S-curve**: sigmoid `(1 - Math.cos(t * π)) / 2` for smooth transition
- Fill area under each curve with respective track color at 20% opacity
- Overlap region background remains slightly highlighted (clickable)

**Implementation detail**: Use `Path2D` + `ctx.fill()` with `globalAlpha`. Canvas scales with `devicePixelRatio`.

### 3.3 Replace flat overlap box with CrossfadeCurveCanvas

In `TimelineLayout.tsx`, replace the current overlap zone `<Box>` (lines 445-470) with:

```tsx
<CrossfadeCurveCanvas
  width={overlapWidth}
  height={TRACK_HEIGHT}
  curveType={song.crossfadeCurveType ?? 'linear'}
  colorA={TRACK_COLORS[index % TRACK_COLORS.length]}
  colorB={TRACK_COLORS[(index + 1) % TRACK_COLORS.length]}
/>
```

Keep the click handler for opening CrossfadePopover — wrap canvas in a clickable container.

### 3.4 Add curve type selector to CrossfadePopover

Modify `CrossfadePopover.tsx`:

```typescript
interface CrossfadePopoverProps {
  // ... existing
  currentCurveType: CrossfadeCurveType // NEW
}
```

Add a segmented control or dropdown below the duration slider:

```
Curve: [Linear] [Equal Power] [S-Curve]
```

On change: persist via `window.api.mix.updateSong({ crossfadeCurveType })`.

### 3.5 Update FilterGraphBuilder for curve types

Modify `FilterGraphBuilder.ts` to accept curve type:

```typescript
export interface TrackInfo {
  // ... existing
  crossfadeCurveType?: CrossfadeCurveType // NEW
}
```

Map curve types to FFmpeg `acrossfade` parameters:

- `linear` → `c1=tri:c2=tri` (current behavior)
- `equal-power` → `c1=qsin:c2=qsin` (quarter sine = equal power)
- `s-curve` → `c1=hsin:c2=hsin` (half sine = S-curve)

```typescript
function getCurveParam(type: CrossfadeCurveType = 'linear'): string {
  switch (type) {
    case 'linear':
      return 'c1=tri:c2=tri'
    case 'equal-power':
      return 'c1=qsin:c2=qsin'
    case 's-curve':
      return 'c1=hsin:c2=hsin'
  }
}
```

Update line 82:

```typescript
;`${currentLabel}${nextLabel}acrossfade=d=${crossfade}:${getCurveParam(tracks[i].crossfadeCurveType)}${outputLabel}`
```

### 3.6 Tests

- `CrossfadeCurveCanvas` — verify canvas calls for each curve type
- `FilterGraphBuilder.spec.ts` — add cases for `equal-power` and `s-curve` curve params
- `getCurveParam` — unit test mapping

---

## Phase 4 — Crossfade Preview Playback (Web Audio API)

**Goal**: Preview crossfade sound with both tracks mixed via Web Audio API.
**Estimated effort**: 6-8 hours
**Depends on**: Phase 3 (curve type selector, for matching preview to export)

### 4.1 Create `useCrossfadePreview` hook

**File**: `src/renderer/hooks/useCrossfadePreview.ts`

Core Web Audio API integration:

```typescript
interface CrossfadePreviewOptions {
  trackA: { filePath: string; trimEnd?: number; duration: number }
  trackB: { filePath: string; trimStart?: number }
  crossfadeDuration: number
  curveType: CrossfadeCurveType
}

interface CrossfadePreviewReturn {
  isLoading: boolean
  isPlaying: boolean
  error: string | null
  play: () => Promise<void>
  stop: () => void
}

export function useCrossfadePreview(
  options: CrossfadePreviewOptions
): CrossfadePreviewReturn
```

### 4.2 Web Audio architecture

```
AudioContext
├─ AudioBufferSourceNode A → GainNode A (fade-out automation) ─┐
│                                                               ├→ Destination
└─ AudioBufferSourceNode B → GainNode B (fade-in automation) ─┘
```

**Key implementation details**:

1. **Load audio segments via IPC**: Only load relevant portions — ~15s before crossfade from Track A, ~15s after crossfade from Track B. Use the existing `window.api.audio.readFile()` to get data URLs, then `fetch()` + `audioContext.decodeAudioData()`.

2. **Gain automation** with `GainNode.gain.setValueCurveAtTime()`:
   - **Linear**: linear ramp from 1→0 (A) and 0→1 (B)
   - **Equal-power**: `cos(t * π/2)` curve for A, `sin(t * π/2)` curve for B
   - **S-curve**: `(1 + cos(t * π)) / 2` for A, `(1 - cos(t * π)) / 2` for B

3. **Playback window**: Start 10s before crossfade on Track A, play through crossfade, stop 5s into Track B.

4. **Memory**: Decode only the needed segments. Close `AudioContext` on cleanup/unmount.

### 4.3 Add preview button to CrossfadePopover

Add below the curve selector:

```tsx
<Button
  size="xs"
  variant="outline"
  onClick={preview.isPlaying ? preview.stop : preview.play}
  loading={preview.isLoading}
>
  {preview.isPlaying ? '⏹ Stop' : '▶ Preview'}
</Button>
```

The preview hook receives track info from the popover's props (songId, next song, crossfade params).

### 4.4 Pause main AudioPlayer during preview

When crossfade preview starts, pause the main AudioPlayer:

```typescript
useAudioPlayerStore.getState().pause()
```

Resume is manual (user clicks play). This prevents two audio sources playing simultaneously.

### 4.5 Handle edge cases

- **Missing audio files**: Disable preview button, show tooltip "Audio file missing"
- **Large files**: The IPC currently loads entire file as base64. For preview, only need ~30s of audio. Consider using a time-range read (requires new IPC handler or the `protocol.handle` fix from PERFORMANCE_ANALYSIS.md #1)
- **AudioContext lifecycle**: Create on first preview, reuse across previews, close on component unmount
- **Browser autoplay policy**: AudioContext may be in "suspended" state. Call `audioContext.resume()` on user gesture (click)

### 4.6 Tests

- `useCrossfadePreview` — mock AudioContext, verify gain curve computation
- Gain curve math functions — unit test each curve type
- Integration: manual testing with actual audio files

---

## Phase 5 — Region Selection (Deferred)

**Goal**: Click-drag to select a time range on a track.
**Estimated effort**: 4-5 hours
**Depends on**: Phase 1 (drag infrastructure)
**Priority**: Lower — ship after Phases 1-4

### 5.1 Add selection state to timelineStore

```typescript
activeSelection: {
  songId: string
  start: number   // Seconds
  end: number     // Seconds
} | null

setActiveSelection: (sel: TimelineState['activeSelection']) => void
clearActiveSelection: () => void
```

### 5.2 Create `useRegionSelection` hook

**File**: `src/renderer/components/features/timeline/hooks/useRegionSelection.ts`

Handles the drag-to-select gesture:

- `onPointerDown` + `onPointerMove` + `onPointerUp`
- Activates after 5px horizontal movement (distinguishes from click-to-play)
- Computes start/end timestamps from pointer positions
- Applies snap-to-beat on selection edges when active
- Selection is per-track only

### 5.3 Create `RegionSelection` component

**File**: `src/renderer/components/features/timeline/RegionSelection.tsx`

```typescript
interface RegionSelectionProps {
  start: number // Seconds
  end: number // Seconds
  pixelsPerSecond: number
  trackHeight: number
  trimStart: number
  onTrimToSelection: () => void
  onPlaySelection: () => void
  onClear: () => void
}
```

Renders:

1. Blue-tinted highlight overlay over the selected waveform region
2. Floating toolbar (above the selection) with three buttons:
   - **Trim to selection** → sets trimStart/trimEnd
   - **Play selection** → plays just that range
   - **Clear** → removes selection

### 5.4 Gesture disambiguation

Three gesture patterns on waveform:

- **Click (no movement)**: Play from clicked position (existing)
- **Double-click**: Open cue point popover (existing)
- **Click + drag > 5px**: Region selection (new)

In `TimelineLayout.tsx`, update track `onPointerDown` → use the drag threshold to determine if it's a click or a selection drag. Only fire `onClick` (play) if the pointer didn't move.

### 5.5 Selection constraints

- One active selection at a time
- Selection is per-track (cannot span multiple tracks)
- Clicking outside the selection clears it
- Minimum region size: 0.5s
- Selection edges clamp to track bounds (trimStart → trimEnd or 0 → duration)

---

## Phase Summary

| Phase | Feature                                 | Effort | Dependencies |
| ----- | --------------------------------------- | ------ | ------------ |
| 1     | Drag infra + trim handles               | 4-6 hr | None         |
| 2     | Draggable cue points                    | 3-4 hr | Phase 1      |
| 3     | Crossfade curves + curve type selector  | 6-8 hr | None         |
| 4     | Crossfade preview (Web Audio API)       | 6-8 hr | Phase 3      |
| 5     | Region selection (deferred)             | 4-5 hr | Phase 1      |
| ~~6~~ | ~~Beat grid toggle~~ — **already done** | —      | —            |

**Recommended order**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phases 1-2 (drag) and Phase 3 (curves) are independent and could be developed in parallel.

**Total estimated effort**: 23-31 hours

---

## Data Model Changes Summary

### Song (project.types.ts)

| Field                | Type                 | Change  | Default    |
| -------------------- | -------------------- | ------- | ---------- |
| `crossfadeCurveType` | `CrossfadeCurveType` | **New** | `'linear'` |

### timelineStore

| Field             | Type                                             | Change  | Default |
| ----------------- | ------------------------------------------------ | ------- | ------- |
| `dragState`       | `{ type, songId, startX, initialValue } \| null` | **New** | `null`  |
| `activeSelection` | `{ songId, start, end } \| null`                 | **New** | `null`  |

### FilterGraphBuilder (TrackInfo)

| Field                | Type                 | Change  | Default    |
| -------------------- | -------------------- | ------- | ---------- |
| `crossfadeCurveType` | `CrossfadeCurveType` | **New** | `'linear'` |

---

## Risk Assessment

| Risk                                       | Impact | Mitigation                                                 |
| ------------------------------------------ | ------ | ---------------------------------------------------------- |
| Drag jank on low-end machines              | Medium | Use `requestAnimationFrame` for visual updates during drag |
| Click vs drag ambiguity on touchpads       | Low    | 3px threshold tested; standard UX pattern                  |
| Web Audio decodeAudioData memory for FLAC  | Medium | Only decode ~30s segments, not full files                  |
| AudioContext autoplay policy               | Low    | Resume on user gesture (preview button click)              |
| Large audio file IPC for preview           | High   | Depends on PERFORMANCE_ANALYSIS.md #1 (`protocol.handle`)  |
| FFmpeg curve params not matching Web Audio | Medium | Unit test both implementations with same input curves      |

---

**Last Updated**: 2026-02-22
