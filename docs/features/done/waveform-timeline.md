# Feature: Waveform Timeline

## Overview

Interactive waveform timeline editor as a dedicated tab in ProjectOverview. Visualizes the full mix arrangement with real audio waveforms, BPM-synced beat grids, draggable crossfade zones, user-placed cue points with trim boundaries, and integrated playback with a moving playhead. This is Phase 2 of the audio mix export feature — building on the existing export pipeline (FFmpeg rendering, loudnorm, .cue sheet generation).

## User Problem

The MixTab tracklist is a flat list of songs with numeric crossfade inputs — users can't _see_ their mix. They can't visualize how tracks overlap, where transitions happen relative to musical structure, or whether crossfade points land on beats. For longer mixes (1–2 hours), this makes arranging transitions guesswork. Users need a visual, interactive timeline to plan and refine their mix before export.

## User Stories

- As a DJ, I want to see waveforms of all tracks laid out on a timeline so I can visually verify my mix arrangement before exporting
- As a mix curator, I want to click a crossfade zone and adjust its duration with a slider so I can fine-tune transitions visually
- As a DJ, I want to see a beat grid overlay on each track's waveform so I can align crossfade points to beats
- As a mix curator, I want to place cue points on tracks to mark structural sections (drop, breakdown, outro) and use them as trim boundaries
- As a user, I want to set start/end trim points on tracks so I can skip intros or cut outros without editing the source files
- As a DJ, I want to snap cue points and crossfade edges to beats so my transitions are rhythmically precise
- As a user, I want to click anywhere on the timeline to start playback from that point so I can audition transitions in context
- As a user, I want per-track format/bitrate info visible on the timeline so I can spot quality mismatches at a glance

## Proposed UX Flow

### Entry Point

New **"Timeline"** tab in ProjectOverview, after the Mix tab: `[Search] [Torrent] [Mix] [Timeline]`

The tab is accessible once the project has at least one song. A badge or indicator shows when waveforms are still loading.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Search] [Torrent] [Mix] [Timeline]                     │
├─────────────────────────────────────────────────────────┤
│ ┌─ Minimap ──────────────────────────────────────────┐  │
│ │ [████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒] │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌─ Toolbar ──────────────────────────────────────────┐  │
│ │ [−] [━━━━●━━━━━] [+]  │ Snap: [off|beat]  │ 45:32 │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌─ Waveform Area (scrollable, zoomable) ─────────────┐  │
│ │  Time ruler                                         │  │
│ │  00:00    05:00    10:00    15:00    20:00          │  │
│ │  ┌──────────────┐                                   │  │
│ │  │ Track A ~~~~ │╲╲╲┌──────────────────┐            │  │
│ │  │ 320k FLAC    │   │ Track B ~~~~~~~~ │╲╲╲┌──────  │  │
│ │  └──────────────┘   │ 256k MP3         │   │ C ~~   │  │
│ │    ▽ intro  ▽ drop  └──────────────────┘   └──────  │  │
│ │  │ │ │ │ │ │ │ │ │  │ │ │ │ │ │ │ │ │ │  beat grid │  │
│ │       ▼ playhead                                    │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌─ Track Detail Panel ───────────────────────────────┐  │
│ │ Selected: Track B │ 128 BPM │ 256k MP3 │ 06:32     │  │
│ │ Cue points: [intro 00:00] [drop 01:15] [outro 5:48]│  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. User navigates to the **Timeline** tab
2. Waveform data loads lazily — tracks appear as placeholders, then fill in with real waveforms as FFmpeg extracts peaks (cached to disk for subsequent visits)
3. BPM detection runs per-track (also cached) — beat grid lines appear on waveforms once detected
4. User sees the full mix timeline: tracks laid out horizontally with crossfade overlap zones highlighted between adjacent tracks
5. **Zoom/pan**: Ctrl+scroll to zoom, horizontal scroll to pan. Minimap at top shows full overview with viewport indicator
6. **Crossfade editing**: User clicks a crossfade overlap zone → popover appears with a slider (0–30s) and numeric input. Adjusting updates the visual overlap in real-time and persists to project.json
7. **Cue points**: User double-clicks on a track's waveform → a cue point is placed at that timestamp. A popover lets them name it and optionally mark it as "trim start" or "trim end"
8. **Trim boundaries**: When a track has trim-start and/or trim-end cue points, the waveform outside those boundaries is dimmed/grayed out. The crossfade applies from the trim boundary, not the absolute track start/end. Export respects these boundaries.
9. **Snap-to-beat**: When enabled (toggle in toolbar or hold Shift), cue point placement and crossfade edge dragging snap to the nearest beat grid line
10. **Playback**: Click anywhere on the timeline → playhead appears, AudioPlayer starts playing the corresponding track at the corresponding position. Playhead moves in real-time. Auto-advances to next track (no crossfade preview — plays tracks individually)
11. **Track info**: Format badge (e.g., "320k FLAC") overlaid on each waveform block. Hover for full tooltip (format, bitrate, sample rate, channels, duration, file size)
12. **Track selection**: Click a track to select it → detail panel at bottom shows full metadata and cue point list

