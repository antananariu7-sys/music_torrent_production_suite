# Feature: Stream Preview from Search Results

## Overview
Allow users to preview individual tracks directly from search results by streaming audio via WebTorrent — no full download required. A play button on each track in the expanded track list starts a short 30-60 second sample streamed from torrent peers.

## User Problem
Today, hearing a track requires downloading the entire torrent first. For discovery-heavy workflows (searching for the right version, checking audio quality, confirming it's the right track), this is too slow. Users need a quick listen before committing to a download.

## User Stories
- As a DJ, I want to preview a track from search results so I can confirm it's the right version before downloading
- As a user, I want to check audio quality (bitrate, encoding) by ear without downloading the whole torrent
- As a user, I want a quick 30-60s sample — enough to identify the track, not a full playback session

## Proposed UX Flow

### Entry Point
Inside the expanded track list of a `TorrentItem` in SearchTab results. Each track row gets a play/stop button.

### Step-by-Step Flow

1. User searches and finds a torrent in SearchTab
2. User clicks "Preview tracks" on a TorrentItem (existing feature — expands track listing)
3. Each track row now shows a **play button** (▶) on the left
4. User clicks ▶ on a track:
   - Button changes to a **spinner** (buffering state)
   - Main process starts a WebTorrent connection, prioritizes the target file's first pieces
5. Once enough data is buffered (~5-10s of audio):
   - Spinner changes to a **stop button** (■)
   - The existing **AudioPlayer** bar at the bottom begins playback
   - AudioPlayer shows track name with a "Preview" badge to distinguish from local playback
6. Playback runs for 30-60 seconds (or until user stops it)
7. When preview ends (timeout or user stop):
   - Torrent connection is torn down
   - Partial data is discarded (no disk footprint)
   - Track row button returns to ▶
8. If user clicks ▶ on a different track while one is playing:
   - Current preview stops and cleans up
   - New preview starts (one at a time)

### Key Screens / States

```
Track list (idle):
┌──────────────────────────────────────────────┐
│ ▶  01. Artist - Track Name              4:32 │
│ ▶  02. Artist - Another Track           3:15 │
│ ▶  03. Artist - Third Track             5:01 │
└──────────────────────────────────────────────┘

Track list (buffering track 2):
┌──────────────────────────────────────────────┐
│ ▶  01. Artist - Track Name              4:32 │
│ ◌  02. Artist - Another Track           3:15 │  ← spinner
│ ▶  03. Artist - Third Track             5:01 │
└──────────────────────────────────────────────┘

Track list (playing track 2) + AudioPlayer:
┌──────────────────────────────────────────────┐
│ ▶  01. Artist - Track Name              4:32 │
│ ■  02. Artist - Another Track           3:15 │  ← stop button
│ ▶  03. Artist - Third Track             5:01 │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ ■  02. Another Track [Preview]  0:12 / 0:45  │  ← AudioPlayer bar
│    ████████░░░░░░░░░░░░░░░░░░░░░░  vol ████░ │
└──────────────────────────────────────────────┘

Timeout / no peers:
┌──────────────────────────────────────────────┐
│ ▶  02. Artist - Another Track           3:15 │
│      ⚠ No peers available                    │  ← inline warning, fades after 5s
└──────────────────────────────────────────────┘
```

## Technical Design

### Architecture

```
Renderer                          Main Process
────────                          ────────────
TorrentItem track row
  ↓ click ▶
window.api.streamPreview
  .start(magnetUri, fileIndex)    → StreamPreviewService
                                      ↓
                                    WebTorrent.add(magnet)
                                    torrent.files[i].createReadStream({start, end})
                                      ↓
                                    Buffer first ~1MB of audio data
                                      ↓
                                    ← IPC push: STREAM_PREVIEW_READY (base64 chunk)
  ↓
AudioPlayer.play(dataUrl)
  ...playback (30-60s)...
  ↓
window.api.streamPreview
  .stop()                         → StreamPreviewService.cleanup()
                                      ↓
                                    torrent.destroy(), discard data
```

### New Service: `StreamPreviewService`

**Location:** `src/main/services/StreamPreviewService.ts`

Responsibilities:
- Start a WebTorrent instance for preview (separate from the download queue)
- Prioritize first pieces of the target file for fast buffering
- Read initial chunk of the audio file via `file.createReadStream()`
- Convert to base64 data URL and push to renderer
- Enforce 15-second timeout for peer discovery
- Clean up torrent + data when preview ends or is cancelled
- Only one active preview at a time (stop previous before starting new)

### New IPC Channels

| Channel | Direction | Payload |
|---------|-----------|---------|
| `STREAM_PREVIEW_START` | renderer → main | `{ magnetUri: string, fileIndex: number, torrentPageUrl: string }` |
| `STREAM_PREVIEW_STOP` | renderer → main | `void` |
| `STREAM_PREVIEW_READY` | main → renderer | `{ dataUrl: string, trackName: string, duration?: number }` |
| `STREAM_PREVIEW_ERROR` | main → renderer | `{ error: string }` |
| `STREAM_PREVIEW_BUFFERING` | main → renderer | `{ progress: number }` (0-100) |

### AudioPlayer Changes

- Accept a preview track source (base64 data URL) in addition to local file paths
- Show a "Preview" badge when playing a streamed track
- Auto-stop after 60 seconds of playback
- On stop, notify main process to tear down the torrent connection

### Supported Formats

Stream preview is limited to formats HTML5 `<audio>` supports natively:
- MP3 (`.mp3`)
- FLAC (`.flac`) — Chromium supports FLAC natively
- WAV (`.wav`)
- OGG/Vorbis (`.ogg`)
- AAC/M4A (`.m4a`, `.aac`)
- Opus (`.opus`)

Unsupported formats (APE, WMA, AIFF) show: "Preview not available for this format"

### Buffering Strategy

1. Start WebTorrent with magnet URI
2. Wait for metadata (file list) — timeout at 15s
3. Select target file by index
4. Use `file.createReadStream({ start: 0, end: BUFFER_SIZE })` where `BUFFER_SIZE` is ~2MB (enough for 30-60s of compressed audio)
5. Collect stream into a Buffer, convert to base64 data URL
6. Push to renderer via IPC

This approach sends a single chunk rather than true real-time streaming, which is simpler and avoids the complexity of a streaming media server. For a 30-60s sample, a 1-2MB initial buffer is sufficient.

## Data Model Changes

No persistent data model changes. Preview is fully ephemeral — no new fields on any existing entity.

| Entity | Field | Type | Description |
|--------|-------|------|-------------|
| (audioPlayerStore) | `isPreview` | `boolean` | Transient flag: currently playing a stream preview |
| (audioPlayerStore) | `previewMaxDuration` | `number` | Max playback seconds for preview (60) |

## Edge Cases & Error States
- **No seeders / timeout:** 15-second timeout → inline warning "No peers available — can't preview this track", auto-dismiss after 5s
- **Unsupported format:** Detect from file extension before starting torrent → "Preview not available for this format"
- **User navigates away during buffering:** Cancel the preview, tear down torrent
- **Torrent has no files matching track index:** Show "Track not found in torrent"
- **Very large files (FLAC):** Buffer size may need to be larger (~4MB) to get 30s of lossless audio. Detect format and adjust.
- **Network error mid-stream:** Playback stops, show brief toast "Preview interrupted"
- **User clicks download while previewing same torrent:** Stop preview, start normal download flow

## Acceptance Criteria
- [x] Expanded track list in TorrentItem shows a play button per track
- [x] Clicking play starts buffering with a visible spinner on the track row
- [x] AudioPlayer plays the streamed audio within 15 seconds (or shows timeout error)
- [x] AudioPlayer shows "Preview" badge during stream playback
- [x] Playback auto-stops after 60 seconds
- [x] User can manually stop preview via the stop button (track row or AudioPlayer)
- [x] Starting a new preview stops the current one
- [x] Torrent connection is fully torn down after preview ends
- [x] No data persists on disk after preview cleanup
- [x] Unsupported audio formats show a clear message instead of attempting to play
- [x] 15-second timeout shows "No peers available" when no seeders respond

## Out of Scope
- Full-track streaming (only 30-60s sample)
- Preview from sources other than WebTorrent (YouTube, Spotify, etc.)
- Streaming preview from TorrentTab (download queue) — only from SearchTab
- Preview caching (replaying a preview re-fetches from peers)
- Transcoding unsupported formats (APE, WMA) for preview
- Multiple simultaneous previews

## Dependencies
- WebTorrent streaming API (`file.createReadStream()`)
- Existing AudioPlayer component and `audioPlayerStore`
- Existing TorrentItem track list expansion (TorrentMetadataService)
- Magnet URI availability from search results / collected torrents
