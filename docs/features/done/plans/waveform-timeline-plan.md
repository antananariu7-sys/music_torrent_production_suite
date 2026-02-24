# Waveform Timeline — Implementation Plan

## Context

Phase 2 of the audio mix export feature. The export pipeline (FFmpeg rendering, crossfades, loudnorm, .cue sheet) is fully built. Users need a visual, interactive timeline to see their mix arrangement, edit crossfade zones, place cue points with trim boundaries, visualize beat grids, and preview playback — all in a dedicated Timeline tab.

Full spec: `docs/features/waveform-timeline.md`

---

## Phase 1: Data Model + Types + IPC Channels

**Goal:** Lay the type foundation — CuePoint, WaveformData, BPM types. Extend Song with new fields. Register IPC channels.

### New files

| File                                    | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `src/shared/types/waveform.types.ts`    | `CuePoint`, `WaveformData`, `BpmData`, `WaveformRequest`, `BpmRequest` types |
| `src/shared/schemas/waveform.schema.ts` | Zod schemas for IPC validation: `WaveformRequestSchema`, `CuePointSchema`    |

### Modify

| File                                | Change                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts` | Add to `Song` (after line 37): `cuePoints?: CuePoint[]`, `bpm?: number`, `firstBeatOffset?: number`, `trimStart?: number`, `trimEnd?: number`                                                                                                                                |
| `src/shared/types/index.ts`         | Re-export `waveform.types`                                                                                                                                                                                                                                                   |
| `src/shared/constants.ts`           | Add IPC channels after line 99: `WAVEFORM_GENERATE: 'waveform:generate'`, `WAVEFORM_GENERATE_BATCH: 'waveform:generate-batch'`, `WAVEFORM_PROGRESS: 'waveform:progress'`, `BPM_DETECT: 'bpm:detect'`, `BPM_DETECT_BATCH: 'bpm:detect-batch'`, `BPM_PROGRESS: 'bpm:progress'` |

### Key details

**CuePoint type:**

```ts
interface CuePoint {
  id: string // nanoid
  timestamp: number // seconds from track start
  label: string // user-provided name
  type: 'marker' | 'trim-start' | 'trim-end'
}
```

**WaveformData type:**

```ts
interface WaveformData {
  songId: string
  peaks: number[] // normalized 0–1, ~2000 points
  duration: number // seconds
  sampleRate: number // source sample rate
  fileHash: string // size + mtime for cache invalidation
}
```

**BpmData type:**

```ts
interface BpmData {
  songId: string
  bpm: number
  firstBeatOffset: number // seconds to first downbeat
  confidence: number // 0–1
  fileHash: string
}
```

**Song field semantics:**

- `trimStart` / `trimEnd` are derived from the trim-start/trim-end cue points and stored as top-level fields for quick access by the export pipeline. They're updated whenever cue points change.
- `bpm` / `firstBeatOffset` are cached analysis results. Set by BPM detection, persisted in project.json so detection doesn't re-run.

### Verify

- `yarn build` passes with new types
- Existing tests still pass (`yarn test:main`)

---

## Phase 2: Waveform Extraction Service

**Goal:** Extract real audio peaks via FFmpeg, cache to disk, serve via IPC.

### New files

| File                                                   | Purpose                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/WaveformExtractor.ts`      | FFmpeg → mono f32le PCM → downsample to peaks → normalize. Disk cache read/write in `<project>/assets/waveforms/` |
| `src/main/services/waveform/WaveformExtractor.spec.ts` | Tests: peak computation from raw PCM buffer, cache hit/miss, file hash invalidation                               |
| `src/main/services/waveform/index.ts`                  | Re-exports                                                                                                        |
| `src/main/ipc/waveformHandlers.ts`                     | IPC handlers for `WAVEFORM_GENERATE`, `WAVEFORM_GENERATE_BATCH`. Batch handler broadcasts progress per track      |

### Modify

