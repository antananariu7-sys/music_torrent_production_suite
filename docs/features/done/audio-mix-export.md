# Feature: Audio Mix Export

## Overview

Render the ordered tracklist from MixTab into a single continuous audio file with per-track crossfades, automatic loudness normalization, and a .cue sheet marking track boundaries. Includes an inline waveform timeline for visual arrangement preview.

## User Problem

Users curate ordered tracklists (mixes) from various sources — torrents and local files — but currently have no way to export the mix as a single playable file. Tracks may differ in format, bitrate, sample rate, and loudness. The user needs a seamless, radio-ready output without leaving the app.

## User Stories

- As a DJ, I want to export my tracklist as a single audio file with smooth crossfades so I can share or upload my mix
- As a mix curator, I want per-track crossfade control so each transition sounds intentional
- As a user with mixed-format libraries, I want automatic normalization so tracks play at consistent volume regardless of source format
- As a mix curator, I want a waveform timeline showing track arrangement so I can visually verify my mix layout before exporting

## Proposed UX Flow

### Entry Point

"Export Mix" button in the MixTab header area. Crossfade duration controls appear inline between each pair of songs in the existing tracklist.

### Step-by-Step Flow

1. User builds tracklist in MixTab (existing functionality)
2. Per-track crossfade inputs appear between each consecutive song pair (default: 5s)
3. User adjusts crossfade durations as desired — changes auto-save to project.json
4. Waveform timeline at the bottom of MixTab shows the visual arrangement: real audio waveforms for each track with crossfade overlap zones highlighted
5. User clicks "Export Mix" button
6. Export configuration modal opens with:
   - Output format selector (WAV / FLAC / MP3)
   - MP3 bitrate selector (128/192/256/320 kbps) — shown only when MP3 selected
   - Output directory picker (defaults to project directory)
   - Output filename (defaults to mix title)
   - Normalization toggle (on by default)
   - Generate .cue sheet toggle (on by default)
   - Estimated output file size
7. User clicks "Render"
8. Modal closes, progress indicator appears in MixTab (track-by-track progress bar with current track name, percentage, ETA)
9. User can continue working in any tab while rendering happens in background
10. On completion: toast notification with "Open file" / "Open folder" actions
11. On cancel: partial file is cleaned up, toast confirms cancellation

### Key Screens / States

- **MixTab — Crossfade Controls**: Between each song row, a compact inline control showing crossfade duration (number input or small slider, 0–30 seconds). Last track has no crossfade control.
- **MixTab — Waveform Timeline**: Horizontal scrollable timeline below the tracklist showing actual audio waveforms per track. Crossfade overlap zones are visually highlighted (e.g., colored overlay). Total mix duration displayed.
- **Export Configuration Modal**: Format, quality, output path, normalization, .cue sheet toggles. File size estimate updates reactively.
- **Rendering Progress**: Inline in MixTab — progress bar, current track label, percentage, ETA, cancel button. Non-blocking (other tabs remain usable).
- **Validation Errors**: If audio files are missing, export is blocked. A list of tracks with missing files is shown, with a "Export available tracks only" fallback button.

## Data Model Changes

### Modified: Song (in project.json songs[])

| Field | Type | Description |
|-------|------|-------------|
| `crossfadeDuration` | `number \| undefined` | Crossfade duration in seconds into the NEXT track. `undefined` = use default (5s). Last song in mix ignores this. Range: 0–30. |

### New: MixExportConfig (in project.json mixMetadata)

| Field | Type | Description |
|-------|------|-------------|
| `defaultCrossfadeDuration` | `number` | Default crossfade for new transitions (seconds). Default: 5 |
| `normalization` | `boolean` | Whether to auto-normalize loudness. Default: true |
| `outputFormat` | `'wav' \| 'flac' \| 'mp3'` | Last-used export format. Default: 'flac' |
| `mp3Bitrate` | `128 \| 192 \| 256 \| 320` | MP3 bitrate when format is mp3. Default: 320 |
| `generateCueSheet` | `boolean` | Whether to generate .cue file. Default: true |

### New: WaveformData (cached, not in project.json)

| Field | Type | Description |
|-------|------|-------------|
| `songId` | `string` | Reference to song |
| `peaks` | `number[]` | Normalized amplitude peaks for rendering waveform (downsampled) |
| `duration` | `number` | Duration in seconds |
| `sampleRate` | `number` | Source sample rate used for computation |

Waveform data is cached in-memory and/or in a temp directory. Recomputed if source file changes.

## Technical Approach

### Audio Processing: FFmpeg

