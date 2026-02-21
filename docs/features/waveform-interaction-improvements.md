# Feature: Waveform Interaction Improvements

## Overview

Upgrade the timeline editing experience with drag-to-trim handles, draggable cue points, crossfade curve visualization, region selection, and crossfade preview playback — making the timeline feel like a real mix editor, not just a viewer.

## User Problem

Currently, all timeline editing goes through popovers: cue points are placed via double-click + popover, trim boundaries via cue point type, and crossfade durations via click + slider. This is functional but indirect. Users expect to grab and drag elements directly on the waveform — that's how every DAW and DJ tool works. Additionally, there's no way to hear how a crossfade actually sounds without exporting the full mix.

## User Stories

- As a DJ, I want to drag trim handles on the waveform edges to set start/end points quickly
- As a user, I want to drag cue point markers to reposition them without reopening the popover
- As a DJ, I want to see the actual crossfade curves (fade-in/fade-out) in the overlap zone
- As a user, I want to select a region of the waveform for trimming or focused playback
- As a DJ, I want to preview how a crossfade sounds with both tracks mixed together before exporting
- As a user, I want to toggle beat grid visibility on and off

## Improvements

### 1. Drag-to-Trim Handles

Add draggable handles at the left (trim-start) and right (trim-end) edges of each track's waveform. Dragging these handles adjusts the trim boundaries in real-time.

**Visual design:**

```
           drag handle (left)                  drag handle (right)
                ┃                                      ┃
  dimmed region ┃  active waveform region              ┃ dimmed region
  ░░░░░░░░░░░░░┃██████████████████████████████████████┃░░░░░░░░░░░░░
                ┃                                      ┃
```

- Handles: 8px-wide vertical bars at the trim boundaries, with a subtle grip texture (3 horizontal lines)
- Cursor changes to `col-resize` on hover
- Drag updates `trimStart` / `trimEnd` in real-time (debounced persist, 300ms)
- Snap-to-beat applies during drag when snap mode is active
- Dimmed overlay updates instantly as handle moves
- If no trim is set yet, handles appear at the track's absolute start/end — dragging inward creates the trim

**Constraints during drag:**

- `trimStart` cannot pass `trimEnd` (minimum 1s gap)
- `trimEnd` cannot go before `trimStart`
- Neither can extend beyond the track's actual duration
- If trim makes effective duration < crossfade to neighbor, show a warning indicator

### 2. Draggable Cue Points

Make existing cue point markers draggable along the horizontal axis of their track.

**Behavior:**

- Hover on cue point marker → cursor changes to `grab`
- Mouse down + move → marker follows cursor horizontally, vertical line moves with it
- Snap-to-beat applies during drag if snap mode active
- On release: persist new timestamp (debounced)
- If cue point is type `trim-start` or `trim-end`: updating its position also updates `trimStart`/`trimEnd` and the trim overlay re-renders

**Constraints:**

- `trim-start` cannot be dragged past `trim-end`
- Markers cannot be dragged outside the track's time range
- Click without drag still opens the cue point edit popover (distinguish via drag threshold: 3px movement)

### 3. Crossfade Curve Visualization

Replace the flat semi-transparent overlap box with a visual representation of the actual crossfade curves (fade-out of track A, fade-in of track B).

**Visual design:**

```
Track A                    Track B
████████████████╲         ╱████████████████
                 ╲       ╱
                  ╲     ╱
                   ╲   ╱
                    ╲ ╱
```

- Two curves rendered in the overlap zone: fade-out (descending) and fade-in (ascending)
- Curve type matches the export crossfade algorithm (equal-power, linear, or S-curve — whatever the export uses)
- The area under each curve is filled with the respective track's color at reduced opacity
- The overlap region background remains slightly highlighted to show it's interactive (clickable for the crossfade popover)

**Implementation:**

- Draw two `Path2D` curves in the overlap region of the canvas
- Use `quadraticCurveTo` for S-curve appearance (equal-power crossfade)
- Fill below/above with respective track colors at 20% opacity
- The curves update in real-time when crossfade duration changes via the slider

### 4. Region Selection

Allow click-and-drag on the waveform to select a time range within a track.

**Behavior:**

1. Mouse down + horizontal drag on waveform → selection rectangle appears (highlighted region)
2. On release: selection anchored. Shows a floating toolbar with actions:
   - **Trim to selection** — sets `trimStart` and `trimEnd` to the selected range
   - **Play selection** — plays just the selected audio range
   - **Clear selection** — removes the highlight
3. Selection rendered as a blue-tinted highlight over the waveform
4. Clicking outside the selection clears it
5. Snap-to-beat applies to selection edges when snap mode active

**Distinguishing from click-to-play and double-click-to-cue:**

- **Click (no drag):** Play from clicked position
- **Double-click:** Open cue point popover
- **Click + drag > 5px:** Region selection
- These are standard gesture patterns — no ambiguity

**Selection constraints:**

