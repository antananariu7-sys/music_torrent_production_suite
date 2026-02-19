# 17 — Audio Mix Export

> Renders the ordered MixTab tracklist into a single continuous audio file with per-track crossfades, loudness normalization, and an optional .cue sheet.

**Status**: Planned
**Depends on**: Component 3 (Mix Builder, doc 16), ProjectService, AudioHandlers
**Supersedes**: "Export mix" out-of-scope item from doc 16 §10
**Feature spec**: [docs/features/audio-mix-export.md](../features/audio-mix-export.md)

---

## 1. Overview

Users build ordered tracklists in MixTab from mixed-format sources (torrents, local files). This feature exports the mix as a single audio file with:

- Per-track crossfade controls (0–30s, default 5s)
- EBU R128 loudness normalization
- WAV / FLAC / MP3 output formats
- Optional .cue sheet with track boundaries
- Background rendering with progress reporting

### What's deferred to v2

- Waveform timeline visualization (complex standalone feature — see §12)
- Beat-matching / BPM detection
- Per-track EQ, effects, volume curves
- Real-time crossfade preview

---

## 2. Data Model Changes

### 2.1 Song — new optional field

```typescript
// In src/shared/types/project.types.ts — Song interface
interface Song {
  // ... existing fields ...
  crossfadeDuration?: number  // seconds into NEXT track. undefined = use default. Range: 0–30.
}
```

Last song in the mix ignores this field. Persisted in `project.json` via existing `ProjectService.updateSong()`.

### 2.2 New type: MixExportConfig

Stored in `project.json` under `project.mixExportConfig` (new top-level field on `Project`).

```typescript
// In src/shared/types/project.types.ts

export interface MixExportConfig {
  defaultCrossfadeDuration: number       // Default: 5 (seconds)
  normalization: boolean                 // Default: true
  outputFormat: 'wav' | 'flac' | 'mp3'  // Default: 'flac'
  mp3Bitrate: 128 | 192 | 256 | 320     // Default: 320
  generateCueSheet: boolean              // Default: true
}
```

**Why separate from MixMetadata?** MixMetadata describes the _content_ (title, genre, tags). Export config describes _rendering preferences_. Keeping them separate avoids polluting the mix identity with transient export settings.

### 2.3 Project — new optional field

```typescript
interface Project {
  // ... existing fields ...
  mixExportConfig?: MixExportConfig  // Persisted export preferences
}
```

### 2.4 New type: MixExportRequest

```typescript
export interface MixExportRequest {
  projectId: string
  outputDirectory: string    // User-selected output dir
  outputFilename: string     // Without extension
  format: 'wav' | 'flac' | 'mp3'
  mp3Bitrate?: 128 | 192 | 256 | 320
  normalization: boolean
  generateCueSheet: boolean
  defaultCrossfadeDuration: number
}
```

### 2.5 New type: MixExportProgress

```typescript
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

---

## 3. IPC Design

### 3.1 Channel constants

Added to `src/shared/constants.ts` following the existing 2-level `namespace:action` convention:

```typescript
// Audio mix export
MIX_EXPORT_START:    'mix-export:start',     // R→M  request-response
MIX_EXPORT_CANCEL:   'mix-export:cancel',    // R→M  request-response
MIX_EXPORT_PROGRESS: 'mix-export:progress',  // M→R  push event
MIX_EXPORT_ESTIMATE: 'mix-export:estimate',  // R→M  request-response
```

> **Note**: The feature spec used `mix:export:start` (3-level). The codebase convention is 2-level, so we use `mix-export:*`.

### 3.2 Channel details

| Channel | Pattern | Direction | Payload → Return |
|---------|---------|-----------|------------------|
| `mix-export:start` | `handle/invoke` | R → M | `MixExportRequest` → `ApiResponse<{ jobId: string }>` |
| `mix-export:cancel` | `handle/invoke` | R → M | `void` → `ApiResponse<void>` |
| `mix-export:progress` | `send/on` | M → R | `MixExportProgress` (push, ~1s interval) |
| `mix-export:estimate` | `handle/invoke` | R → M | `MixExportRequest` → `ApiResponse<{ estimatedSizeBytes: number; estimatedDurationSeconds: number }>` |

### 3.3 Preload additions

```typescript
// In src/preload/index.ts — add to api object
mixExport: {
  start: (request: MixExportRequest): Promise<ApiResponse<{ jobId: string }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_START, request),

  cancel: (): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_CANCEL),

  estimate: (request: MixExportRequest): Promise<ApiResponse<{ estimatedSizeBytes: number; estimatedDurationSeconds: number }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MIX_EXPORT_ESTIMATE, request),

  onProgress: (callback: (progress: MixExportProgress) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: MixExportProgress) => {
      callback(progress)
    }
    ipcRenderer.on(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.MIX_EXPORT_PROGRESS, handler)
    }
  },
},
```

---

## 4. Service Architecture

### 4.1 New service: AudioExportService

**File**: `src/main/services/AudioExportService.ts`
**Test**: `src/main/services/AudioExportService.spec.ts`

```
AudioExportService
├── Dependencies
│   ├── ProjectService      (get active project, resolve song files)
│   └── ffmpegBinaryPath    (resolved at init from ffmpeg-static)
│
├── Public API
│   ├── startExport(request: MixExportRequest): Promise<{ jobId: string }>
│   ├── cancelExport(): void
│   └── estimateOutputSize(request: MixExportRequest): { estimatedSizeBytes; estimatedDurationSeconds }
│
├── Internal Pipeline
│   ├── validateSongs(songs: Song[]): ValidationResult
│   ├── analyzeLoudness(filePath: string): Promise<LoudnormParams>
│   ├── buildFilterGraph(songs: Song[], config: ExportConfig): string
│   ├── runFfmpeg(args: string[]): Promise<void>  (child_process.spawn)
│   ├── generateCueSheet(songs: Song[], crossfades: number[]): string
│   └── broadcastProgress(progress: MixExportProgress): void
│
└── State
    ├── currentJob: ExportJob | null     (only one export at a time)
    └── ffmpegProcess: ChildProcess | null