| File                    | Change                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc/index.ts` | Import `WaveformExtractor`, instantiate with `projectService` (after line 69), call `registerWaveformHandlers()`, add cleanup |
| `src/preload/index.ts`  | Add `waveform: { generate(songId, filePath), generateBatch(projectId), onProgress(cb) }` namespace (after line 348)           |

### Key details

**FFmpeg command:**

```
ffmpeg -i <file> -ac 1 -ar 8000 -f f32le pipe:1
```

- Outputs mono float32 PCM at 8kHz to stdout
- Collect as Buffer → `new Float32Array(buffer.buffer)`
- Downsample to ~2000 peaks: split into windows of `totalSamples / 2000`, take `Math.max(Math.abs(...))` per window
- Normalize: divide all peaks by global max

**Disk cache:**

- Path: `<projectDir>/assets/waveforms/<songId>.json`
- Contains: `WaveformData` as JSON
- Cache key: `fileHash = "${stat.size}-${stat.mtimeMs}"` — if file changes, hash misses, recompute
- On `WAVEFORM_GENERATE`: check disk cache first → return if hit → extract if miss → write cache → return
- On `WAVEFORM_GENERATE_BATCH`: iterate all songs sequentially, emit `WAVEFORM_PROGRESS` per track (`{ songId, index, total }`)

**Performance:** ~1–2s per track at 8kHz mono. For a 20-track project, ~30s total. Batch operation runs in background, results stream to renderer.

### Verify

- `yarn test:main --testPathPatterns WaveformExtractor` — peak computation tests pass
- Manual: call `window.api.waveform.generate(songId, filePath)` → returns peaks array
- Verify `.json` file written to `assets/waveforms/`
- Second call returns instantly from cache

---

## Phase 3: BPM Detection Service

**Goal:** Detect BPM and first-beat offset per track. Cache to disk. Render beat grid in later phase.

### New files

| File                                             | Purpose                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/BpmDetector.ts`      | BPM detection via onset detection + autocorrelation on PCM data. Caches to `<project>/assets/waveforms/<songId>.bpm.json` |
| `src/main/services/waveform/BpmDetector.spec.ts` | Tests: known-BPM test files, confidence thresholds, edge cases (ambient/no-beat)                                          |
| `src/main/ipc/bpmHandlers.ts`                    | IPC handlers for `BPM_DETECT`, `BPM_DETECT_BATCH`                                                                         |

### Modify

| File                                | Change                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/main/ipc/index.ts`             | Import and register `bpmHandlers`                                                         |
| `src/preload/index.ts`              | Add `bpm: { detect(songId, filePath), detectBatch(projectId), onProgress(cb) }` namespace |
| `src/shared/types/project.types.ts` | Ensure `bpm` and `firstBeatOffset` on Song are persisted to project.json after detection  |

### Key details

**Approach — evaluate in order:**

1. **Option A: `aubio` npm package** — if it has a usable Node binding, best accuracy. Install via `yarn add aubio` and test.
2. **Option B: FFmpeg spectral + custom autocorrelation** — extract PCM via existing FFmpeg infra, run onset detection (energy-based) + autocorrelation in pure JS/TS. No new dependency. Less accurate on complex material but good enough for electronic/DJ music.
3. **Option C: Web Audio OfflineAudioContext** — not available in main process (no Web Audio API). Would need to run in renderer, which complicates caching. Avoid.

Recommended starting point: **Option B** — keeps dependencies minimal, leverages existing FFmpeg. The algorithm:

1. Extract PCM at 44.1kHz mono via FFmpeg (higher rate than waveform for accuracy)
2. Compute onset strength function (spectral flux or energy envelope)
3. Autocorrelation on onset function → find dominant period → BPM
4. Find first beat via onset peaks → `firstBeatOffset`
5. Confidence: strength of autocorrelation peak relative to noise floor

**Persist to Song:** After detection, call `projectService.updateSong()` to write `bpm` and `firstBeatOffset` to project.json. This avoids re-detection on subsequent sessions even if disk cache is cleared.

**Edge cases:**

- Ambient/spoken word → confidence < 0.3 → set `bpm: undefined`, return `{ bpm: null, confidence: 0.2 }`
- Very short tracks (< 10s) → may not have enough data → same low-confidence handling

### Verify

- `yarn test:main --testPathPatterns BpmDetector` — passes with test audio
- Manual: detect BPM on a known-BPM track → verify accuracy within ±2 BPM
- Verify `.bpm.json` written to disk
- Verify `bpm` field persisted in project.json

---

## Phase 4: Timeline Tab + Canvas Waveform Rendering

**Goal:** Create the Timeline tab, render real waveforms on `<canvas>`, show track layout with crossfade overlaps and info overlays.

### New files

| File                                                                 | Purpose                                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx` | Tab shell: loads waveform data, manages selection state, renders sub-components                                                |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`       | `<canvas>` component: renders peaks as mirrored vertical bars for a single track. Handles track color, selected state          |
| `src/renderer/components/features/timeline/TimelineLayout.tsx`       | Layout engine: positions tracks horizontally with crossfade overlaps. Wraps WaveformCanvas instances with absolute positioning |
| `src/renderer/components/features/timeline/TrackInfoOverlay.tsx`     | Format badge + hover tooltip on each track segment                                                                             |
| `src/renderer/components/features/timeline/TrackDetailPanel.tsx`     | Bottom panel: selected track metadata, cue point list                                                                          |
| `src/renderer/hooks/useWaveformData.ts`                              | Requests waveform data for all songs via batch IPC. Caches in local state. Triggers on song list changes                       |
| `src/renderer/store/timelineStore.ts`                                | Zustand store: `selectedTrackId`, `zoomLevel`, `scrollPosition`, `snapMode`, waveform data cache, BPM data cache               |

### Modify

| File                                           | Change                                                                                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/pages/ProjectOverview/index.tsx` | Add `'timeline'` to `TabValue` union (line 19). Add tab entry after line 51: `{ value: 'timeline', label: 'Timeline', icon: FiActivity }`. Add conditional render after line 121: `{activeTab === 'timeline' && <TimelineTab />}`. Add import |

