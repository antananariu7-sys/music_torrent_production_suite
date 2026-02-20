# 17 — Audio Mix Export

> Renders the ordered MixTab tracklist into a single continuous audio file with per-track crossfades, loudness normalization, and an optional .cue sheet.

**Status**: Phase 1 Complete (v1 working)
**Depends on**: Component 3 (Mix Builder, doc 16), ProjectService, AudioHandlers
**Supersedes**: "Export mix" out-of-scope item from doc 16 §10
**Feature spec**: [docs/features/audio-mix-export.md](../features/audio-mix-export.md)

---

## 1. Overview

Users build ordered tracklists in MixTab from mixed-format sources (torrents, local files). This feature exports the mix as a single audio file with:

- Per-track crossfade controls (0–30s, default 5s)
- EBU R128 loudness normalization
- WAV (24-bit) / FLAC (level 8) / MP3 output formats
- Optional .cue sheet with track boundaries
- Background rendering with progress reporting

### What's deferred to Phase 2

- Chunked rendering for large mixes (>15 tracks)
- Zod validation on IPC boundaries
- Export config persistence (save last-used settings back to project)
- Accessibility improvements (focus trapping, ESC key in modal)
- LoudnormAnalyzer unit tests
- Skip-missing-tracks fallback
- Disk space pre-check

### What's deferred to v2

- Waveform timeline visualization (complex standalone feature — see §12)
- Beat-matching / BPM detection
- Per-track EQ, effects, volume curves
- Real-time crossfade preview

---

## 2. Data Model

### 2.1 Song — crossfade field

```typescript
// In src/shared/types/project.types.ts — Song interface
interface Song {
  // ... existing fields ...
  crossfadeDuration?: number  // seconds into NEXT track. undefined = use default. Range: 0–30.
}
```

Last song in the mix ignores this field. Persisted in `project.json` via existing `ProjectService.updateSong()`.

### 2.2 MixExportConfig

Stored in `project.json` under `project.mixMetadata.exportConfig` (nested in MixMetadata, not a top-level Project field).

```typescript
// In src/shared/types/mixExport.types.ts

export type OutputFormat = 'wav' | 'flac' | 'mp3'
export type Mp3Bitrate = 128 | 192 | 256 | 320

export interface MixExportConfig {
  defaultCrossfadeDuration: number       // Default: 5 (seconds)
  normalization: boolean                 // Default: true
  outputFormat: OutputFormat             // Default: 'flac'
  mp3Bitrate: Mp3Bitrate                // Default: 320
  generateCueSheet: boolean              // Default: true
}
```

MixMetadata references it via dynamic import type:
```typescript
// In src/shared/types/project.types.ts — MixMetadata interface
exportConfig?: import('./mixExport.types').MixExportConfig
```

### 2.3 MixExportRequest

```typescript
// In src/shared/types/mixExport.types.ts
export interface MixExportRequest {
  projectId: string
  outputDirectory: string    // User-selected output dir
  outputFilename: string     // Without extension
  format: OutputFormat
  mp3Bitrate?: Mp3Bitrate
  normalization: boolean
  generateCueSheet: boolean
  defaultCrossfadeDuration: number
}
```

### 2.4 MixExportProgress

```typescript
// In src/shared/types/mixExport.types.ts
export interface MixExportProgress {
  phase: 'validating' | 'analyzing' | 'rendering' | 'encoding' | 'complete' | 'error' | 'cancelled'
  currentTrackIndex: number   // 0-based
  currentTrackName: string
  totalTracks: number
  percentage: number          // 0–100
  eta?: number                // seconds remaining (estimated)
  outputPath?: string         // Set on 'complete'
  error?: string              // Set on 'error'
}
```

### 2.5 Supporting types

```typescript
// In src/shared/types/mixExport.types.ts
export interface LoudnormAnalysis {
  input_i: number       // Integrated loudness (LUFS)
  input_tp: number      // True peak (dBTP)
  input_lra: number     // Loudness range (LU)
  input_thresh: number  // Noise gate threshold (LUFS)
}

export interface FfmpegCheckResult {
  version: string
  path: string
}
```

---

## 3. IPC Design

### 3.1 Channel constants

In `src/shared/constants.ts`, following the 2-level `namespace:action` convention:

```typescript
// Audio mix export
MIX_EXPORT_START:       'mix-export:start',        // R→M  request-response
MIX_EXPORT_CANCEL:      'mix-export:cancel',       // R→M  request-response
MIX_EXPORT_PROGRESS:    'mix-export:progress',     // M→R  push event
MIX_EXPORT_FFMPEG_CHECK: 'mix-export:ffmpeg-check', // R→M  request-response
```