```

### 4.2 Rendering pipeline

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  1. Validate │───▶│  2. Analyze  │───▶│  3. Render   │───▶│  4. Cue     │───▶│ 5. Done  │
│  song files  │    │  loudness    │    │  FFmpeg      │    │  sheet      │    │ cleanup  │
│              │    │  (per track) │    │  filter      │    │  generation │    │          │
└─────────────┘    └─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
     ▲ blocks            progress           progress          instant
     │ on error          broadcast           broadcast
```

**Step 1 — Validate**: Resolve each song's file path (`localFilePath` ?? `externalFilePath`). Check `fs.existsSync()`. Return missing files list.

**Step 2 — Analyze loudness**: For each track, run FFmpeg `loudnorm` filter in measurement mode (first pass):
```bash
ffmpeg -i <input> -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -
```
Parse JSON output for `input_i`, `input_tp`, `input_lra`, `input_thresh`. Broadcast progress per-track.

**Step 3 — Render**: Build an FFmpeg complex filter graph that:
1. Decodes all inputs
2. Applies `loudnorm` second pass with measured parameters
3. Applies `acrossfade` between consecutive pairs
4. Encodes to target format

For mixes with >15 tracks, use **chunked rendering**: process in groups of 8, then concatenate chunks. This avoids FFmpeg filter graph limits.

**Step 4 — Cue sheet**: Generate `.cue` file by computing track start times:
```
startTime[0] = 0
startTime[i] = startTime[i-1] + duration[i-1] - crossfade[i-1]
```

**Step 5 — Cleanup**: Remove temp files. On cancel: kill FFmpeg process, delete partial output.

### 4.3 FFmpeg process management

```typescript
// Spawn FFmpeg as child process
const proc = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })

// Parse stderr for progress (FFmpeg writes progress to stderr)
proc.stderr.on('data', (chunk: Buffer) => {
  const line = chunk.toString()
  // Parse "time=HH:MM:SS.ms" for progress calculation
  const match = line.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  if (match) {
    const seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3])
    const percentage = (seconds / totalDuration) * 100
    broadcastProgress({ phase: 'rendering', percentage, ... })
  }
})

// Cancel support
cancelExport() {
  if (this.ffmpegProcess) {
    this.ffmpegProcess.kill('SIGTERM')
    // Cleanup partial files
  }
}
```

### 4.4 Progress broadcasting

Following the established `ProgressBroadcaster` pattern from WebTorrent:

```typescript
private broadcastProgress(progress: MixExportProgress): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send(IPC_CHANNELS.MIX_EXPORT_PROGRESS, progress)
  })
}
```

No interval needed — progress is event-driven from FFmpeg stderr output.

---

## 5. IPC Handler

**File**: `src/main/ipc/mixExportHandlers.ts`

```typescript
export function registerMixExportHandlers(
  audioExportService: AudioExportService
): void {
  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_START, async (_event, request: MixExportRequest) => {
    // Zod validation on request
    const result = await audioExportService.startExport(request)
    return { success: true, data: result }
  })

  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_CANCEL, async () => {
    audioExportService.cancelExport()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.MIX_EXPORT_ESTIMATE, async (_event, request: MixExportRequest) => {
    const estimate = audioExportService.estimateOutputSize(request)
    return { success: true, data: estimate }
  })
}
```