### Key details

**Canvas rendering approach:**

- One `<canvas>` per track (not one giant canvas) — simplifies hit detection, individual track updates, and avoids canvas size limits
- Each WaveformCanvas receives: `peaks: number[]`, `width: number` (computed from duration × pixelsPerSecond × zoom), `height: number` (fixed, e.g., 80px), `color`, `isSelected`
- Draw mirrored bars: for each peak, draw a vertical line from `centerY - peak * halfHeight` to `centerY + peak * halfHeight`
- Crossfade zones: semi-transparent colored overlay drawn on top of the overlapping region of two adjacent canvases

**Layout calculation:**

```ts
function computeTrackPositions(
  songs: Song[],
  pixelsPerSecond: number
): TrackPosition[] {
  let currentOffset = 0
  return songs.map((song, i) => {
    const effectiveDuration =
      (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
    const position = {
      left: currentOffset,
      width: effectiveDuration * pixelsPerSecond,
      songId: song.id,
    }
    const crossfade =
      i < songs.length - 1 ? (song.crossfadeDuration ?? defaultCrossfade) : 0
    currentOffset += (effectiveDuration - crossfade) * pixelsPerSecond
    return position
  })
}
```

**Track info overlay:**

- Absolutely positioned over top-left corner of each track canvas
- Shows: `"320k FLAC"` or `"256k MP3"` badge using Chakra `<Badge>`
- Tooltip on hover (Chakra `<Tooltip>`): full metadata table (format, bitrate, sample rate, channels, duration, file size)

**Loading state:**

- On tab mount, `useWaveformData` fires `window.api.waveform.generateBatch(projectId)`
- Tracks with no waveform data yet show a skeleton placeholder (Chakra `<Skeleton>`)
- As each waveform arrives via progress callback, the corresponding track fills in

### Verify

- Timeline tab visible in ProjectOverview tab bar
- Waveforms render from real audio data (visually different per track)
- Crossfade overlap zones visible between tracks
- Format badges appear on each track
- Hover shows full metadata tooltip
- Loading skeletons show while waveforms generate
- `yarn build` passes

---

## Phase 5: Navigation — Zoom, Scroll, Minimap

**Goal:** Zoom in/out, horizontal scroll, minimap overview with viewport indicator, time ruler.

### New files

| File                                                         | Purpose                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/Minimap.tsx`      | Small canvas at top: simplified waveforms for all tracks. Draggable viewport rectangle. Click to jump                            |
| `src/renderer/components/features/timeline/TimeRuler.tsx`    | Horizontal ruler above waveform area. Tick marks + time labels. Adapts to zoom level (seconds at high zoom, minutes at low zoom) |
| `src/renderer/components/features/timeline/ZoomControls.tsx` | Toolbar: [−] zoom slider [+], snap toggle, total duration display                                                                |

### Modify

| File                                                                 | Change                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/store/timelineStore.ts`                                | Add `zoomLevel` (1–100, default fits-to-view), `scrollLeft` (pixels), `viewportWidth` (pixels). Actions: `setZoom`, `setScroll`, `zoomIn`, `zoomOut`, `fitToView` |
| `src/renderer/components/features/timeline/TimelineLayout.tsx`       | Add scroll container with `overflow-x: auto`. Apply zoom factor to `pixelsPerSecond`. Wire Ctrl+scroll to zoom                                                    |
| `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx` | Render Minimap, ZoomControls, TimeRuler above the waveform area                                                                                                   |