### Key Screens / States

- **Loading state**: Waveform placeholders (skeleton bars) while FFmpeg extracts peaks. Progress indicator per track. "Generating waveforms..." message.
- **Empty state**: No songs in project — "Add songs in the Mix tab to see the timeline" message with link to Mix tab.
- **Normal state**: Full timeline with waveforms, crossfade zones, beat grid, cue points. Toolbar with zoom/snap controls.
- **Playback state**: Animated playhead moving across timeline. Current track highlighted. AudioPlayer bar at bottom synced.
- **Crossfade popover**: Appears on click of overlap zone. Slider + numeric input. "Reset to default" link. Auto-closes on click outside.
- **Cue point popover**: Appears on double-click or when editing existing cue point. Name input, type selector (marker / trim-start / trim-end), delete button.

## Data Model Changes

### Modified: Song (in project.json songs[])

| Field               | Type                      | Description                                                                                  |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `crossfadeDuration` | `number \| undefined`     | _(existing)_ Crossfade duration in seconds into the NEXT track                               |
| `cuePoints`         | `CuePoint[] \| undefined` | User-placed markers on the track timeline                                                    |
| `bpm`               | `number \| undefined`     | Detected BPM. Cached after first detection. `undefined` = not yet analyzed                   |
| `firstBeatOffset`   | `number \| undefined`     | Seconds from track start to first detected downbeat. Used to align beat grid                 |
| `trimStart`         | `number \| undefined`     | Effective start time in seconds (derived from trim-start cue point). `undefined` = 0         |
| `trimEnd`           | `number \| undefined`     | Effective end time in seconds (derived from trim-end cue point). `undefined` = full duration |

### New: CuePoint

| Field       | Type                                     | Description                                                                     |
| ----------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `id`        | `string`                                 | Unique ID (nanoid)                                                              |
| `timestamp` | `number`                                 | Position in seconds from track start                                            |
| `label`     | `string`                                 | User-provided name (e.g., "drop", "breakdown")                                  |
| `type`      | `'marker' \| 'trim-start' \| 'trim-end'` | Purpose of the cue point. Only one trim-start and one trim-end allowed per song |

### New: WaveformCache (persisted to disk)

| Field        | Type       | Description                                                             |
| ------------ | ---------- | ----------------------------------------------------------------------- |
| `songId`     | `string`   | Reference to song                                                       |
| `peaks`      | `number[]` | Normalized amplitude peaks (0–1), downsampled to ~2000 points per track |
| `duration`   | `number`   | Source file duration in seconds                                         |
| `sampleRate` | `number`   | Source sample rate (for cache invalidation)                             |
| `fileHash`   | `string`   | Quick hash of file (size + mtime) for cache invalidation                |

Stored as JSON files in `<project>/assets/waveforms/<songId>.json`. Lazy-loaded when Timeline tab opens.

### New: BpmCache (persisted to disk)

| Field             | Type     | Description                |
| ----------------- | -------- | -------------------------- |
| `songId`          | `string` | Reference to song          |
| `bpm`             | `number` | Detected BPM               |
| `firstBeatOffset` | `number` | Seconds to first downbeat  |
| `confidence`      | `number` | Detection confidence (0–1) |
| `fileHash`        | `string` | For cache invalidation     |

Stored alongside waveform cache: `<project>/assets/waveforms/<songId>.bpm.json`

## Technical Approach

### Waveform Extraction

- FFmpeg command: `ffmpeg -i <file> -ac 1 -ar 8000 -f f32le pipe:1`
- Collect stdout as Buffer → Float32Array → downsample to ~2000 peaks (max absolute value per window) → normalize to 0–1 range
- ~1–2s per track. Results cached to disk as JSON