**Registration** in `src/main/ipc/index.ts`:
```typescript
import { AudioExportService } from '../services/AudioExportService'
import { registerMixExportHandlers } from './mixExportHandlers'

// In registerIpcHandlers():
const audioExportService = new AudioExportService(projectService)
registerMixExportHandlers(audioExportService)
```

---

## 6. Dependency: FFmpeg Binary

### 6.1 Package choice

Use `ffmpeg-static` — provides pre-built FFmpeg binaries per platform via npm.

```bash
yarn add ffmpeg-static
```

### 6.2 Binary path resolution

```typescript
import ffmpegPath from 'ffmpeg-static'

// In packaged app, resolve from resources:
function getFfmpegPath(): string {
  if (app.isPackaged) {
    return ffmpegPath!.replace('app.asar', 'app.asar.unpacked')
  }
  return ffmpegPath!
}
```

### 6.3 esbuild configuration

`ffmpeg-static` must be added to the `external` array in the esbuild config (same treatment as `webtorrent`):

```typescript
// In esbuild config for main process
external: ['electron', 'webtorrent', 'ffmpeg-static']
```

The binary itself is a native file, not JS — it must be unpacked from asar. Add to `package.json` build config:

```json
{
  "build": {
    "asarUnpack": ["node_modules/ffmpeg-static/**"]
  }
}
```

---

## 7. Renderer Architecture

### 7.1 New components

```
src/renderer/components/features/mix/
├── CrossfadeControl.tsx       // Inline between song rows (number input, 0–30s)
├── ExportMixButton.tsx        // "Export Mix" button in MixTab header
├── ExportMixDialog.tsx        // Modal: format, quality, path, toggles, size estimate
└── ExportProgressBar.tsx      // Inline progress in MixTab during render
```

### 7.2 New store: useMixExportStore

```typescript
// src/renderer/store/mixExportStore.ts
interface MixExportState {
  isExporting: boolean
  progress: MixExportProgress | null

  // Actions
  startExport: (request: MixExportRequest) => Promise<void>
  cancelExport: () => Promise<void>
  setProgress: (progress: MixExportProgress) => void
  reset: () => void
}
```

### 7.3 Progress listener mounting

Mount the progress listener at `MixTab` level (not App level — export is only relevant in mix context):

```typescript
// In MixTab.tsx or a dedicated useMixExportListener hook
useEffect(() => {
  const cleanup = window.api.mixExport.onProgress((progress) => {
    useMixExportStore.getState().setProgress(progress)

    if (progress.phase === 'complete') {
      toaster.create({
        title: 'Mix exported successfully',
        description: progress.outputPath,
        type: 'success',
        action: {
          label: 'Open folder',
          onClick: () => window.api.openPath(path.dirname(progress.outputPath!))
        }
      })
    }
  })
  return cleanup
}, [])
```

### 7.4 MixTab integration

```
MixTab (updated)
├── Mix Header
│   ├── Stats (track count, duration, size)  ← existing
│   ├── Play All button                       ← existing
│   └── Export Mix button                     ← NEW
├── MixTracklist                              ← existing
│   └── Between each song pair:
│       └── CrossfadeControl                  ← NEW
├── ExportProgressBar (visible during render) ← NEW
├── AddFilesDropZone                          ← existing
└── MetadataSection                           ← existing
```

---

## 8. File Size Estimation

Computed client-side from song durations and target format, before the export starts:

```typescript
function estimateOutputSize(songs: Song[], config: MixExportRequest): number {
  const totalDuration = songs.reduce((sum, song, i) => {
    const crossfade = i < songs.length - 1
      ? (song.crossfadeDuration ?? config.defaultCrossfadeDuration)
      : 0
    return sum + (song.duration ?? 0) - crossfade
  }, 0)

  // Bytes per second by format
  const bytesPerSecond: Record<string, number> = {
    wav:  44100 * 2 * 2,        // 44.1kHz, 16-bit, stereo = ~176 KB/s
    flac: 44100 * 2 * 2 * 0.6,  // ~60% of WAV (typical compression)
    mp3:  (config.mp3Bitrate ?? 320) * 1000 / 8,
  }

  return Math.round(totalDuration * bytesPerSecond[config.format])
}
```

This runs in the renderer for instant UI updates. The `mix-export:estimate` IPC channel is available for a more precise server-side calculation if needed.

---

## 9. Cue Sheet Generation

Standard `.cue` format compatible with foobar2000, VLC, and CD burning tools:

```
PERFORMER "Mix Title"
TITLE "Mix Title"
FILE "output.flac" WAVE
  TRACK 01 AUDIO
    TITLE "Song One"
    PERFORMER "Artist One"
    INDEX 01 00:00:00
  TRACK 02 AUDIO
    TITLE "Song Two"
    PERFORMER "Artist Two"
    INDEX 01 04:35:50
```

Track start timestamps account for crossfade overlaps. Written to the same output directory as the audio file.

---