### Key details

**Zoom model:**

- `pixelsPerSecond = basePixelsPerSecond * zoomLevel`
- `basePixelsPerSecond` computed so that `totalMixDuration * basePixelsPerSecond = containerWidth` (fit-to-view)
- `zoomLevel` range: 1 (fit-to-view) to ~50 (1 second ≈ screen width)
- Ctrl+scroll: `deltaY > 0` → zoom out, `deltaY < 0` → zoom in. Zoom toward cursor position (adjust scroll to keep mouse point stable)

**Minimap:**

- Fixed width (full container width), fixed height (~30px)
- Renders all track waveforms with very few peaks (~200 total across all tracks)
- Viewport rectangle: width proportional to `viewportWidth / totalTimelineWidth`, position tracks `scrollLeft`
- Drag viewport rectangle → updates `scrollLeft` in store → main timeline scrolls
- Click on minimap → centers viewport at clicked position

**Time ruler:**

- Renders above the waveform area, scrolls with it
- Tick interval adapts: at low zoom show every 5 minutes, at medium zoom every minute, at high zoom every 10 seconds, at max zoom every second
- Labels: `MM:SS` format

### Verify

- Ctrl+scroll zooms in/out smoothly
- Zoom toolbar buttons and slider work
- Horizontal scrollbar appears when zoomed in
- Minimap shows full overview with viewport indicator
- Dragging minimap viewport scrolls the main timeline
- Time ruler labels adapt to zoom level
- "Fit to view" resets to seeing entire mix

---

## Phase 6: Interactive Editing — Crossfades, Cue Points, Trim

**Goal:** Click crossfade zones for slider popup. Double-click to place cue points. Trim boundaries dim waveform. Track detail panel.

### New files

| File                                                             | Purpose                                                                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/CrossfadePopover.tsx` | Popover with slider (0–30s, step 0.5) + numeric input. "Reset to default" link. Positioned at clicked crossfade zone |
| `src/renderer/components/features/timeline/CuePointMarker.tsx`   | Visual marker on the waveform: colored triangle/line + label. Click to edit                                          |
| `src/renderer/components/features/timeline/CuePointPopover.tsx`  | Popover for creating/editing cue point: name input, type selector (marker / trim-start / trim-end), delete button    |
| `src/renderer/components/features/timeline/TrimOverlay.tsx`      | Semi-transparent gray overlay on waveform regions outside trim boundaries                                            |

### Modify

| File                                                             | Change                                                                                                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`   | Add click handler for crossfade zones (detect if click lands in overlap region). Add double-click handler for cue point placement. Render cue point markers and trim overlays |
| `src/renderer/components/features/timeline/TrackDetailPanel.tsx` | Show cue point list for selected track with edit/delete actions                                                                                                               |
| `src/renderer/store/timelineStore.ts`                            | Add `activeCrossfadePopover: { songId, position }                                                                                                                             | null`, `activeCuePointPopover: { songId, timestamp, existingCuePoint? } | null`. Actions: `openCrossfadePopover`, `closeCrossfadePopover`, `openCuePointPopover`, `closeCuePointPopover` |
| `src/shared/types/project.types.ts`                              | Ensure `trimStart` and `trimEnd` on Song are updated when trim-type cue points are added/removed/moved                                                                        |

### Key details

**Crossfade zone hit detection:**

- The overlap region between two adjacent tracks is a known pixel range (from `TrackPosition` + crossfade duration)
- On canvas click: check if click X falls within any overlap region. If yes, open CrossfadePopover positioned at that X
- Slider change → debounced 300ms → `window.api.mix.updateSong({ crossfadeDuration: newValue })` → layout recalculates → visual update

**Cue point placement:**

- Double-click on a track's waveform → compute timestamp from click position: `timestamp = (clickX - trackPosition.left) / pixelsPerSecond + (trimStart ?? 0)`
- If snap mode active: snap to nearest beat (see Phase 7)
- Open CuePointPopover with the computed timestamp pre-filled
- On save: `window.api.mix.updateSong({ cuePoints: [...existing, newCuePoint] })`
- If type is `trim-start` or `trim-end`: also update `trimStart` / `trimEnd` on the song, and check for existing trim cue of same type (replace with confirmation)

