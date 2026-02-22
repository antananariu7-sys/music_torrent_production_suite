# 18 — Waveform Timeline

> Interactive waveform timeline editor: visual mix arrangement with real audio waveforms, BPM-synced beat grids, editable crossfade zones, cue points with trim boundaries, and integrated playback.

**Status**: Implemented (core + visual improvements)
**Depends on**: Component 3 (Mix Builder, doc 16), Audio Mix Export (doc 17), ProjectService, AudioPlayer
**Feature spec**: [docs/features/done/waveform-timeline.md](../features/done/waveform-timeline.md)
**Implementation plan**: [docs/features/done/waveform-timeline-plan.md](../features/done/waveform-timeline-plan.md)
**Visual improvements spec**: [docs/features/done/waveform-visual-improvements.md](../features/done/waveform-visual-improvements.md)

---

## 1. Overview

Phase 2 of the audio mix export feature. The export pipeline (FFmpeg rendering, crossfades, loudnorm, .cue sheet) is fully built (doc 17). Users need a visual timeline to see their mix arrangement, edit crossfade zones, place cue points with trim boundaries, visualize beat grids, and preview playback.

### What this adds

- **Waveform visualization**: Real audio peak extraction via FFmpeg, cached to disk, rendered on `<canvas>`
- **BPM detection**: Onset detection + autocorrelation, beat grid overlay, snap-to-beat
- **Timeline editing**: Crossfade zone click-to-edit, double-click cue point placement, trim boundaries
- **Playback integration**: Click-to-play on timeline, moving playhead, auto-advance
- **Export integration**: `atrim` filter for trims, cue point INDEX entries in .cue sheet
- **Navigation**: Zoom, scroll, minimap, time ruler

### Scope boundaries

**In scope**: Waveform display, BPM detection, beat grid, cue points, trim, crossfade editing, playback, export integration.

**Out of scope**: Real-time crossfade preview (two simultaneous audio streams), EQ/effects, tempo adjustment/time-stretching, waveform editing (cut/split/reverse), automatic beat-sync.

---

## 2. Data Model

### 2.1 Song — new fields

Add to `Song` interface in `src/shared/types/project.types.ts`:

```typescript
interface Song {
  // ... existing fields (line 21–38) ...
  cuePoints?: CuePoint[] // User-placed markers
  bpm?: number // Detected BPM (cached)
  firstBeatOffset?: number // Seconds to first downbeat (cached)
  trimStart?: number // Effective start (derived from trim-start cue point)
  trimEnd?: number // Effective end (derived from trim-end cue point)
}
```

**Semantics:**

- `trimStart` / `trimEnd` — derived from trim-type cue points, stored as top-level fields for quick access by the export pipeline. Updated whenever cue points change.
- `bpm` / `firstBeatOffset` — cached analysis results. Persisted in project.json so detection doesn't re-run across sessions.

### 2.2 CuePoint (new type)

```typescript
// src/shared/types/waveform.types.ts
interface CuePoint {
  id: string // nanoid
  timestamp: number // seconds from track start
  label: string // user-provided name ("drop", "breakdown")
  type: 'marker' | 'trim-start' | 'trim-end'
}
```

Constraints:

- One `trim-start` and one `trim-end` per song (enforced in UI)
- Placing a duplicate replaces with confirmation

### 2.3 WaveformData (disk cache)

```typescript
// src/shared/types/waveform.types.ts
interface WaveformData {
  songId: string
  peaks: number[] // normalized 0–1, ~8000 points (upgraded from 2000)
  peaksLow?: number[] // low-band (<250 Hz) peaks for frequency coloring
  peaksMid?: number[] // mid-band (250 Hz–4 kHz) peaks for frequency coloring
  peaksHigh?: number[] // high-band (>4 kHz) peaks for frequency coloring
  duration: number // seconds
  sampleRate: number // source sample rate (16kHz extraction)
  fileHash: string // "${stat.size}-${stat.mtimeMs}" for invalidation
}
```

Stored as binary format:

- `<projectDir>/assets/waveforms/<songId>.peaks` — Binary file with 16-byte header (magic "PEKS", version, peak count, flags) + Float32Array peaks data + optional frequency band arrays
- `<projectDir>/assets/waveforms/<songId>.meta.json` — Metadata: `{ duration, sampleRate, fileHash, peakCount }`

### 2.4 BpmData (disk cache)

```typescript
// src/shared/types/waveform.types.ts
interface BpmData {
  songId: string
  bpm: number
  firstBeatOffset: number // seconds to first downbeat
  confidence: number // 0–1
  fileHash: string
}
```

Stored as: `<projectDir>/assets/waveforms/<songId>.bpm.json`

### 2.5 Effective duration

Throughout the system, "effective duration" means:

```typescript
const effectiveDuration =
  (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
```

This replaces raw `song.duration` in:

- Timeline layout positioning
- Export filter graph (atrim filter)
- Cue sheet start time computation
- Crossfade clamping
- Progress estimation

---

## 3. IPC Design

### 3.1 Channel constants

Add to `src/shared/constants.ts`:

```typescript
// Waveform extraction
WAVEFORM_GENERATE:       'waveform:generate',        // R→M request-response
WAVEFORM_GENERATE_BATCH: 'waveform:generate-batch',  // R→M request-response
WAVEFORM_REBUILD_BATCH:  'waveform:rebuild-batch',   // R→M request-response (invalidate cache + regenerate)
WAVEFORM_PROGRESS:       'waveform:progress',         // M→R push event

// BPM detection
BPM_DETECT:              'bpm:detect',               // R→M request-response
BPM_DETECT_BATCH:        'bpm:detect-batch',         // R→M request-response
BPM_PROGRESS:            'bpm:progress',              // M→R push event
```

