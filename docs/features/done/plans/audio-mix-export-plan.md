# Audio Mix Export — Implementation Plan

## Context

Users curate ordered tracklists in MixTab from mixed-format sources (MP3, FLAC, WAV from torrents and local files) but have no way to render them into a single playable mix file. This feature adds per-track crossfading, EBU R128 loudness normalization, multi-format export (WAV/FLAC/MP3 + .cue sheet), waveform visualization, and background rendering with progress.

Full spec: `docs/features/audio-mix-export.md`

---

## Phase 1: FFmpeg Foundation

**Goal:** Install ffmpeg-static, resolve binary path, create spawn wrapper, prove it works via IPC health-check.

### New files

| File                                  | Purpose                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/utils/ffmpegPath.ts`        | Resolve ffmpeg-static binary path (dev vs asar.unpacked)                                                                                    |
| `src/main/utils/ffmpegRunner.ts`      | `spawnFfmpeg(args)` wrapper → returns `{ process, promise, kill }`. Parses `time=HH:MM:SS` progress from stderr                             |
| `src/main/utils/ffmpegRunner.spec.ts` | Unit test: progress line parsing, arg building                                                                                              |
| `src/shared/types/mixExport.types.ts` | All export-related types: `MixExportConfig`, `MixExportRequest`, `MixExportProgress`, `MixExportResult`, `WaveformData`, `LoudnormAnalysis` |

### Modify

| File                            | Change                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                  | Add `ffmpeg-static` to deps. Add `"asarUnpack": ["node_modules/ffmpeg-static/**/*"]` to `build`                                                      |
| `scripts/build-main.mjs`        | Add `'ffmpeg-static'` to `external` array (line 18-28)                                                                                               |
| `src/shared/constants.ts`       | Add IPC channels: `MIX_FFMPEG_CHECK`, `MIX_EXPORT_START`, `MIX_EXPORT_PROGRESS`, `MIX_EXPORT_CANCEL`, `MIX_EXPORT_COMPLETE`, `MIX_WAVEFORM_GENERATE` |
| `src/main/ipc/audioHandlers.ts` | Add `MIX_FFMPEG_CHECK` handler: spawn `ffmpeg -version`, return version string                                                                       |
| `src/preload/index.ts`          | Add `api.mixExport.checkFfmpeg()` invoke                                                                                                             |

### Key details

- `ffmpegPath.ts`: `require('ffmpeg-static')` returns the path; in packaged app replace `app.asar` → `app.asar.unpacked`
- `ffmpegRunner.ts`: `child_process.spawn` with stderr line parsing. FFmpeg reports `time=00:01:23.45` — compare against known total duration for percentage
- Progress regex: `/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/`

### Verify

- `yarn build` passes with ffmpeg-static external
- `yarn test:main --testPathPatterns ffmpegRunner` passes
- In dev: `window.api.mixExport.checkFfmpeg()` returns version

---

## Phase 2: Data Model + Crossfade UI

**Goal:** Add crossfade fields to types, render inline crossfade controls between tracklist rows.

### New files

| File                                                        | Purpose                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix/CrossfadeControl.tsx` | Thin row between songs: number input (0–30s, step 0.5, default 5). Calls `window.api.mix.updateSong()` to persist `crossfadeDuration` |

### Modify