**Trim overlay:**

- Before `trimStart`: gray semi-transparent overlay from track left edge to trimStart position
- After `trimEnd`: gray semi-transparent overlay from trimEnd position to track right edge
- Overlay drawn on the same canvas as the waveform (separate draw pass on top)

**Cue point rendering:**

- Vertical line at the marker's timestamp position
- Small triangle/flag above the waveform with the label
- Color coding: marker = blue, trim-start = green, trim-end = red

### Verify

- Click crossfade zone → popover with slider appears
- Adjust slider → overlap visually changes in real-time
- Close popover → value persisted (reopen shows saved value)
- Double-click on waveform → cue point popover appears
- Save cue point → marker visible on waveform
- Set trim-start → region before it dimmed, track layout adjusts
- Set trim-end → region after it dimmed
- Cue points listed in track detail panel
- Delete cue point from detail panel → marker removed

---

## Phase 7: Beat Grid + Snap-to-Beat

**Goal:** Render beat grid lines on waveforms, implement snap-to-beat for cue points and crossfade editing.

### New files

| File                                                     | Purpose                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/components/features/timeline/BeatGrid.tsx` | Renders vertical beat lines on a track's canvas. Downbeats (every 4th) are visually distinct. Only renders beats in visible viewport range |
| `src/renderer/hooks/useBpmData.ts`                       | Requests BPM data for all songs via batch IPC. Stores results in timelineStore. Triggers on song list changes                              |

### Modify

| File                                                             | Change                                                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`   | Integrate BeatGrid rendering pass after waveform bars. Pass `bpm`, `firstBeatOffset`, `visibleRange` |
| `src/renderer/components/features/timeline/ZoomControls.tsx`     | Add snap mode toggle: `[Snap: off                                                                    | beat]`. Show current state. Keyboard shortcut: hold Shift for temporary snap          |
| `src/renderer/store/timelineStore.ts`                            | Add `snapMode: 'off'                                                                                 | 'beat'`, `bpmDataCache: Map<songId, BpmData>`. Action: `toggleSnapMode`, `setBpmData` |
| `src/renderer/components/features/timeline/CuePointPopover.tsx`  | Apply snap when placing: if snap active, round timestamp to nearest beat                             |
| `src/renderer/components/features/timeline/CrossfadePopover.tsx` | (Minor) Show "snapped" indicator if snap mode adjusted the value                                     |

### Key details

**Beat grid computation:**

```ts
function computeBeatTimestamps(
  bpm: number,
  firstBeatOffset: number,
  startTime: number,
  endTime: number
): number[] {
  const beatInterval = 60 / bpm
  const beats: number[] = []
  // Find first beat >= startTime
  const firstBeatIndex = Math.ceil((startTime - firstBeatOffset) / beatInterval)
  for (let i = firstBeatIndex; ; i++) {
    const t = firstBeatOffset + i * beatInterval
    if (t > endTime) break
    beats.push(t)
  }
  return beats
}
```

**Rendering:**

- Normal beats: thin (1px) semi-transparent white lines
- Downbeats (every 4th from `firstBeatOffset`): 2px, slightly brighter
- Only compute and render beats within the visible viewport (performance for zoomed-out view of long tracks)
- At very low zoom (many beats per pixel), skip rendering individual beats and show a subtle pattern instead

**Snap-to-beat logic:**

```ts
function snapToNearestBeat(
  timestamp: number,
  bpm: number,
  firstBeatOffset: number
): number {
  const beatInterval = 60 / bpm
  const beatIndex = Math.round((timestamp - firstBeatOffset) / beatInterval)
  return firstBeatOffset + beatIndex * beatInterval
}
```

- Applied in CuePointPopover when `snapMode === 'beat'`
- Applied when adjusting crossfade slider if snap active (snap the resulting boundary position, then compute duration from that)
- Visual feedback: brief "magnet" animation or highlight when a value snaps

**BPM badge on waveform:**

- Alongside format badge, show BPM: `"128 BPM"` or `"BPM: ?"` if not yet detected or confidence too low

### Verify

- Beat grid lines visible on tracks with detected BPM
- Downbeats visually distinct from regular beats
- Beat grid hidden on tracks with no BPM / low confidence
- Snap toggle works in toolbar
- Hold Shift → temporary snap mode
- Place cue point with snap → lands exactly on a beat
- BPM badge visible on each track
- Zoom out far → beat grid gracefully degrades (no visual noise)