### 3.2 Channel details

| Channel                   | Pattern         | Direction | Payload → Return                                     |
| ------------------------- | --------------- | --------- | ---------------------------------------------------- |
| `waveform:generate`       | `handle/invoke` | R → M     | `{ songId, filePath }` → `ApiResponse<WaveformData>` |
| `waveform:generate-batch` | `handle/invoke` | R → M     | `{ projectId }` → `ApiResponse<WaveformData[]>`      |
| `waveform:progress`       | `send/on`       | M → R     | `{ songId, index, total }`                           |
| `bpm:detect`              | `handle/invoke` | R → M     | `{ songId, filePath }` → `ApiResponse<BpmData>`      |
| `bpm:detect-batch`        | `handle/invoke` | R → M     | `{ projectId }` → `ApiResponse<BpmData[]>`           |
| `bpm:progress`            | `send/on`       | M → R     | `{ songId, index, total }`                           |

### 3.3 Preload API

```typescript
// src/preload/index.ts — new namespaces
waveform: {
  generate: (request: WaveformRequest) => Promise<ApiResponse<WaveformData>>,
  generateBatch: (request: WaveformBatchRequest) => Promise<ApiResponse<WaveformData[]>>,
  rebuildBatch: (request: WaveformBatchRequest) => Promise<ApiResponse<WaveformData[]>>,
  onProgress: (callback: (progress: WaveformProgress) => void) => (() => void),
},
bpm: {
  detect: (songId: string, filePath: string) => Promise<ApiResponse<BpmData>>,
  detectBatch: (projectId: string) => Promise<ApiResponse<BpmData[]>>,
  onProgress: (callback: (progress: BpmProgress) => void) => (() => void),
},
```

### 3.4 Validation schemas

New file `src/shared/schemas/waveform.schema.ts`:

```typescript
import { z } from 'zod'

export const WaveformRequestSchema = z.object({
  songId: z.string().min(1),
  filePath: z.string().min(1),
})

export const BpmRequestSchema = z.object({
  songId: z.string().min(1),
  filePath: z.string().min(1),
})

export const CuePointSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().min(0),
  label: z.string().min(1),
  type: z.enum(['marker', 'trim-start', 'trim-end']),
})
```

---

## 4. Service Architecture (Main Process)

### 4.1 Module layout

```
src/main/services/waveform/
├── WaveformExtractor.ts        Peak extraction via FFmpeg, disk cache
├── WaveformExtractor.spec.ts   Tests: peak computation, cache hit/miss
├── BpmDetector.ts              BPM via onset detection + autocorrelation
├── BpmDetector.spec.ts         Tests: known-BPM files, edge cases
└── index.ts                    Barrel exports

src/main/ipc/
├── waveformHandlers.ts         Handlers for WAVEFORM_GENERATE, WAVEFORM_GENERATE_BATCH
└── bpmHandlers.ts              Handlers for BPM_DETECT, BPM_DETECT_BATCH
```

### 4.2 WaveformExtractor

**Responsibility**: Extract audio peaks from files via FFmpeg, cache results to disk, serve via IPC.

```
WaveformExtractor
├── Dependencies
│   └── ProjectService          (resolve project dir for cache path)
│
├── Public API
│   ├── generate(songId, filePath, projectDir): Promise<WaveformData>
│   ├── generateBatch(project, onProgress): Promise<WaveformData[]>
│   └── cleanup(): void         (kill running FFmpeg processes)
│
├── Internal
│   ├── extractPeaks(filePath): Promise<Float32Array>   // FFmpeg → PCM → peaks
│   ├── downsample(samples, targetCount): number[]       // ~2000 peaks
│   ├── computeFileHash(filePath): Promise<string>       // size + mtime
│   ├── readCache(cachePath, fileHash): WaveformData | null
│   └── writeCache(cachePath, data): Promise<void>
│
└── State
    └── activeProcess: ChildProcess | null               // for cleanup/cancel
```

**FFmpeg command (main peaks)**:

```bash
ffmpeg -i <file> -ac 1 -ar 16000 -f f32le pipe:1
```

- Mono, 16kHz, float32 PCM to stdout
- Collect Buffer → `new Float32Array(buffer.buffer)`
- Downsample: split into windows of `totalSamples / 8000`, take `Math.max(Math.abs(...))` per window
- Normalize: divide all peaks by global max

**FFmpeg command (3-band frequency extraction)**:

```bash
ffmpeg -i <file> -filter_complex "
  [0:a]lowpass=f=250,aresample=16000[low];
  [0:a]bandpass=f=1000:width_type=o:w=2,aresample=16000[mid];
  [0:a]highpass=f=4000,aresample=16000[high]
" -map [low] -f f32le pipe:3 -map [mid] -f f32le pipe:4 -map [high] -f f32le pipe:5
```

- 3 parallel bandpass filters extract low/mid/high energy
- Same downsample + normalize pipeline per band
- Results stored as optional `peaksLow`, `peaksMid`, `peaksHigh` arrays

**Disk cache (binary format)**:

- Peak file: `<projectDir>/assets/waveforms/<songId>.peaks` — Binary with 16-byte header (magic 0x50454B53 "PEKS", version, peak count, flags) + Float32Array data
- Metadata: `<projectDir>/assets/waveforms/<songId>.meta.json`
- Cache key: `"${stat.size}-${stat.mtimeMs}"`
- On generate: check cache → return if hash matches → extract if miss → write → return
- On batch: iterate sequentially, emit progress per track
- On rebuild: invalidate disk cache → re-extract all tracks
- Fallback: Legacy `.json` format supported for migration

**Performance**: ~1–2s per track at 16kHz mono. 20-track project ≈ 30s total (batch, sequential).

### 4.3 BpmDetector

**Responsibility**: Detect BPM and first-beat offset per track. Cache to disk. Persist to Song.

```
BpmDetector
├── Dependencies
│   └── ProjectService          (resolve paths, persist bpm to song)
│
├── Public API
│   ├── detect(songId, filePath, projectDir): Promise<BpmData>
│   ├── detectBatch(project, onProgress): Promise<BpmData[]>
│   └── cleanup(): void
│
├── Internal
│   ├── extractPcm(filePath): Promise<Float32Array>      // FFmpeg 44.1kHz mono
│   ├── computeOnsetStrength(pcm): number[]               // energy envelope
│   ├── autocorrelate(onsets): { bpm, confidence }        // dominant period
│   ├── findFirstBeat(onsets, bpm): number                // firstBeatOffset
│   └── cache operations (same pattern as WaveformExtractor)
│
└── State
    └── activeProcess: ChildProcess | null
```

**Algorithm (Option B — FFmpeg + custom autocorrelation)**:

1. Extract PCM at 44.1kHz mono via FFmpeg (higher rate than waveform for accuracy)
2. Compute onset strength function (energy envelope with windowed frames)
3. Autocorrelation on onset function → find dominant period → BPM
4. Find first beat via onset peaks → `firstBeatOffset`
5. Confidence = strength of autocorrelation peak relative to noise floor

**Edge cases**:

- Ambient/spoken word → confidence < 0.3 → return `{ bpm: null, confidence }`
- Short tracks < 10s → skip autocorrelation → low confidence
- After detection: `projectService.updateSong({ bpm, firstBeatOffset })` to persist

**Disk cache**: `<projectDir>/assets/waveforms/<songId>.bpm.json`

### 4.4 IPC handler registration

In `src/main/ipc/index.ts`:

```typescript
import { WaveformExtractor } from '../services/waveform/WaveformExtractor'
import { BpmDetector } from '../services/waveform/BpmDetector'
import { registerWaveformHandlers } from './waveformHandlers'
import { registerBpmHandlers } from './bpmHandlers'

// After existing service instantiation (~line 69):
const waveformExtractor = new WaveformExtractor(projectService)
const bpmDetector = new BpmDetector(projectService)
registerWaveformHandlers(waveformExtractor)
registerBpmHandlers(bpmDetector)

// In cleanupServices():
waveformExtractor.cleanup()
bpmDetector.cleanup()
```

---

## 5. Renderer Architecture

### 5.1 Component tree

```
TimelineTab (tab shell)
├── Minimap                         Simplified waveform overview + viewport rect
├── ZoomControls                    [−] slider [+], snap toggle, duration display
├── TimeRuler                       Tick marks + time labels (adapts to zoom)
├── TimelineLayout (scrollable)     Positions tracks + scroll container
│   └── per track:
│       ├── WaveformCanvas          <canvas> with mirrored bars
│       │   ├── BeatGrid            Beat lines (thin + downbeats)
│       │   ├── TrimOverlay         Gray overlay outside trim bounds
│       │   └── CuePointMarker[]    Colored vertical lines + labels
│       ├── TrackInfoOverlay        Format badge + hover tooltip
│       ├── CrossfadePopover        Slider (0–30s) on overlap zone click
│       └── CuePointPopover         Name + type + delete on double-click
├── Playhead                        Animated vertical line (absolutely positioned div)
└── TrackDetailPanel                Bottom panel: selected track metadata + cue list
```

### 5.2 File layout

```
src/renderer/
├── components/features/timeline/
│   ├── WaveformCanvas.tsx          <canvas> rendering: tile blitting, frequency coloring
│   ├── waveformDrawing.ts          Pure canvas drawing functions (drawWaveform, downsampleArray)
│   ├── waveformTileCache.ts        LRU OffscreenCanvas tile cache (4096px tiles, max 50)
│   ├── TimelineLayout.tsx          Track positioning, scroll container, crossfade zones
│   ├── VirtualTrack.tsx            IntersectionObserver-based virtual scrolling
│   ├── TrackInfoOverlay.tsx        Format badge + metadata tooltip
│   ├── TrackDetailPanel.tsx        Selected track details + cue point list
│   ├── Minimap.tsx                 Full-mix overview canvas + viewport rectangle
│   ├── Playhead.tsx                Animated playback position indicator
│   ├── TimeRuler.tsx               Adaptive time tick marks
│   ├── ZoomControls.tsx            Zoom buttons + keyboard shortcuts
│   ├── CrossfadePopover.tsx        Crossfade duration editor
│   ├── CuePointMarker.tsx          Visual marker (line + flag)
│   ├── CuePointPopover.tsx         Create/edit cue point form
│   ├── TrimOverlay.tsx             Gray overlay outside trim bounds
│   └── BeatGrid.tsx                Canvas-based beat line rendering
├── hooks/
│   └── useWaveformData.ts          Batch waveform loading + progress + rebuild
├── store/
│   └── timelineStore.ts            Timeline UI state (Zustand)
└── pages/ProjectOverview/
    └── components/tabs/
        └── TimelineTab.tsx         Tab shell: orchestrates sub-components
```