### BPM Detection

Two viable approaches (to be evaluated during implementation):

**Option A: FFmpeg + aubio** (if available)

- Use `aubio tempo` CLI or the `aubio` npm package for beat tracking
- Accurate but adds a dependency

**Option B: Web Audio API / custom DSP**

- Run onset detection + autocorrelation on the extracted PCM data in the main process
- No extra dependency but less accurate for complex material

**Option C: FFmpeg spectral analysis**

- `ffmpeg -i <file> -af "aresample=44100,atempo=1" -f f32le pipe:1` + custom autocorrelation
- Middle ground — uses existing FFmpeg infrastructure

Recommended: evaluate Option A first (aubio), fall back to Option C. Persist BPM + firstBeatOffset + confidence to disk.

### Beat Grid Rendering

- From `bpm` and `firstBeatOffset`, compute beat timestamps: `firstBeatOffset + n * (60 / bpm)` for each beat within the visible range
- Render as thin vertical lines on the waveform canvas
- Downbeats (every 4th beat, assuming 4/4) rendered slightly thicker/brighter
- Only render beats visible in the current viewport (performance optimization for long tracks)

### Snap-to-Beat

- When snap mode is active, round timestamp to nearest beat: `round((t - firstBeatOffset) * bpm / 60) * 60 / bpm + firstBeatOffset`
- Applied to: cue point placement (double-click), crossfade edge adjustment
- Visual feedback: a "magnet" indicator when snapping occurs

### Timeline Rendering

- Use `<canvas>` for waveform rendering (performance: many thousands of bars)
- Layout engine calculates track positions accounting for trimmed durations and crossfade overlaps:
  - Track effective duration = `(trimEnd ?? duration) - (trimStart ?? 0)`
  - Track start position = previous track end position - crossfade duration
- Minimap: separate small canvas with simplified waveforms (fewer peaks), viewport rectangle draggable
- Time ruler: render tick marks + labels based on zoom level (adaptive: show seconds at high zoom, minutes at low zoom)

### Trim Integration with Export

- When `trimStart` or `trimEnd` is set on a song, the FFmpeg filter graph must:
  - Add `atrim=start=<trimStart>:end=<trimEnd>` before the loudnorm filter for that track
  - Adjust duration calculations for crossfade clamping and progress estimation
- CUE sheet timestamps must account for trimmed durations
- The existing `FilterGraphBuilder` and `CueSheetGenerator` need modification

### Cue Points in CUE Sheet

- All cue points (not just trim boundaries) are written as `INDEX` entries in the .cue output
- Track boundaries remain as `INDEX 01` (start of each track)
- User cue points become `INDEX 02`, `INDEX 03`, etc. within their parent track
- Cue point labels are written as `REM COMMENT` before the index

### Playback Integration

- Click on timeline → determine which track and at what timestamp
- Call `audioPlayerStore.playTrack(song, seekTo)` (new action needed on audioPlayerStore)
- AudioPlayer reports `currentTime` → timeline maps it to playhead position using track offsets
- Playhead rendered as a vertical line on the canvas, animated via `requestAnimationFrame`
- When playback reaches end of a track, auto-advance to next track at its effective start (trimStart)

### IPC Channels (New)

| Channel                       | Direction       | Purpose                                                                             |
| ----------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| `mix:waveform:generate`       | renderer → main | Request waveform peaks for a song. Returns cached data or extracts fresh            |
| `mix:waveform:generate-batch` | renderer → main | Request waveforms for all songs in project. Processes sequentially, streams results |
| `mix:bpm:detect`              | renderer → main | Request BPM detection for a song. Returns cached or runs analysis                   |
| `mix:bpm:detect-batch`        | renderer → main | Batch BPM detection for all songs                                                   |

Progress for batch operations can be pushed via `mix:waveform:progress` and `mix:bpm:progress`.

## Edge Cases & Error States