---

## Phase 8: Playback Integration

**Goal:** Click timeline to play, moving playhead, sync with AudioPlayer, auto-advance.

### Modify

| File                                                           | Change                                                                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/store/audioPlayerStore.ts`                       | Add `pendingSeekTime: number                                                                                                                                     | null`field (after line 14). Add`seekTo(track: Track, time: number)`action: sets`currentTrack`, `pendingSeekTime`, `isPlaying: true`. Add `clearPendingSeek()` action |
| `src/renderer/components/common/AudioPlayer.tsx`               | Add `useEffect` watching `pendingSeekTime`: when non-null, set `audioRef.current.currentTime = pendingSeekTime`, then call `clearPendingSeek()` (after line 128) |
| `src/renderer/components/features/timeline/TimelineLayout.tsx` | Add click handler on waveform area: determine clicked track + timestamp → call `audioPlayerStore.seekTo(track, time)`                                            |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx` | Render playhead: vertical line at current playback position. Animated via `requestAnimationFrame` synced with `audioPlayerStore.currentTime`                     |
| `src/renderer/store/timelineStore.ts`                          | Add `isPlaybackActive: boolean`, `playheadPosition: number` (in pixels). Computed from `audioPlayerStore.currentTime` + track offsets                            |

### Key details

**Click-to-play flow:**

1. User clicks on a track's waveform area at position X
2. Compute: which song? what timestamp within that song? Account for trimStart offset
3. Build a `Track` object from the song (reuse `songToTrack` helper from MixTab)
4. Call `audioPlayerStore.seekTo(track, timestamp)`
5. `seekTo` sets the track, sets `pendingSeekTime`, sets `isPlaying: true`
6. AudioPlayer's effect loads the track, then another effect sees `pendingSeekTime` → seeks the audio element → clears it

**Playhead rendering:**

- Subscribe to `audioPlayerStore.currentTime` (updates ~4 times/second from `timeupdate` event)
- Map `currentTime` to pixel position: find the active track's `TrackPosition`, compute `trackPosition.left + (currentTime - trimStart) * pixelsPerSecond`
- Render as a bright vertical line (2px wide, full height of waveform area) using a dedicated absolutely-positioned `<div>` (cheaper than canvas redraw)
- Use `requestAnimationFrame` for smooth animation between `timeupdate` ticks (interpolate based on elapsed time)

**Auto-advance:**

- Existing: AudioPlayer calls `next()` on `ended` event
- For trimmed tracks: AudioPlayer needs to detect when `currentTime >= trimEnd` and call `next()` early. Add a `useEffect` in AudioPlayer that watches `currentTime` and compares against active track's trimEnd

**Scroll-to-playhead:**

- When playback is active, auto-scroll the timeline to keep the playhead in the center third of the viewport
- Disable auto-scroll if user manually scrolls during playback (re-enable on playhead click or play button)

### Verify

- Click on a track in timeline → AudioPlayer starts playing that track at the clicked position
- Playhead moves smoothly during playback
- Playhead position is accurate (matches audio)
- Auto-advance to next track when current track ends (or reaches trimEnd)
- Auto-scroll keeps playhead visible during playback
- Manual scroll during playback doesn't fight with auto-scroll
- Click a different track during playback → switches track + seeks

---

## Phase 9: Export Pipeline Integration

**Goal:** Export respects trim boundaries and cue points. FilterGraphBuilder adds `atrim`, CueSheetGenerator emits cue point INDEX entries.

### Modify

| File                                                     | Change                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/mixExport/FilterGraphBuilder.ts`      | Add `trimStart?: number` and `trimEnd?: number` to `TrackInfo` interface (line 3–7). In the per-track filter block (lines 27–44): if `trimStart` or `trimEnd` is set, insert `atrim=start={trimStart}:end={trimEnd}` before the loudnorm filter                                              |
| `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | Add tests: track with trimStart only, trimEnd only, both, trim + loudnorm combined, trim making track shorter than crossfade                                                                                                                                                                 |
| `src/main/services/mixExport/CueSheetGenerator.ts`       | Add `cuePoints?: CuePoint[]` to `CueTrackInfo` (line 1–6). In the track loop (lines 57–67): after `INDEX 01`, emit `REM CUE "{label}"` + `INDEX 02/03/...` for each cue point sorted by timestamp. Adjust start times in `computeStartTimes` to use effective duration (trimEnd - trimStart) |
| `src/main/services/mixExport/CueSheetGenerator.spec.ts`  | Add tests: tracks with cue points, tracks with trims, cue timestamps relative to track start accounting for trim                                                                                                                                                                             |
| `src/main/services/mixExport/MixExportService.ts`        | When building `TrackInfo[]` for the pipeline, include `trimStart` and `trimEnd` from song. Adjust total duration estimate for progress calculation                                                                                                                                           |
| `src/main/services/mixExport/MixValidator.ts`            | In `clampCrossfade`: use effective duration `(trimEnd ?? duration) - (trimStart ?? 0)` instead of raw `duration`                                                                                                                                                                             |