### 5.3 Zustand store: timelineStore

```typescript
// src/renderer/store/timelineStore.ts
interface TimelineState {
  // Selection
  selectedTrackId: string | null

  // Zoom & scroll
  zoomLevel: number // 1 (fit-to-view) to 10
  scrollPosition: number // pixels
  viewportWidth: number // pixels

  // Snap & visual preferences
  snapMode: 'off' | 'beat'
  frequencyColorMode: boolean // 3-band frequency coloring toggle
  showBeatGrid: boolean // beat grid visibility (independent of snap)

  // Caches
  waveformCache: Record<string, WaveformData>
  isLoadingWaveforms: boolean
  loadingProgress: { current: number; total: number } | null

  // Popovers
  activeCrossfadePopover: { songId: string; position: number } | null
  activeCuePointPopover: {
    songId: string
    timestamp: number
    existing?: CuePoint
  } | null

  // Playback
  isPlaybackActive: boolean
  playheadPosition: number // pixels

  // Actions
  setSelectedTrack: (id: string | null) => void
  setZoom: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fitToView: () => void
  setScroll: (px: number) => void
  setViewportWidth: (px: number) => void
  toggleSnapMode: () => void
  setWaveformData: (songId: string, data: WaveformData) => void
  setBpmData: (songId: string, data: BpmData) => void
  openCrossfadePopover: (songId: string, position: number) => void
  closeCrossfadePopover: () => void
  openCuePointPopover: (
    songId: string,
    timestamp: number,
    existing?: CuePoint
  ) => void
  closeCuePointPopover: () => void
}
```

### 5.4 Canvas rendering approach

- **One `<canvas>` per track** (not one giant canvas) — simplifies hit detection, individual updates, avoids browser canvas size limits
- Each WaveformCanvas receives: `peaks`, `width` (duration × pixelsPerSecond × zoom), `height` (80px), `color`, `isSelected`
- **Bar rendering**: Classic `fillRect()` bar rendering with gradient fills
- **Gradient fills**: Vertical `createLinearGradient` — bright at peaks (100% alpha), darker at center (40% alpha)
- **Frequency coloring** (optional toggle): 3-band energy (bass/mid/high) colors bars red/green/cyan based on dominant frequency
- **LOD downsampling**: 8000 peaks stored, max-pooled down at render time based on `canvasWidth × 2` — zoom-adaptive detail
- Crossfade zones: semi-transparent colored overlay on the overlapping region
- Beat grid: thin vertical lines at beat positions (only visible range computed), independently toggleable
- Trim overlay: gray semi-transparent overlay outside trim boundaries

### 5.5 Layout calculation

```typescript
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

### 5.6 Zoom model

- `pixelsPerSecond = basePixelsPerSecond * zoomLevel`
- `basePixelsPerSecond` computed so that `totalMixDuration * basePixelsPerSecond = containerWidth` (fit-to-view)
- `zoomLevel` range: 1 (fit-to-view) to 10 (MAX_ZOOM constant)
- Ctrl+scroll: zoom toward cursor position (adjust scrollLeft to keep mouse point stable)

### 5.7 Playback integration

**AudioPlayer store changes** (`src/renderer/store/audioPlayerStore.ts`):

```typescript
// Add to interface:
pendingSeekTime: number | null