### 3.2 Channel details

| Channel | Pattern | Direction | Payload → Return | Status |
|---------|---------|-----------|------------------|--------|
| `mix-export:start` | `handle/invoke` | R → M | `MixExportRequest` → `ApiResponse<{ jobId: string }>` | ✅ |
| `mix-export:cancel` | `handle/invoke` | R → M | `void` → `ApiResponse<void>` | ✅ |
| `mix-export:progress` | `send/on` | M → R | `MixExportProgress` (event-driven) | ✅ |
| `mix-export:ffmpeg-check` | `handle/invoke` | R → M | `void` → `ApiResponse<FfmpegCheckResult>` | ✅ |
| `mix-export:estimate` | `handle/invoke` | R → M | — | ⏳ unused (estimate is client-side) |

### 3.3 Preload API

```typescript
// In src/preload/index.ts — window.api.mixExport
mixExport: {
  checkFfmpeg: () => Promise<ApiResponse<FfmpegCheckResult>>,
  start: (request: MixExportRequest) => Promise<ApiResponse<{ jobId: string }>>,
  cancel: () => Promise<ApiResponse<void>>,
  onProgress: (callback: (progress: MixExportProgress) => void) => (() => void),  // returns cleanup
}
```

---

## 4. Service Architecture

### 4.1 MixExportService (main orchestrator)

**File**: `src/main/services/mixExport/MixExportService.ts` (~282 lines)

```
MixExportService
├── Dependencies
│   └── ProjectService       (get active project, resolve song files)
│
├── Public API
│   ├── startExport(request: MixExportRequest): Promise<{ jobId: string }>
│   ├── cancelExport(): void
│   └── cleanup(): void      (for app quit — delegates to cancelExport)
│
├── Internal Pipeline (runPipeline)
│   ├── Phase 1: validateSongs() → MixValidator
│   ├── Phase 1b: clampCrossfade() → MixValidator
│   ├── Phase 2: analyzeLoudness() → LoudnormAnalyzer (per track, sequential)
│   ├── Phase 3: buildFilterGraph() + spawnFfmpeg() → FilterGraphBuilder + ffmpegRunner
│   ├── Phase 4: generateCueSheet() → CueSheetGenerator
│   └── Phase 5: broadcastProgress(complete)
│
└── State
    └── activeJob: { jobId, process, cancelled, outputPath } | null
```

The pipeline runs async after `startExport()` returns the jobId. Only one export at a time.

### 4.2 Module breakdown

```
src/main/services/mixExport/
├── MixExportService.ts       Main orchestrator — pipeline, state, broadcast
├── FilterGraphBuilder.ts     FFmpeg complex filter graph construction
├── LoudnormAnalyzer.ts       EBU R128 first-pass loudness analysis
├── CueSheetGenerator.ts      .cue sheet generation with crossfade-aware timestamps
├── MixValidator.ts           Song path resolution, file validation, crossfade clamping
└── index.ts                  Barrel exports

src/main/utils/
├── ffmpegPath.ts             Resolve ffmpeg-static binary path (dev vs packaged)
└── ffmpegRunner.ts           Spawn FFmpeg, parse progress, manage process lifecycle
```

### 4.3 Rendering pipeline

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  1. Validate │───▶│  2. Analyze  │───▶│  3. Render   │───▶│  4. Cue     │───▶│ 5. Done  │
│  song files  │    │  loudness    │    │  FFmpeg      │    │  sheet      │    │ cleanup  │
│  + clamp     │    │  (per track) │    │  single pass │    │  generation │    │          │
└─────────────┘    └─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
     ▲ throws          0–20%              20–100%            instant
     │ on missing       progress           progress