### Key details

**FilterGraphBuilder atrim insertion:**

```
[0:a]atrim=start=30:end=420,asetpts=PTS-STARTPTS,loudnorm=...[a0];
```

- `atrim` must come before `loudnorm` (trim first, then normalize the trimmed segment)
- `asetpts=PTS-STARTPTS` resets timestamps after trim (required for crossfade to work correctly)
- If only `trimStart` set: `atrim=start={trimStart}`
- If only `trimEnd` set: `atrim=end={trimEnd}`
- If both: `atrim=start={trimStart}:end={trimEnd}`

**CUE sheet cue point entries:**

```
TRACK 02 AUDIO
  TITLE "Track B"
  PERFORMER "Artist B"
  INDEX 01 15:30:00
  REM CUE "drop"
  INDEX 02 16:45:50
  REM CUE "breakdown"
  INDEX 03 18:12:25
```

- Cue point timestamps are relative to the start of the output mix, not the track start
- Compute: `trackStartInMix + (cuePoint.timestamp - trimStart)`
- Only emit cue points of type `'marker'` — trim points are structural, not navigational

**Duration adjustments:**

- Total mix duration calculation must use effective durations throughout
- Progress percentage during render must account for trimmed tracks
- File size estimate must use effective durations

### Verify

- `yarn test:main --testPathPatterns FilterGraphBuilder` — all tests pass including trim
- `yarn test:main --testPathPatterns CueSheetGenerator` — all tests pass including cue points
- Manual: export a mix with trimmed tracks → output starts/ends at trim points, no audio from trimmed regions
- .cue file contains user cue points with correct timestamps
- Crossfade clamping works with effective (trimmed) duration

---

## Phase 10: Edge Cases + Polish

**Goal:** Handle all edge cases from the spec, polish loading states, and ensure performance.

### Changes across existing files

**Missing files:**

- `WaveformCanvas`: render empty placeholder with "File missing" text and muted background
- `BpmDetector`: skip missing files, return `{ bpm: null, confidence: 0 }`
- Cue points still editable on tracks with missing files

**Short tracks (< 5s):**

- BPM detection: set confidence threshold — skip autocorrelation if track < 10s, return low confidence
- Beat grid: don't render if `bpm` is null

**Trim validation:**

- UI: prevent `trimEnd` cue point from being placed before `trimStart` cue point
- If trim makes effective duration < 1s: show warning toast, don't save
- If trim makes effective duration < crossfade: auto-clamp crossfade with warning

**Multiple trim cue points:**

- Only one `trim-start` and one `trim-end` per song enforced in the CuePointPopover
- Placing a second one of the same type: show confirmation dialog "Replace existing trim point?"

**Performance (20+ tracks):**

- Lazy waveform rendering: only render canvases within the visible viewport + 1 screen buffer on each side
- Use `IntersectionObserver` on each track container to trigger canvas rendering
- Minimap uses a separate lower-resolution peak set (~100 peaks per track)
- Beat grid computation: memoize per track, only recompute visible range on scroll

**Zoom extremes:**

- Minimum zoom (level 1): entire mix fits in view — all tracks visible
- Maximum zoom: cap at ~50× so that individual waveform bars are visible but canvas doesn't exceed browser limits (~32k px width per canvas)
- If total zoomed width would exceed limits, cap and show warning

**Concurrent waveform/BPM generation:**

- Only one batch operation at a time. If user switches projects during generation, cancel the running batch
- Cleanup in WaveformExtractor: kill any running FFmpeg child process on `cleanup()`

### Verify