// Add action:
seekTo: (track: Track, time: number) => void  // sets currentTrack, pendingSeekTime, isPlaying
clearPendingSeek: () => void
```

**Click-to-play flow**:

1. User clicks track waveform at position X
2. Compute: which song? what timestamp? (account for trimStart)
3. Build `Track` object from song (reuse `songToTrack` helper from MixTab)
4. Call `audioPlayerStore.seekTo(track, timestamp)`
5. AudioPlayer component: `useEffect` watches `pendingSeekTime` → sets `audioRef.current.currentTime` → clears

**Playhead**: Absolutely positioned `<div>` (not canvas redraw). Position computed from `audioPlayerStore.currentTime` + track offsets. Smooth via `requestAnimationFrame` interpolation between `timeupdate` ticks.

**Auto-advance**: AudioPlayer detects `currentTime >= trimEnd` → calls `next()` early (in addition to existing `ended` event handler).

---

## 6. Export Pipeline Integration

### 6.1 FilterGraphBuilder changes

File: `src/main/services/mixExport/FilterGraphBuilder.ts`

Add `trimStart?` and `trimEnd?` to `TrackInfo` interface:

```typescript
export interface TrackInfo {
  index: number
  loudnorm?: LoudnormAnalysis
  crossfadeDuration: number
  trimStart?: number // NEW
  trimEnd?: number // NEW
}
```

In the per-track filter block, insert `atrim` + `asetpts` before loudnorm:

```
[0:a]atrim=start=30:end=420,asetpts=PTS-STARTPTS,loudnorm=...,[a0];
```

- `atrim` must precede `loudnorm` (trim first, then normalize the trimmed segment)
- `asetpts=PTS-STARTPTS` resets timestamps after trim (required for crossfade to work)
- If only `trimStart`: `atrim=start={trimStart}`
- If only `trimEnd`: `atrim=end={trimEnd}`
- If both: `atrim=start={trimStart}:end={trimEnd}`

### 6.2 CueSheetGenerator changes

File: `src/main/services/mixExport/CueSheetGenerator.ts`

Add `cuePoints?` and effective duration fields to `CueTrackInfo`:

```typescript
export interface CueTrackInfo {
  title: string
  artist?: string
  duration: number // effective duration (after trim)
  crossfadeDuration: number
  cuePoints?: CuePoint[] // NEW — user cue points
}
```

In `computeStartTimes`: use effective duration (callers must pass trimmed duration).

In `generateCueSheet`: after `INDEX 01`, emit cue point entries:

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

- Only emit cue points of type `'marker'` (trim points are structural, not navigational)
- Cue point timestamps: `trackStartInMix + (cuePoint.timestamp - trimStart)`
- Sort cue points by timestamp within each track

### 6.3 MixValidator changes

File: `src/main/services/mixExport/MixValidator.ts`

**No signature change** to `clampCrossfade`. The function already accepts `currentDuration` and `nextDuration` — callers will pass pre-computed effective durations instead of raw durations:

```typescript
// Existing signature unchanged:
export function clampCrossfade(
  crossfade: number,
  currentDuration: number | undefined, // callers now pass effective duration
  nextDuration: number | undefined // callers now pass effective duration
): { value: number; clamped: boolean }
```

### 6.4 MixExportService changes

File: `src/main/services/mixExport/MixExportService.ts`

- When building `TrackInfo[]`: include `trimStart` and `trimEnd` from song
- When calling `clampCrossfade`: pass effective duration instead of raw duration:
  ```typescript
  const effectiveDuration =
    (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
  ```
- Adjust total duration estimate for progress: use effective durations
- Pass effective duration to CueSheetGenerator as `CueTrackInfo.duration`

---

## 7. Performance

### 7.1 Waveform extraction

| Operation            | Time  | Notes                                        |
| -------------------- | ----- | -------------------------------------------- |
| Single track (5 min) | ~1–2s | FFmpeg 16kHz mono → downsample to 8000 peaks |
| 20-track batch       | ~30s  | Sequential, progress per track               |
| Cache hit            | <50ms | Binary .peaks + .meta.json read from disk    |

### 7.2 Canvas rendering

| Optimization  | Strategy                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| Tile cache    | OffscreenCanvas tiles (4096px, LRU max 50) — blit-only on scroll, no redraw  |
| VirtualTrack  | IntersectionObserver-based virtualization, 500px horizontal buffer           |
| DPR-aware     | Device pixel ratio scaling for crisp canvas rendering on HiDPI displays      |
| React.memo    | Memoized child components with shallow prop comparison                       |
| Minimap       | Separate lower-resolution peak set (~100 peaks per track)                    |
| Beat grid     | Canvas-based rendering, only visible range computed, skip when < 3px density |
| Canvas limits | Tiled at 4096px chunks; stays under Chrome's 32768px canvas limit            |

### 7.3 Memory

- Waveform data: ~8000 floats per track (+ 3×8000 for frequency bands) × 20 tracks = ~2.5 MB (negligible)
- BPM data: trivial per track
- Canvas elements: one per visible track (~5–8 at a time with lazy loading)

### 7.4 Concurrent operations

- Only one batch waveform/BPM operation at a time
- Project switch during generation → cancel running batch
- Cleanup kills any running FFmpeg child process

---

## 8. Implementation Stages

### Stage 1: Foundation — Types, Schemas, IPC Channels

**Scope**: Type definitions, Zod schemas, IPC channel registration. Zero runtime behavior — just the type foundation.

| Action | File                                    | Change                                                                         |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| Create | `src/shared/types/waveform.types.ts`    | `CuePoint`, `WaveformData`, `BpmData`, request/progress types                  |
| Create | `src/shared/schemas/waveform.schema.ts` | Zod schemas for IPC validation                                                 |
| Modify | `src/shared/types/project.types.ts`     | Add `cuePoints?`, `bpm?`, `firstBeatOffset?`, `trimStart?`, `trimEnd?` to Song |
| Modify | `src/shared/types/index.ts`             | Re-export waveform types                                                       |
| Modify | `src/shared/constants.ts`               | Add 6 IPC channel constants                                                    |

**Verify**: `yarn build` passes, existing tests pass.

---

### Stage 2: Waveform Extraction Service

**Scope**: FFmpeg peak extraction, disk caching, IPC handlers, preload API.

| Action | File                                                   | Purpose                                                  |
| ------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Create | `src/main/services/waveform/WaveformExtractor.ts`      | FFmpeg → PCM → peaks → normalize → cache                 |
| Create | `src/main/services/waveform/WaveformExtractor.spec.ts` | Peak computation, cache hit/miss, file hash invalidation |
| Create | `src/main/services/waveform/index.ts`                  | Barrel exports                                           |
| Create | `src/main/ipc/waveformHandlers.ts`                     | Handle `WAVEFORM_GENERATE`, `WAVEFORM_GENERATE_BATCH`    |
| Modify | `src/main/ipc/index.ts`                                | Import, instantiate, register, cleanup                   |
| Modify | `src/preload/index.ts`                                 | Add `waveform` namespace                                 |

**Verify**: `yarn test:main --testPathPatterns WaveformExtractor`, manual `window.api.waveform.generate()`.

---

### Stage 3: BPM Detection Service

**Scope**: BPM detection via FFmpeg + custom autocorrelation, disk caching, persistence to Song.

| Action | File                                             | Purpose                                                   |
| ------ | ------------------------------------------------ | --------------------------------------------------------- |
| Create | `src/main/services/waveform/BpmDetector.ts`      | Onset detection + autocorrelation → BPM + firstBeatOffset |
| Create | `src/main/services/waveform/BpmDetector.spec.ts` | Known-BPM files, confidence thresholds, edge cases        |
| Create | `src/main/ipc/bpmHandlers.ts`                    | Handle `BPM_DETECT`, `BPM_DETECT_BATCH`                   |
| Modify | `src/main/ipc/index.ts`                          | Register BPM handlers + cleanup                           |
| Modify | `src/preload/index.ts`                           | Add `bpm` namespace                                       |

**Verify**: `yarn test:main --testPathPatterns BpmDetector`, verify `.bpm.json` on disk, BPM persisted in project.json.

---

### Stage 4: Timeline Tab + Canvas Waveform Rendering

**Scope**: New Timeline tab in ProjectOverview, `<canvas>` waveform rendering, track layout with crossfade overlaps, format badges, loading states.

| Action | File                                                                 | Purpose                                                                                                                                              |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create | `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx` | Tab shell: load data, manage selection, render sub-components                                                                                        |
| Create | `src/renderer/components/features/timeline/WaveformCanvas.tsx`       | Canvas: mirrored bars per track                                                                                                                      |
| Create | `src/renderer/components/features/timeline/TimelineLayout.tsx`       | Layout engine: track positioning + scroll container                                                                                                  |
| Create | `src/renderer/components/features/timeline/TrackInfoOverlay.tsx`     | Format badge + hover tooltip                                                                                                                         |
| Create | `src/renderer/components/features/timeline/TrackDetailPanel.tsx`     | Bottom panel: selected track metadata                                                                                                                |
| Create | `src/renderer/hooks/useWaveformData.ts`                              | Batch waveform loading via IPC                                                                                                                       |
| Create | `src/renderer/store/timelineStore.ts`                                | Zustand: selection, zoom, scroll, caches                                                                                                             |
| Modify | `src/renderer/pages/ProjectOverview/index.tsx`                       | Add `'timeline'` to `TabValue` union, add tab entry `{ value: 'timeline', label: 'Timeline', icon: FiActivity }`, add conditional render, add import |
| Modify | `src/renderer/pages/ProjectOverview/components/tabs/index.ts`        | Re-export `TimelineTab`                                                                                                                              |

**Tab integration detail**:

```typescript
// index.tsx changes:
import { FiActivity } from 'react-icons/fi'  // waveform-like icon
type TabValue = 'search' | 'torrent' | 'mix' | 'timeline'
// In tabs array after mix:
{ value: 'timeline', label: 'Timeline', icon: FiActivity }
// In tab content:
{activeTab === 'timeline' && <TimelineTab />}
```

**Verify**: Timeline tab visible, real waveforms render, crossfade overlaps visible, format badges, loading skeletons.

---

### Stage 5: Navigation — Zoom, Scroll, Minimap

**Scope**: Zoom in/out, horizontal scroll, minimap with viewport indicator, time ruler.

| Action | File                                                           | Purpose                                   |
| ------ | -------------------------------------------------------------- | ----------------------------------------- |
| Create | `src/renderer/components/features/timeline/Minimap.tsx`        | Overview canvas + draggable viewport rect |
| Create | `src/renderer/components/features/timeline/TimeRuler.tsx`      | Adaptive tick marks + time labels         |
| Create | `src/renderer/components/features/timeline/ZoomControls.tsx`   | [−] slider [+], snap toggle, duration     |
| Modify | `src/renderer/store/timelineStore.ts`                          | Zoom, scroll, viewport state + actions    |
| Modify | `src/renderer/components/features/timeline/TimelineLayout.tsx` | Ctrl+scroll zoom, overflow-x scroll       |
| Modify | `TimelineTab.tsx`                                              | Render Minimap, ZoomControls, TimeRuler   |

**Verify**: Ctrl+scroll zoom, toolbar controls, minimap viewport, time ruler adapts to zoom, fit-to-view.

---

### Stage 6: Interactive Editing — Crossfades, Cue Points, Trim

**Scope**: Crossfade zone click-to-edit, cue point placement via double-click, trim boundary visualization.

| Action | File                                                             | Purpose                                                |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Create | `src/renderer/components/features/timeline/CrossfadePopover.tsx` | Slider 0–30s + numeric input + reset                   |
| Create | `src/renderer/components/features/timeline/CuePointMarker.tsx`   | Colored line + flag label                              |
| Create | `src/renderer/components/features/timeline/CuePointPopover.tsx`  | Name, type selector, delete                            |
| Create | `src/renderer/components/features/timeline/TrimOverlay.tsx`      | Gray overlay outside trim bounds                       |
| Modify | `src/renderer/components/features/timeline/WaveformCanvas.tsx`   | Click/double-click handlers, render markers + overlays |
| Modify | `src/renderer/components/features/timeline/TrackDetailPanel.tsx` | Cue point list with edit/delete                        |
| Modify | `src/renderer/store/timelineStore.ts`                            | Popover state + actions                                |

**Verify**: Crossfade popover adjusts overlap, cue points placed + visible, trim overlays, cue list in detail panel.

---

### Stage 7: Beat Grid + Snap-to-Beat

**Scope**: Beat grid lines on waveforms, snap mode for cue points and crossfade editing.

| Action | File                                                            | Purpose                                  |
| ------ | --------------------------------------------------------------- | ---------------------------------------- |
| Create | `src/renderer/components/features/timeline/BeatGrid.tsx`        | Beat line rendering (visible range only) |
| Create | `src/renderer/hooks/useBpmData.ts`                              | Batch BPM loading via IPC                |
| Modify | `src/renderer/components/features/timeline/WaveformCanvas.tsx`  | Integrate BeatGrid rendering             |
| Modify | `src/renderer/components/features/timeline/ZoomControls.tsx`    | Snap toggle [off \| beat]                |
| Modify | `src/renderer/store/timelineStore.ts`                           | `snapMode`, `bpmDataCache`               |
| Modify | `src/renderer/components/features/timeline/CuePointPopover.tsx` | Apply snap to timestamp                  |

**Verify**: Beat grid visible, downbeats distinct, snap toggle works, cue points snap to beats, BPM badge on tracks.

---

### Stage 8: Playback Integration

**Scope**: Click-to-play on timeline, moving playhead, AudioPlayer sync, auto-advance with trim support.

| Action | File                                                           | Change                                                                |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Modify | `src/renderer/store/audioPlayerStore.ts`                       | Add `pendingSeekTime`, `seekTo()`, `clearPendingSeek()`               |
| Modify | `src/renderer/components/common/AudioPlayer.tsx`               | `useEffect` for `pendingSeekTime`; `currentTime >= trimEnd` detection |
| Modify | `src/renderer/components/features/timeline/TimelineLayout.tsx` | Click handler → `seekTo()`                                            |
| Modify | `src/renderer/components/features/timeline/WaveformCanvas.tsx` | Render playhead line                                                  |
| Modify | `src/renderer/store/timelineStore.ts`                          | `isPlaybackActive`, `playheadPosition`                                |

**Verify**: Click plays at position, playhead moves, auto-advance at trimEnd, scroll-to-playhead during playback.

---

### Stage 9: Export Pipeline Integration

**Scope**: FilterGraphBuilder atrim support, CueSheetGenerator cue point entries, MixValidator effective duration.

| Action | File                                                     | Change                                                                |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Modify | `src/main/services/mixExport/FilterGraphBuilder.ts`      | Add `trimStart?`, `trimEnd?` to TrackInfo; insert `atrim` + `asetpts` |
| Modify | `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | Tests: trim only, trim + loudnorm, trim < crossfade                   |
| Modify | `src/main/services/mixExport/CueSheetGenerator.ts`       | Add `cuePoints?` to CueTrackInfo; emit INDEX entries                  |
| Modify | `src/main/services/mixExport/CueSheetGenerator.spec.ts`  | Tests: cue points, trimmed tracks                                     |
| Modify | `src/main/services/mixExport/MixExportService.ts`        | Include trim fields; adjust duration estimate                         |
| Modify | `src/main/services/mixExport/MixValidator.ts`            | `clampCrossfade` uses effective duration                              |

**Verify**: All mixExport tests pass, exported file respects trims, .cue contains cue points.

---

### Stage 10: Edge Cases + Polish

**Scope**: Missing files, short tracks, trim validation, performance for 20+ tracks, zoom extremes, concurrent operation safety.

| Area                     | Changes                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| Missing files            | WaveformCanvas placeholder; BpmDetector skips; cue points still editable          |
| Short tracks             | BPM confidence threshold; no beat grid if bpm null                                |
| Trim validation          | Prevent trimEnd < trimStart; warn if effective < 1s; auto-clamp crossfade         |
| Multiple trim cues       | Enforce one per type; confirm replacement                                         |
| Performance (20+ tracks) | Lazy canvas rendering (IntersectionObserver); minimap low-res; memoized beat grid |
| Zoom extremes            | Cap at 50×; canvas width limit warning                                            |
| Concurrent operations    | Single batch at a time; cancel on project switch; FFmpeg process cleanup          |

**Verify**: All edge cases handled, 20-track project smooth, `yarn build`, `yarn test:main` pass.

---

## 9. File Inventory

### New files (~25)

| #   | File                                                                 | Stage |
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

### Modified files (~14)

| File                                                     | Stages     |
| -------------------------------------------------------- | ---------- |
| `src/shared/types/project.types.ts`                      | 1          |
| `src/shared/types/index.ts`                              | 1          |
| `src/shared/constants.ts`                                | 1          |
| `src/main/ipc/index.ts`                                  | 2, 3       |
| `src/preload/index.ts`                                   | 2, 3       |
| `src/renderer/pages/ProjectOverview/index.tsx`           | 4          |
| `src/renderer/store/timelineStore.ts`                    | 5, 6, 7, 8 |
| `src/renderer/store/audioPlayerStore.ts`                 | 8          |
| `src/renderer/components/common/AudioPlayer.tsx`         | 8          |
| `src/main/services/mixExport/FilterGraphBuilder.ts`      | 9          |
| `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | 9          |
| `src/main/services/mixExport/CueSheetGenerator.ts`       | 9          |
| `src/main/services/mixExport/CueSheetGenerator.spec.ts`  | 9          |
| `src/main/services/mixExport/MixExportService.ts`        | 9          |
| `src/main/services/mixExport/MixValidator.ts`            | 9          |

---

## 10. Architecture Decisions

### ADR-016: Canvas-per-track rendering

**Status**: Accepted
**Context**: The timeline needs to render waveforms for potentially 20+ tracks with zoom/scroll.
**Decision**: Use one `<canvas>` element per track, not a single monolithic canvas.
**Consequences**: Simplifies hit detection (click → which canvas → which track), allows individual track updates without redrawing all, avoids browser canvas size limits (~32k px). Trade-off: more DOM elements, but lazy rendering (IntersectionObserver) mitigates this.

### ADR-017: BPM detection via custom autocorrelation (Option B)

**Status**: Accepted
**Context**: Three options evaluated: aubio npm package (Option A), FFmpeg + custom autocorrelation (Option B), Web Audio OfflineAudioContext (Option C, rejected — no Web Audio in main process).
**Decision**: Option B — extract PCM via existing FFmpeg infrastructure, run onset detection + autocorrelation in pure TS. No new native dependency.
**Consequences**: Less accurate on complex material than aubio, but sufficient for electronic/DJ music (the primary use case). Keeps dependency tree minimal. Can upgrade to aubio later if accuracy proves insufficient.

### ADR-018: Playhead as DOM element, not canvas

**Status**: Accepted
**Context**: The playhead needs smooth animation synced with audio playback.
**Decision**: Render the playhead as an absolutely positioned `<div>` overlaying the timeline, rather than redrawing canvas frames.
**Consequences**: Much cheaper than canvas redraws at 60fps. Position updated via `requestAnimationFrame` interpolation. Slight visual separation from canvas content is acceptable.

### ADR-019: Waveform disk cache per-project

**Status**: Accepted
**Context**: Waveform extraction takes 1–2s per track. Users re-open projects frequently.
**Decision**: Cache waveform data in binary format (`<songId>.peaks` + `<songId>.meta.json`) in `<projectDir>/assets/waveforms/` with file hash invalidation.
**Consequences**: Near-instant timeline loading on subsequent visits. Binary format is ~4× smaller and ~10× faster to read/write than JSON. Cache invalidated automatically when source file changes (size + mtime hash). Disk space: ~35 KB per track × 20 tracks = ~700 KB per project (negligible).

### ADR-020: Trim fields on Song, not only in CuePoints

**Status**: Accepted
**Context**: Trim boundaries are derived from trim-type cue points but needed by the export pipeline for quick access.
**Decision**: Store `trimStart` and `trimEnd` as top-level Song fields, updated whenever cue points change.
**Consequences**: Export pipeline doesn't need to iterate cue points to find trim bounds. Slight data duplication but simplifies the hot path. Single source of truth remains the cue points (UI derives trim fields from them).

---

## 11. Security Considerations

- FFmpeg processes spawned via `child_process.spawn` with **argument arrays** (not shell strings) — no command injection
- Waveform/BPM file paths validated via Zod schemas on IPC boundary
- No renderer process has direct `child_process` access — all via IPC through preload bridge
- `win.isDestroyed()` check in progress broadcast prevents errors on closed windows
- Cache files written only within project directory (no path traversal)

---

## 12. Risks & Mitigations

| Risk                                         | Impact | Likelihood | Mitigation                                                                         |
| -------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------- |
| BPM detection accuracy on complex material   | Medium | Medium     | Confidence threshold; hide beat grid for low confidence; manual BPM entry (future) |
| Canvas performance with 20+ tracks           | Medium | Low        | Lazy rendering via IntersectionObserver; minimap uses low-res data                 |
| FFmpeg process leak on app quit during batch | High   | Low        | `cleanup()` called from `cleanupServices()`; kills active child process            |
| Canvas size limit exceeded at extreme zoom   | Low    | Low        | Zoom capped at 10×; OffscreenCanvas tiles at 4096px; TimeRuler virtualized         |
| Trim + crossfade interaction edge cases      | Medium | Medium     | Comprehensive tests in Stage 9; auto-clamp with warnings                           |

---

## 13. Open Questions

- **BPM detection library upgrade**: If custom autocorrelation proves insufficient accuracy, evaluate `aubio` npm package as a drop-in replacement in BpmDetector
- **Crossfade curve preview**: Should overlap zones visualize fade curves (triangular, equal-power)? Visual nicety, not blocking
- **Manual BPM adjustment**: Tap-to-correct or grid offset nudge — deferred to a later phase
- **Crossfade audio preview**: True crossfade playback requires simultaneous two-track playback with volume automation — deferred

---

## 14. Success Criteria

### Functional

- [ ] Timeline tab visible in ProjectOverview with real audio waveforms
- [ ] Waveform data cached to disk, loaded lazily with progress
- [ ] Format badge + hover tooltip per track
- [ ] Crossfade zones editable via popover (0–30s slider)
- [ ] BPM detected with beat grid overlay and snap-to-beat
- [ ] Cue points placeable (marker/trim-start/trim-end) with visual markers
- [ ] Trim boundaries dim waveform, respected in export
- [ ] Minimap + zoom + scroll navigation
- [ ] Click-to-play with moving playhead synced to AudioPlayer
- [ ] Export respects trims (atrim filter) and cue points (.cue INDEX entries)

### Non-Functional

- [ ] 20-track project: smooth scrolling, no visible jank
- [ ] Waveform cache hit: < 100ms tab load
- [ ] All existing tests pass after each stage
- [ ] `yarn build` passes after each stage
- [ ] No new native dependencies (FFmpeg + pure TS only)