| File                                                    | Change                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/shared/types/project.types.ts`                     | Add `crossfadeDuration?: number` to `Song` (line 37). Add `exportConfig?: MixExportConfig` to `MixMetadata` (line 50) |
| `src/renderer/components/features/mix/MixTracklist.tsx` | Wrap each `Table.Row` in `React.Fragment`, insert `<CrossfadeControl>` between consecutive rows (after line 238)      |

### Key details

- CrossfadeControl renders **outside** the `<Table.Body>` between rows — use a `<Box>` styled as a thin horizontal strip with a centered number input and "crossfade" label
- Actually, since it's inside a `<Table.Root>`, we need to place the control as a special `<Table.Row>` with a single `<Table.Cell colSpan={8}>` containing the crossfade input
- Uses existing `window.api.mix.updateSong(projectId, songId, { crossfadeDuration: value })` — no new IPC needed
- The `crossfadeDuration` field on a song means "overlap duration with the NEXT song"
- Last song has no crossfade control
- Default value when `undefined`: read from `currentProject.mixMetadata.exportConfig?.defaultCrossfadeDuration ?? 5`

### Verify

- Open project with 3+ songs — crossfade controls appear between each pair
- Change duration → close/reopen project → value persists in project.json
- `yarn build` passes

---

## Phase 3: Export Service + Rendering Pipeline (Core)

**Goal:** Build the FFmpeg-powered rendering pipeline: validate → analyze loudness → build filter graph → render → generate .cue.

### New files

| File                                                     | Purpose                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main/services/mixExport/MixExportService.ts`        | Orchestrator class. Manages active export, cancellation, progress broadcasting                                                             |
| `src/main/services/mixExport/LoudnormAnalyzer.ts`        | Per-track FFmpeg `loudnorm` first-pass. Parses JSON from stderr → `LoudnormAnalysis`                                                       |
| `src/main/services/mixExport/FilterGraphBuilder.ts`      | **Pure function.** Builds FFmpeg `-filter_complex` string from songs + crossfades + loudnorm params                                        |
| `src/main/services/mixExport/CueSheetGenerator.ts`       | **Pure function.** Generates .cue content. Track N starts at `sum(prev_durations) - sum(prev_crossfades)`. Format: `MM:SS:FF` (FF = 1/75s) |
| `src/main/services/mixExport/MixValidator.ts`            | Checks all audio files exist, clamps crossfades, returns validation result or missing file list                                            |
| `src/main/services/mixExport/index.ts`                   | Re-exports                                                                                                                                 |
| `src/main/ipc/mixExportHandlers.ts`                      | Handlers for `MIX_EXPORT_START`, `MIX_EXPORT_CANCEL`. Progress broadcast via `BrowserWindow.getAllWindows()`                               |
| `src/main/services/mixExport/FilterGraphBuilder.spec.ts` | Tests: 2 tracks, 5 tracks, zero crossfade, single track, normalization on/off                                                              |
| `src/main/services/mixExport/CueSheetGenerator.spec.ts`  | Tests: timestamp calc with crossfade overlap, single track                                                                                 |
| `src/main/services/mixExport/MixValidator.spec.ts`       | Tests: missing files, crossfade clamping                                                                                                   |

### Modify

| File                    | Change                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/main/ipc/index.ts` | Instantiate `MixExportService`, call `registerMixExportHandlers(mixExportService)`, add to `cleanupServices()`    |
| `src/preload/index.ts`  | Add `api.mixExport.start()`, `api.mixExport.cancel()`, `api.mixExport.onProgress()`, `api.mixExport.onComplete()` |

### Key technical details

**Two-pass loudnorm:**

- Pass 1: `ffmpeg -i file -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -` → parse JSON block from last 12 lines of stderr
- Pass 2: Use measured params in `loudnorm` filter with `linear=true`

**Filter graph (3 tracks, crossfades [5s, 3s]):**

```
[0:a]loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:linear=true[a0];
[1:a]loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:linear=true[a1];
[2:a]loudnorm=I=-14:TP=-1:LRA=11:measured_I=...:linear=true[a2];
[a0][a1]acrossfade=d=5:c1=tri:c2=tri[f01];
[f01][a2]acrossfade=d=3:c1=tri:c2=tri[out]
```

**Output encoding flags:**

- WAV: `-c:a pcm_s24le`
- FLAC: `-c:a flac -compression_level 8`
- MP3: `-c:a libmp3lame -b:a 320k`

**Progress:** Analysis phase = 20% of total. Render phase = 80%. Parse FFmpeg `time=` from stderr, divide by expected total mix duration.

**Cancellation:** Kill FFmpeg child process, delete partial output file, broadcast cancelled status.

### Verify

- `yarn test:main --testPathPatterns mixExport` — all unit tests pass
- Manual test: project with 3 mixed-format tracks → call `window.api.mixExport.start(...)` → valid output file plays seamlessly
- .cue file loads in foobar2000/VLC with correct track markers

---

## Phase 4: Export UI (Modal + Progress + Store)

**Goal:** Renderer-side: export config modal, Zustand store, progress listener, inline progress bar.

### New files

| File                                                         | Purpose                                                                                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/store/mixExportStore.ts`                       | State: `status` (idle/exporting/complete/error), `progress`, `result`. Actions: `startExport`, `cancelExport`, `applyProgress`, `applyComplete`                |
| `src/renderer/hooks/useMixExportListener.ts`                 | Subscribe to `onProgress`/`onComplete` IPC events → feed into store. Mount at App level                                                                        |
| `src/renderer/components/features/mix/ExportConfigModal.tsx` | Chakra modal: format select, bitrate (conditional on MP3), normalization toggle, cue sheet toggle, directory picker, filename, estimated size, "Render" button |
| `src/renderer/components/features/mix/ExportProgressBar.tsx` | Inline in MixTab: progress bar, phase label, current track, %, ETA, cancel button                                                                              |
| `src/renderer/components/features/mix/MissingFilesAlert.tsx` | List of missing files shown when validation fails, with "Export available only" fallback button                                                                |

### Modify