- Missing file → placeholder visible, no crash
- Very short track → no BPM, no beat grid, still shows waveform
- Trim validation prevents invalid states
- 20+ tracks → no jank on scroll, waveforms load lazily
- Switch projects during waveform generation → no orphaned processes
- `yarn build` passes
- `yarn test:main --testPathPatterns waveform` — all tests pass
- `yarn test:main --testPathPatterns mixExport` — all tests pass (including trim + cue point changes)

---

## File Inventory Summary

**~20 new files** (6 main process, 2 shared types/schemas, 12 renderer)
**~14 modified files**

### New Files

| #   | File                                                                 | Phase |
| --- | -------------------------------------------------------------------- | ----- |
| 1   | `src/shared/types/waveform.types.ts`                                 | 1     |
| 2   | `src/shared/schemas/waveform.schema.ts`                              | 1     |
| 3   | `src/main/services/waveform/WaveformExtractor.ts`                    | 2     |
| 4   | `src/main/services/waveform/WaveformExtractor.spec.ts`               | 2     |
| 5   | `src/main/services/waveform/index.ts`                                | 2     |
| 6   | `src/main/ipc/waveformHandlers.ts`                                   | 2     |
| 7   | `src/main/services/waveform/BpmDetector.ts`                          | 3     |
| 8   | `src/main/services/waveform/BpmDetector.spec.ts`                     | 3     |
| 9   | `src/main/ipc/bpmHandlers.ts`                                        | 3     |
| 10  | `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx` | 4     |
| 11  | `src/renderer/components/features/timeline/WaveformCanvas.tsx`       | 4     |
| 12  | `src/renderer/components/features/timeline/TimelineLayout.tsx`       | 4     |
| 13  | `src/renderer/components/features/timeline/TrackInfoOverlay.tsx`     | 4     |
| 14  | `src/renderer/components/features/timeline/TrackDetailPanel.tsx`     | 4     |
| 15  | `src/renderer/hooks/useWaveformData.ts`                              | 4     |
| 16  | `src/renderer/store/timelineStore.ts`                                | 4     |
| 17  | `src/renderer/components/features/timeline/Minimap.tsx`              | 5     |
| 18  | `src/renderer/components/features/timeline/TimeRuler.tsx`            | 5     |
| 19  | `src/renderer/components/features/timeline/ZoomControls.tsx`         | 5     |
| 20  | `src/renderer/components/features/timeline/CrossfadePopover.tsx`     | 6     |
| 21  | `src/renderer/components/features/timeline/CuePointMarker.tsx`       | 6     |
| 22  | `src/renderer/components/features/timeline/CuePointPopover.tsx`      | 6     |
| 23  | `src/renderer/components/features/timeline/TrimOverlay.tsx`          | 6     |
| 24  | `src/renderer/components/features/timeline/BeatGrid.tsx`             | 7     |
| 25  | `src/renderer/hooks/useBpmData.ts`                                   | 7     |

### Modified Files

| File                                                     | Phases |
| -------------------------------------------------------- | ------ |
| `src/shared/types/project.types.ts`                      | 1      |
| `src/shared/constants.ts`                                | 1      |
| `src/main/ipc/index.ts`                                  | 2, 3   |
| `src/preload/index.ts`                                   | 2, 3   |
| `src/renderer/pages/ProjectOverview/index.tsx`           | 4      |
| `src/renderer/store/audioPlayerStore.ts`                 | 8      |
| `src/renderer/components/common/AudioPlayer.tsx`         | 8      |
| `src/main/services/mixExport/FilterGraphBuilder.ts`      | 9      |
| `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | 9      |
| `src/main/services/mixExport/CueSheetGenerator.ts`       | 9      |
| `src/main/services/mixExport/CueSheetGenerator.spec.ts`  | 9      |
| `src/main/services/mixExport/MixExportService.ts`        | 9      |
| `src/main/services/mixExport/MixValidator.ts`            | 9      |

## Verification (End-to-End)

1. `yarn build` — full build passes
2. `yarn test:main` — all existing + new tests pass
3. Manual: open project with 5+ mixed-format songs → Timeline tab shows real waveforms with crossfade overlaps
4. Click crossfade zone → slider popup adjusts overlap visually
5. Double-click waveform → place cue points, set trim boundaries → dimmed regions visible
6. BPM detected → beat grid visible → snap-to-beat works
7. Click timeline → playback starts at clicked position, playhead moves
8. Export with trims → output file respects trim boundaries
9. .cue file contains user cue points with correct timestamps
10. 20-track project → smooth scrolling, lazy waveform loading, no jank