- **Missing audio file**: Track shown as empty placeholder with "File missing" label. No waveform, no BPM. Cue points still editable (they're timestamps, not dependent on file).
- **Very short tracks (< 5s)**: Beat grid may not have enough data for reliable BPM. Show "BPM: unknown" with low confidence indicator.
- **BPM detection failure**: Some tracks (ambient, spoken word) may not have a detectable BPM. Show "No beat detected" — beat grid hidden for that track, snap-to-beat disabled.
- **Trim start >= trim end**: Prevent via UI — trim-end cue point must be after trim-start. If violated, show warning and ignore trim.
- **Trim makes effective duration < crossfade**: Clamp crossfade to effective duration - 1s. Show warning on the crossfade zone.
- **Multiple trim-start cue points**: Only one trim-start and one trim-end per song. Placing a second replaces the first (with confirmation).
- **Waveform extraction fails**: Show error state on that track's waveform area. Other tracks unaffected. Retry button.
- **Large project (20+ tracks)**: Batch waveform generation with progress. Lazy-load waveforms as they scroll into viewport. Minimap uses simplified data.
- **Zoom extremes**: Minimum zoom = full mix fits in view. Maximum zoom = ~1 second per screen width (individual waveform bars visible).
- **Playback of trimmed tracks**: AudioPlayer seeks to trimStart, stops at trimEnd (or let the player handle naturally with visual indication of active range).
- **Reorder in MixTab while Timeline open**: Timeline reflects new order immediately (recalculate positions). Waveform data doesn't change, only layout.

## Acceptance Criteria

- [x] Timeline tab appears in ProjectOverview with waveform visualization of all tracks
- [x] Real audio waveforms are displayed (not decorative random bars)
- [x] Waveform data is cached to disk (`assets/waveforms/`) and loaded lazily
- [x] Format badge (e.g., "320k FLAC") visible on each track's waveform segment
- [x] Hover tooltip shows full track metadata (format, bitrate, sample rate, channels, duration, size)
- [x] Crossfade overlap zones visually highlighted between adjacent tracks
- [x] Click on crossfade zone opens popover with duration slider (0–30s) — changes persist to project.json
- [x] BPM detected per track with beat grid lines rendered on waveform
- [x] Beat grid lines align to detected beats, with downbeats visually distinct
- [x] Snap-to-beat mode available (toolbar toggle or Shift key) for cue point placement and crossfade adjustment
- [x] Double-click on waveform places a cue point with label and type (marker / trim-start / trim-end)
- [x] Trim-start and trim-end cue points dim the waveform outside the active range
- [x] Export pipeline respects trim boundaries (atrim filter in FFmpeg, adjusted CUE timestamps)
- [x] User cue points written into .cue sheet as additional INDEX entries
- [x] Minimap at top shows full mix overview with draggable viewport indicator
- [x] Zoom via Ctrl+scroll and toolbar controls; horizontal scroll to pan
- [x] Click anywhere on timeline starts playback at that position with moving playhead
- [x] Playhead syncs with AudioPlayer and auto-advances between tracks
- [x] Track detail panel shows metadata and cue point list for selected track
- [x] Waveform loading shows progress (skeleton → filled waveform per track)
- [x] Works with 20+ tracks without noticeable lag

## Open Questions

- **BPM detection library**: aubio vs custom DSP vs FFmpeg-based approach — needs prototyping to evaluate accuracy vs dependency cost
- **Crossfade curve preview**: Should the overlap zone visually show the fade-in/fade-out curves (triangular, equal-power), or just the overlap region? (Visual nicety, not blocking)
- **Beat grid manual adjustment**: If BPM detection is slightly off, should the user be able to manually tap-correct the BPM or nudge the grid offset? (Could be deferred to a later phase)
- **Playback across crossfades**: Current AudioPlayer plays one track at a time. True crossfade preview would require simultaneous playback of two tracks with volume automation — is this in scope or deferred?

## Out of Scope

- EQ, effects, or filters on individual tracks
- Per-track volume/gain automation curves (auto-normalize only)
- Streaming the rendered mix
- Full automatic beat-sync (auto-align crossfade points based on BPM matching)
- Tempo adjustment / time-stretching to match BPMs between tracks
- Waveform editing (cut, split, reverse)
- Multi-row timeline (all tracks on a single horizontal lane with overlaps)

## Dependencies

- Existing: MixTab tracklist, Song entity, MixMetadata, AudioPlayer, project.json persistence
- Existing: FFmpeg infrastructure (ffmpegPath, ffmpegRunner, MixExportService)
- Existing: IPC progress pattern, mixExportStore
- New: BPM detection library (TBD — aubio or custom)
- Modified: FilterGraphBuilder (add atrim support for trim boundaries)
- Modified: CueSheetGenerator (add user cue point INDEX entries)
- Modified: audioPlayerStore (add seekTo support for timeline click-to-play)