## 10. Error Handling

| Error | Detection | User Action |
|-------|-----------|-------------|
| Missing audio files | `fs.existsSync()` in validate step | Block export. Show list. Offer "skip missing" fallback. |
| FFmpeg binary not found | `fs.existsSync(ffmpegPath)` at service init | Show error toast with instructions |
| FFmpeg process error | Non-zero exit code, stderr parsing | Show error with FFmpeg stderr excerpt |
| Disk space low | Compare estimate to `fs.statfs()` free space | Warn before starting, don't block |
| Crossfade > track duration | Compare at validate step | Clamp to `min(trackA_remaining, trackB_duration) - 1s`, warn |
| Export already in progress | Check `currentJob !== null` | Disable Export button, show current progress |
| App quit during export | `before-quit` event handler | Kill FFmpeg, cleanup temp files |

---

## 11. Security Considerations

- FFmpeg is spawned via `child_process.spawn` with **argument array** (not shell string) — prevents command injection
- User-selected output path is validated: must be a real directory, writable
- No renderer process has direct access to `child_process` — all via IPC through preload bridge
- `ffmpeg-static` binary is verified via npm integrity hashes

---

## 12. Deferred: Waveform Timeline (v2)

The feature spec includes a waveform timeline. This is deferred because:

1. **Standalone complexity**: Requires FFmpeg peak extraction, downsampling, caching, canvas/SVG rendering, horizontal scrolling, zoom, and crossfade zone overlays
2. **Performance concern**: Extracting peaks for 20+ tracks on project open would block UX
3. **Separate value**: Waveform visualization is useful independently of export

When implemented, the approach would be:
- Extract peaks via FFmpeg: `ffmpeg -i <input> -af "aformat=channel_layouts=mono" -f rawvideo -pix_fmt gray -`
- Downsample to ~1000 peaks per track
- Cache in `{projectDir}/assets/waveforms/{songId}.json`
- Render via `<canvas>` for performance
- New IPC channels: `waveform:generate`, `waveform:data`

---

## 13. Implementation Plan

### Phase 1 — Foundation (crossfades + data model)
1. Add `crossfadeDuration` to `Song` type and `MixExportConfig` / `MixExportRequest` / `MixExportProgress` types
2. Add `mixExportConfig` to `Project` interface
3. Add `CrossfadeControl` component between tracklist rows
4. Persist crossfade values via `updateSong()`

### Phase 2 — FFmpeg integration
5. Add `ffmpeg-static` dependency, configure esbuild externals + asar unpack
6. Create `AudioExportService` with validate + analyze + render pipeline
7. Add IPC channels to constants, create `mixExportHandlers.ts`, register in index
8. Add preload API (`window.api.mixExport.*`)

### Phase 3 — Export UI
9. Create `ExportMixDialog` (format, quality, path, toggles, size estimate)
10. Create `ExportMixButton` in MixTab header
11. Create `ExportProgressBar` with cancel support
12. Create `useMixExportStore` and wire progress listener

### Phase 4 — Polish
13. Cue sheet generation
14. Edge cases: missing files dialog, crossfade clamping, disk space warning
15. Cleanup on cancel and app quit
16. Tests for `AudioExportService` (mock `child_process.spawn`)

### File budget

| File | Est. Lines | Category |
|------|-----------|----------|
| `AudioExportService.ts` | ~300 | Main Service |
| `AudioExportService.spec.ts` | ~250 | Test |
| `mixExportHandlers.ts` | ~50 | IPC Handler |
| `ExportMixDialog.tsx` | ~200 | Renderer Component |
| `CrossfadeControl.tsx` | ~60 | Renderer Component |
| `ExportProgressBar.tsx` | ~80 | Renderer Component |
| `ExportMixButton.tsx` | ~30 | Renderer Component |
| `mixExportStore.ts` | ~60 | Store |
| Types additions | ~60 | Shared |
| Constants additions | ~10 | Shared |
| **Total** | **~1100** | |

---

## 14. ADR: FFmpeg Approach

**Decision**: Use `ffmpeg-static` with `child_process.spawn`.

**Alternatives considered**:
- **`fluent-ffmpeg`**: Wrapper library. Adds abstraction but also complexity and another dependency. Raw spawn is sufficient for our fixed pipeline.
- **WebAssembly FFmpeg (`ffmpeg.wasm`)**: Runs in-process. But 10x slower than native binary and doesn't support all codecs. Rejected for production use.
- **`audiobuffer` + Web Audio API**: Pure JS. Cannot encode FLAC/MP3. No loudness normalization. Rejected.

**Rationale**: Native FFmpeg via `child_process.spawn` gives full codec support, native performance, and proven stability. `ffmpeg-static` handles cross-platform binary distribution. The binary is well-isolated (separate process, argument-array spawn, no shell).