```

**Step 1 — Validate + Clamp**: Resolve each song's file path (`localFilePath` ?? `externalFilePath`). Check `fs.existsSync()`. Throws if any missing. Clamp crossfades via `min(currentDuration, nextDuration) - 1`.

**Step 2 — Analyze loudness**: For each track (when normalization enabled), run FFmpeg `loudnorm` filter in measurement mode:
```bash
ffmpeg -i <input> -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -
```
Parse JSON from stderr for `input_i`, `input_tp`, `input_lra`, `input_thresh`.

**Step 3 — Render**: Single-pass FFmpeg with complex filter graph:
1. Per-track: `loudnorm` second pass (with measured params) or `acopy` passthrough
2. Consecutive pairs: `acrossfade=d=N:c1=tri:c2=tri` (triangular crossfade) or `concat` for zero crossfade
3. Encoding: WAV `pcm_s24le` (24-bit), FLAC compression level 8, MP3 `libmp3lame` with configurable bitrate

**Step 4 — Cue sheet**: Compute start times accounting for crossfade overlaps, write `.cue` file.

**Step 5 — Complete**: Broadcast completion with `outputPath`.

Each phase checks `this.activeJob?.cancelled` before proceeding.

### 4.4 FFmpeg process management

**File**: `src/main/utils/ffmpegRunner.ts` (~104 lines)

Two levels of abstraction:
- `spawnFfmpeg(args, onProgress?)` → returns `{ process, promise }` — used for rendering (need process handle for cancel)
- `runFfmpeg(args, onProgress?)` → returns `Promise<FfmpegResult>`, throws on non-zero exit — used for loudness analysis

Progress is parsed from FFmpeg stderr `time=HH:MM:SS.ms` lines. The service converts elapsed time to percentage: `20 + (elapsed / totalDuration) * 80`.

### 4.5 Progress broadcasting

Event-driven (no interval timer), following the WebTorrent `ProgressBroadcaster` pattern:

```typescript
private broadcastProgress(progress: MixExportProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.MIX_EXPORT_PROGRESS, progress)
    }
  }
}
```

---

## 5. IPC Handler

**File**: `src/main/ipc/mixExportHandlers.ts` (~34 lines)

Registers handlers for `MIX_EXPORT_START` and `MIX_EXPORT_CANCEL`. Returns `ApiResponse` format. Error handling via try/catch.

**Registration** in `src/main/ipc/index.ts`:
```typescript
const mixExportService = new MixExportService(projectService)
registerMixExportHandlers(mixExportService)
```

Cleanup in `cleanupServices()`:
```typescript
mixExportService.cleanup()
```

---

## 6. Dependency: FFmpeg Binary

### 6.1 Package

`ffmpeg-static` ^5.3.0 — pre-built FFmpeg binaries per platform via npm.

### 6.2 Binary path resolution

**File**: `src/main/utils/ffmpegPath.ts` (~24 lines)

Uses `require('ffmpeg-static')` (CJS, since main process is esbuild CJS). In packaged app, replaces `app.asar` with `app.asar.unpacked`.

### 6.3 esbuild configuration

`ffmpeg-static` is in the `external` array in `scripts/build-main.mjs`:
```typescript
external: ['electron', ..., 'ffmpeg-static']
```

For packaging, `asarUnpack` must include `node_modules/ffmpeg-static/**`.

---

## 7. Renderer Architecture

### 7.1 Components

```
src/renderer/components/features/mix/
├── CrossfadeControl.tsx       // Inline between song rows (number input, 0–30s, debounced save)
├── ExportConfigModal.tsx      // Custom modal: format, quality, path, toggles, size estimate
└── ExportProgressBar.tsx      // Phase-aware progress with completion actions (play/open folder)
```

The export button is inline in `MixTab.tsx` (not a separate component).

### 7.2 Store: useMixExportStore

**File**: `src/renderer/store/mixExportStore.ts` (~72 lines)

```typescript
interface MixExportState {
  isExporting: boolean
  progress: MixExportProgress | null

  startExport: (request: MixExportRequest) => Promise<void>
  cancelExport: () => Promise<void>
  applyProgress: (progress: MixExportProgress) => void  // also derives isExporting
  reset: () => void
}
```

`applyProgress` automatically sets `isExporting = false` when phase is terminal (`complete`, `error`, `cancelled`).

### 7.3 Progress listener

**File**: `src/renderer/hooks/useMixExportListener.ts` (~20 lines)

Subscribes to `window.api.mixExport.onProgress` in a `useEffect`, feeds into `useMixExportStore.applyProgress`. Called from `MixTab`.

### 7.4 MixTab integration

```
MixTab (updated)
├── Mix Header
│   ├── Stats (track count, duration, size)  ← existing
│   ├── Export Mix button (disabled during export) ← NEW
│   └── Play All button                       ← existing
├── ExportProgressBar (visible during/after export) ← NEW
├── MixTracklist                              ← existing
│   └── Between each song pair:
│       └── CrossfadeControl                  ← NEW
├── AddFilesDropZone                          ← existing
├── MetadataSection                           ← existing
└── ExportConfigModal (dialog)                ← NEW
```

---

## 8. File Size Estimation

Computed **client-side** in `ExportConfigModal.tsx` for instant UI updates. No server-side estimate handler.

```typescript
const bytesPerSecond: Record<string, number> = {
  wav:  44100 * 2 * 3,         // 44.1kHz, 24-bit, stereo = ~264 KB/s
  flac: 44100 * 2 * 3 * 0.6,  // ~60% of WAV (typical FLAC compression)
  mp3:  bitrate * 1000 / 8,   // based on selected bitrate
}
```

Note: WAV uses 24-bit (3 bytes/sample) matching the `pcm_s24le` encoder in FilterGraphBuilder.

---

## 9. Cue Sheet Generation

**File**: `src/main/services/mixExport/CueSheetGenerator.ts` (~71 lines)

Standard `.cue` format (MM:SS:FF at 75fps). Track start times account for crossfade overlaps:
```
startTime[0] = 0
startTime[i] = startTime[i-1] + duration[i-1] - crossfade[i-1]
```

Compatible with foobar2000, VLC, and CD burning tools.

---

## 10. Error Handling

| Error | Detection | User Action |
|-------|-----------|-------------|
| Missing audio files | `fs.existsSync()` in validate step | Blocks export, throws error with track names |
| FFmpeg binary not found | `require('ffmpeg-static')` returns null | Throws at service init |
| FFmpeg process error | Non-zero exit code | Shows error with FFmpeg stderr excerpt (last 500 chars) |
| Crossfade > track duration | `clampCrossfade()` in pipeline | Silently clamped to `min(duration) - 1s` |
| Export already in progress | `this.activeJob` check | Throws; button disabled in UI |
| App quit during export | `cleanup()` called from `cleanupServices()` | Kills FFmpeg, deletes partial output |
| Cancel by user | `cancelExport()` via IPC | Kills FFmpeg (`SIGTERM`), deletes partial output, broadcasts `cancelled` |

---

## 11. Security Considerations

- FFmpeg spawned via `child_process.spawn` with **argument array** (not shell string) — prevents command injection
- No renderer process has direct access to `child_process` — all via IPC through preload bridge
- `ffmpeg-static` binary verified via npm integrity hashes
- `win.isDestroyed()` check in progress broadcast prevents errors on closed windows

---

## 12. Deferred: Waveform Timeline (v2)

The feature spec includes a waveform timeline. Deferred because:

1. **Standalone complexity**: Requires FFmpeg peak extraction, downsampling, caching, canvas/SVG rendering, horizontal scrolling, zoom, and crossfade zone overlays
2. **Performance concern**: Extracting peaks for 20+ tracks on project open would block UX
3. **Separate value**: Waveform visualization is useful independently of export

When implemented:
- Extract peaks via FFmpeg → downsample to ~1000 peaks per track
- Cache in `{projectDir}/assets/waveforms/{songId}.json`
- Render via `<canvas>` for performance
- New IPC channels: `waveform:generate`, `waveform:data`

---

## 13. Implementation Status

### Phase 1 — v1 Complete ✅

All core functionality implemented across 4 commits:

| Item | File | Lines | Status |
|------|------|-------|--------|
| Types (`MixExportConfig`, `Request`, `Progress`, `LoudnormAnalysis`, `FfmpegCheckResult`) | `src/shared/types/mixExport.types.ts` | 62 | ✅ |
| `crossfadeDuration` on Song, `exportConfig` on MixMetadata | `src/shared/types/project.types.ts` | +2 | ✅ |
| IPC constants (5 channels) | `src/shared/constants.ts` | +6 | ✅ |
| FFmpeg path resolution | `src/main/utils/ffmpegPath.ts` | 24 | ✅ |
| FFmpeg process runner | `src/main/utils/ffmpegRunner.ts` | 104 | ✅ |
| MixExportService (orchestrator) | `src/main/services/mixExport/MixExportService.ts` | 282 | ✅ |
| FilterGraphBuilder | `src/main/services/mixExport/FilterGraphBuilder.ts` | 121 | ✅ |
| FilterGraphBuilder tests | `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | 147 | ✅ |
| LoudnormAnalyzer | `src/main/services/mixExport/LoudnormAnalyzer.ts` | 45 | ✅ |
| CueSheetGenerator | `src/main/services/mixExport/CueSheetGenerator.ts` | 71 | ✅ |
| CueSheetGenerator tests | `src/main/services/mixExport/CueSheetGenerator.spec.ts` | 111 | ✅ |
| MixValidator | `src/main/services/mixExport/MixValidator.ts` | 59 | ✅ |
| MixValidator tests | `src/main/services/mixExport/MixValidator.spec.ts` | 116 | ✅ |
| Barrel exports | `src/main/services/mixExport/index.ts` | 5 | ✅ |
| IPC handlers | `src/main/ipc/mixExportHandlers.ts` | 34 | ✅ |
| Handler + service registration | `src/main/ipc/index.ts` | +6 | ✅ |
| Preload API (`mixExport.*`) | `src/preload/index.ts` | +18 | ✅ |
| CrossfadeControl | `src/renderer/components/features/mix/CrossfadeControl.tsx` | 59 | ✅ |
| ExportConfigModal | `src/renderer/components/features/mix/ExportConfigModal.tsx` | 289 | ✅ |
| ExportProgressBar | `src/renderer/components/features/mix/ExportProgressBar.tsx` | 169 | ✅ |
| MixTracklist (updated) | `src/renderer/components/features/mix/MixTracklist.tsx` | 259 | ✅ |
| useMixExportListener hook | `src/renderer/hooks/useMixExportListener.ts` | 20 | ✅ |
| mixExportStore | `src/renderer/store/mixExportStore.ts` | 72 | ✅ |
| MixTab (updated) | `src/renderer/.../tabs/MixTab.tsx` | 135 | ✅ |
| **Total new/modified** | | **~1779** | |

### Phase 2 — Quality & Robustness (Planned)

See §14 for detailed plan.

---

## 14. Phase 2 Plan — Quality & Robustness

### 14.1 Bug fixes

| # | Issue | File | Severity |
|---|-------|------|----------|
| B1 | CUE frame overflow: `Math.round()` can produce 75 (max is 74) | `CueSheetGenerator.ts:14` | High |
| B2 | `clampCrossfade` falsy check: `duration: 0` skips clamping | `MixValidator.ts:45` | Medium |
| B3 | CrossfadeControl debounce not cleaned up on unmount | `CrossfadeControl.tsx` | Medium |

### 14.2 Missing tests

| # | Item | File to create |
|---|------|----------------|
| T1 | LoudnormAnalyzer — parse various FFmpeg stderr outputs | `LoudnormAnalyzer.spec.ts` |
| T2 | ffmpegRunner — parseTimeProgress unit tests | `ffmpegRunner.spec.ts` |

### 14.3 IPC hardening

| # | Item | File |
|---|------|------|
| H1 | ~~Add Zod schema for `MixExportRequest` validation on IPC boundary~~ | `mixExportHandlers.ts` | ✅ |
| H2 | ~~Remove unused `MIX_EXPORT_ESTIMATE` constant~~ | `constants.ts` | ✅ |

### 14.4 Export config persistence

| # | Item | File |
|---|------|------|
| P1 | Save last-used export settings back to `project.mixMetadata.exportConfig` after successful export | `MixExportService.ts` or `mixExportStore.ts` |

### 14.5 UX improvements

| # | Item | File |
|---|------|------|
| U1 | ExportConfigModal: use Chakra Dialog for focus trapping + ESC key + ARIA | `ExportConfigModal.tsx` |
| U2 | Remove auto-open folder on completion; keep as explicit button action only | `ExportProgressBar.tsx` |
| U3 | Missing files: show list in modal with "Export available tracks only" fallback | `ExportConfigModal.tsx` + `MixExportService.ts` |

### 14.6 Robustness

| # | Item | File |
|---|------|------|
| R1 | Chunked rendering for >15 tracks (process in groups of 8, concatenate chunks) | `MixExportService.ts` + `FilterGraphBuilder.ts` |
| R2 | Disk space pre-check: compare estimate to free space, warn user | `MixExportService.ts` |
| R3 | Validate output directory exists and is writable before starting | `MixValidator.ts` |

---

## 15. ADR: FFmpeg Approach

**Decision**: Use `ffmpeg-static` with `child_process.spawn`.

**Alternatives considered**:
- **`fluent-ffmpeg`**: Wrapper library. Adds abstraction but also complexity and another dependency. Raw spawn is sufficient for our fixed pipeline.
- **WebAssembly FFmpeg (`ffmpeg.wasm`)**: Runs in-process. But 10x slower than native binary and doesn't support all codecs. Rejected for production use.
- **`audiobuffer` + Web Audio API**: Pure JS. Cannot encode FLAC/MP3. No loudness normalization. Rejected.

**Rationale**: Native FFmpeg via `child_process.spawn` gives full codec support, native performance, and proven stability. `ffmpeg-static` handles cross-platform binary distribution. The binary is well-isolated (separate process, argument-array spawn, no shell).