- Selection is per-track (can't span multiple tracks)
- Only one active selection at a time

### 5. Crossfade Preview Playback

Allow users to hear how a crossfade sounds with both tracks mixed, without exporting the full mix.

**Two modes:**

#### Mode A: Quick Preview (Web Audio API)

- Click a "Preview" button on the crossfade popover (or a play icon on the overlap zone)
- Load both tracks into Web Audio API `AudioBufferSourceNode`s
- Apply gain automation matching the crossfade curve (equal-power, linear, etc.)
- Start playback ~10s before the crossfade starts on Track A, play through the crossfade, stop ~5s into Track B
- Real-time, no rendering step

**Implementation:**

```
AudioContext
├─ Source A (Track A) → GainNode A (fade-out automation) → Destination
└─ Source B (Track B) → GainNode B (fade-in automation)  → Destination
```

- `GainNode.gain.setValueCurveAtTime()` for the crossfade envelope
- Uses the same crossfade algorithm parameters as the export pipeline
- Loads audio from disk via IPC (`audio.readFile`)

#### Mode B: Rendered Preview (FFmpeg)

- "Render preview" button in the crossfade popover
- Uses the existing export pipeline's `FilterGraphBuilder` to render just the crossfade segment (Track A tail + Track B head) to a temp file
- Plays the temp file via the standard AudioPlayer
- More accurate (exact FFmpeg result) but takes a few seconds to render

**UI for crossfade preview:**

```
┌─ Crossfade: Track A → Track B ──────────────┐
│                                               │
│  Duration: [━━━━━━●━━━━] 8.0s                │
│                                               │
│  ▶ Quick preview    │  🔄 Render exact preview │
│                                               │
│  Curve: [equal-power ▾]                       │
│                                               │
└───────────────────────────────────────────────┘
```

### 6. Beat Grid Visibility Toggle

Add a toggle in ZoomControls to show/hide the beat grid overlay.

**Current:** Beat grid always visible when BPM is detected.
**Proposed:** Toggle button: `♪ Beat grid [on|off]`. Persisted in `timelineStore.showBeatGrid`.

## Data Model Changes

### Modified: timelineStore

| Field             | Type                                                                                          | Description                                           |
| ----------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `showBeatGrid`    | `boolean`                                                                                     | **New.** Toggle beat grid visibility. Default: `true` |
| `activeSelection` | `{ songId: string, start: number, end: number } \| null`                                      | **New.** Currently selected time range                |
| `dragState`       | `{ type: 'trim-start' \| 'trim-end' \| 'cue-point', songId: string, startX: number } \| null` | **New.** Active drag operation tracking               |

### Modified: Song (via crossfade popover — no new persistent fields)

No new persistent fields. All interaction state is transient (in Zustand store).

## Edge Cases & Error States

- **Drag near track edges:** Clamp handles to valid range (0 to duration). Prevent overshoot.
- **Drag cue point past trim boundary:** For trim-type cue points, enforce ordering. For markers, allow free positioning within track bounds.
- **Region selection on short tracks (< 3s):** Allow selection but minimum region size is 0.5s.
- **Crossfade preview with missing audio files:** Disable preview buttons, show "Audio file missing" tooltip.
- **Crossfade preview with incompatible formats:** Web Audio API can handle MP3/FLAC/WAV/OGG/AAC natively. For others, fall back to rendered preview only.
- **Large audio files for Web Audio preview:** Loading full tracks into AudioBuffer is memory-heavy. Only load the relevant segments (±15s around the crossfade point).
- **Rendered preview fails (FFmpeg error):** Show toast with error, suggest quick preview as fallback.

## Acceptance Criteria

- [ ] Trim handles appear at track edges; dragging them updates trim boundaries in real-time
- [ ] Trim handles snap to beats when snap mode is active
- [ ] Cue point markers are draggable along the track timeline
- [ ] Dragging a trim-type cue point updates the trim overlay
- [ ] Click vs drag distinction works reliably (click = play, drag = trim/select)
- [ ] Crossfade curves visible in overlap zones matching the actual fade algorithm
- [ ] Crossfade curves update when duration changes
- [ ] Region selection via click-and-drag highlights a time range
- [ ] Selection toolbar offers trim-to-selection, play selection, and clear
- [ ] Quick crossfade preview plays both tracks mixed via Web Audio API
- [ ] Rendered crossfade preview produces an accurate FFmpeg-rendered segment
- [ ] Beat grid toggle shows/hides beat lines
- [ ] All drag operations respect snap-to-beat when enabled

## Out of Scope

- Drag to reorder tracks (reordering stays in MixTab)
- Vertical drag (volume automation)
- Multi-track selection
- Undo/redo for drag operations (future feature)
- Custom crossfade curve types (future — currently uses whatever the export pipeline uses)

## Dependencies

- Existing: AudioPlayer, audioPlayerStore, WaveformCanvas, CuePointMarker, TrimOverlay, CrossfadePopover
- Existing: FilterGraphBuilder (for rendered preview)
- Existing: audio IPC handlers (`audio.readFile` for Web Audio loading)
- New: Web Audio API integration for crossfade preview (renderer-side only, no IPC needed)