- Bundle `ffmpeg-static` (or `@ffmpeg-installer/ffmpeg`) for cross-platform FFmpeg binary
- All audio operations (decode, normalize, crossfade, encode) via FFmpeg CLI
- Run FFmpeg as a child process from the main process via `child_process.spawn`

### Rendering Pipeline

1. **Validate**: Check all audio files exist. Resolve file paths (torrent downloads vs external files).
2. **Analyze**: FFmpeg `loudnorm` first pass on each track to compute normalization parameters (EBU R128)
3. **Render**: Use FFmpeg complex filter graph to:
   - Decode all input files
   - Apply loudness normalization per track
   - Apply crossfade between consecutive tracks with configured durations
   - Encode to target format
4. **Cue Sheet**: Generate .cue file with track start times (accounting for crossfade overlaps)
5. **Cleanup**: Remove temp files on success or cancellation

### Waveform Generation

- Extract peaks via FFmpeg (`-filter_complex "aformat=channel_layouts=mono,compand"` + raw PCM output)
- Downsample to ~1000 peaks per track for display
- Cache waveform data in memory; recompute lazily when tracks are added/changed
- Render in React using `<canvas>` or SVG

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `mix:export:start` | renderer → main | Start rendering with config |
| `mix:export:progress` | main → renderer | Progress updates (track, percentage, ETA) |
| `mix:export:cancel` | renderer → main | Cancel in-progress render |
| `mix:export:complete` | main → renderer | Render finished (success/error + output path) |
| `mix:waveform:generate` | renderer → main | Request waveform data for a song |
| `mix:waveform:data` | main → renderer | Return computed waveform peaks |

## Edge Cases & Error States

- **Missing audio files**: Block export, show list of missing tracks. Offer "Export available tracks only" fallback that skips missing songs (adjusts crossfades at gap boundaries).
- **Single track in mix**: Export as-is with normalization, no crossfade needed. Cue sheet has one entry.
- **Zero crossfade duration**: Hard cut between tracks (no overlap). Valid use case.
- **Crossfade longer than shortest adjacent track**: Clamp crossfade to min(track_a_remaining, track_b_duration) - 1s. Show warning.
- **Rendering cancelled mid-way**: Kill FFmpeg process, delete partial output file, notify user.
- **FFmpeg not found / fails**: Show actionable error with details. Log full FFmpeg stderr for debugging.
- **Disk space insufficient**: Estimate output size before render; warn if free space is tight.
- **Very large mixes (2h+)**: Progress shows ETA. No artificial limit, but warn that output file will be large.
- **Concurrent export attempts**: Disable "Render" button while a render is in progress.

## Acceptance Criteria

- [ ] Crossfade duration input appears between each pair of songs in MixTab (0–30s range, default 5s)
- [ ] Crossfade durations persist in project.json and survive app restart
- [ ] Waveform timeline displays actual audio waveforms for all tracks with crossfade zones highlighted
- [ ] Export modal allows selecting WAV, FLAC, or MP3 format
- [ ] MP3 bitrate selector appears only when MP3 format is chosen
- [ ] Rendering runs in background — user can navigate other tabs during export
- [ ] Progress bar shows current track, percentage, and ETA
- [ ] Cancel button stops rendering and cleans up partial files
- [ ] Output file plays seamlessly with correct crossfades between all tracks
- [ ] Tracks of different formats/bitrates/sample rates are correctly mixed together
- [ ] Loudness is consistent across all tracks in the output (EBU R128 normalization)
- [ ] .cue sheet is generated with accurate track start timestamps
- [ ] Missing audio files block export with clear error listing which tracks need files
- [ ] "Export available tracks only" fallback works for partial mixes
- [ ] Toast notification on completion with "Open file" / "Open folder" actions

## Out of Scope (v1)

- Beat-matching / BPM detection / auto-sync
- EQ, effects, or filters on individual tracks
- Real-time audio preview of crossfades before export
- DJ-style cue points or hot cues
- Volume automation curves (only crossfade envelope)
- Streaming the rendered mix (only file export)
- Manual per-track volume/gain control (auto-normalize only in v1)

## Dependencies

- `ffmpeg-static` or `@ffmpeg-installer/ffmpeg` — bundled FFmpeg binary
- Existing: MixTab tracklist, Song entity, MixMetadata, AudioPlayer, project.json persistence
- Existing: IPC progress pattern (used by WebTorrent downloads)

## Open Questions

- Should waveform data be persisted to disk (e.g., `assets/waveforms/`) for faster reload, or recomputed each session?
- Should the FFmpeg binary path be configurable in Settings for users who prefer their own install?
- Future: would users want preset transition styles (e.g., fade-in-only, fade-out-only, equal-power crossfade)?