| File                                                            | Change                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/renderer/App.tsx`                                          | Mount `useMixExportListener()` alongside existing `useDownloadQueueListener()`                 |
| `src/renderer/pages/ProjectOverview/components/tabs/MixTab.tsx` | Add "Export Mix" button in header area. Render `<ExportConfigModal>` and `<ExportProgressBar>` |

### Key details

- Store pattern follows `downloadQueueStore.ts`: `create<MixExportState>((set) => ({...}))`
- Listener hook follows `useDownloadQueueListener.ts`: useEffect with cleanup functions
- Modal pre-populates from `currentProject.mixMetadata.exportConfig` (or defaults)
- Estimated size: `totalDuration * bitrate / 8` for MP3; heuristic for WAV/FLAC
- Toast on completion with "Open folder" action via `window.api.openPath()`
- Disable "Render" button while export in progress

### Verify

- Export modal opens with correct defaults, format-conditional UI works
- Progress bar updates in real-time during render, persists across tab navigation
- Cancel stops rendering, cleans up, shows toast
- Successful render shows completion toast with "Open folder"

---

## Phase 5: Waveform Timeline

**Goal:** Extract audio peaks via FFmpeg, render scrollable waveform timeline with crossfade overlap visualization.

### New files

| File                                                        | Purpose                                                                                                                     |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/mixExport/WaveformExtractor.ts`          | Decode to mono f32le PCM at 8kHz via FFmpeg → downsample to ~1000 peaks → return `WaveformData`                             |
| `src/renderer/components/features/mix/WaveformTimeline.tsx` | Horizontal scrollable container. Positions tracks with overlap proportional to crossfade duration. Shows total mix duration |
| `src/renderer/components/features/mix/WaveformTrack.tsx`    | `<canvas>` rendering of peaks as mirrored vertical bars. Track label overlay. Crossfade zone highlighted                    |
| `src/renderer/hooks/useWaveformData.ts`                     | Requests waveform data for all songs, caches in-memory by songId, recomputes when songs change                              |

### Modify

| File                                                            | Change                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| `src/main/ipc/mixExportHandlers.ts`                             | Add `MIX_WAVEFORM_GENERATE` handler                    |
| `src/preload/index.ts`                                          | Add `api.mixExport.generateWaveform(songId, filePath)` |
| `src/renderer/pages/ProjectOverview/components/tabs/MixTab.tsx` | Add `<WaveformTimeline>` below `<MixTracklist>`        |

### Key details

- FFmpeg command: `ffmpeg -i <file> -ac 1 -ar 8000 -f f32le pipe:1` → collect stdout Buffer → Float32Array → downsample to 1000 peaks (max abs per window) → normalize to 0–1
- Timeline layout: absolute positioning. Each track's left offset = `sum(prev_durations - prev_crossfades) / totalMixDuration * containerWidth`
- Waveform cached in Zustand store, not persisted to disk (cheap to recompute: ~1-2s per track)
- Crossfade zones rendered as semi-transparent colored overlay on the canvas

### Verify

- Waveforms load progressively when MixTab opens
- Adjust crossfade → overlap zone visually changes
- Reorder/add/remove songs → waveforms reposition
- Horizontal scroll works for long mixes

---

## Phase 6: Edge Cases + Polish

**Goal:** Handle all edge cases from the spec.

### Changes across existing files

- **Single track:** FilterGraphBuilder skips acrossfade filter. CueSheetGenerator outputs one entry
- **Zero crossfade:** Use `concat` filter instead of `acrossfade` for that transition
- **Crossfade > track duration:** MixValidator clamps to `min(trackA_remaining, trackB_duration) - 1s`, shows warning toast
- **Missing files:** MixValidator returns missing list → modal shows `MissingFilesAlert` → "Skip missing" re-runs with adjusted crossfades
- **Concurrent export:** `MixExportService.startExport()` rejects if `this.activeExport` is non-null
- **Cancel mid-render:** Kill FFmpeg process, delete partial file, broadcast cancelled status
- **Disk space:** Estimate output size before render, warn if free space < 2x estimate

### Verify

- Export with 1 track works
- Missing file blocks export, "Skip" fallback works
- Concurrent export rejected
- Cancel deletes partial file
- `yarn test:main --testPathPatterns mixExport` — all edge case tests pass
- `yarn build` passes

---

## File Inventory Summary

**27 new files** (17 main process, 1 shared types, 9 renderer)
**10 modified files** (package.json, build-main.mjs, constants.ts, project.types.ts, ipc/index.ts, audioHandlers.ts, preload/index.ts, App.tsx, MixTab.tsx, MixTracklist.tsx)

## Verification (End-to-End)

1. `yarn build` — full build passes
2. `yarn test:main --testPathPatterns mixExport` — all unit tests pass
3. `yarn test:main --testPathPatterns ffmpeg` — FFmpeg utils tests pass
4. Manual: create project with 3+ mixed-format songs → set crossfades → export as FLAC → output plays seamlessly with correct crossfades and normalized loudness
5. Verify .cue file has correct timestamps
6. Verify waveform timeline renders and responds to crossfade changes
