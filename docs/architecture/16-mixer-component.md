# Component 3: Mix Builder Architecture

**Version**: 1.0
**Created**: 2026-02-19
**Status**: Design — Ready for Implementation

---

## 1. Overview

Component 3 is a **Mix Builder** — a curated tracklist manager that lets users assemble, arrange, and play through a set of downloaded audio files as a DJ-style mix or playlist.

This is **not** a DAW or audio processor. It does not apply effects, EQ, or real-time audio manipulation. The scope is:
- Build an ordered tracklist from downloaded/external audio files
- Play through the mix using the existing `AudioPlayer`
- Edit song metadata inline
- Manage mix metadata (title, genre, cover art)

The songs are already modelled in the `Project` type and persisted by `ProjectService`. The missing layer is the **IPC API** and **MixTab UI** to actively manage them.

---

## 2. What Already Exists

| Layer | Status | Notes |
|-------|--------|-------|
| `Song` / `Project` types | ✅ Done | `src/shared/types/project.types.ts` |
| `ProjectService.addSong()` | ✅ Done | Main process, with persistence |
| `ProjectService.removeSong()` | ✅ Done | Main process |
| `ProjectService.updateSong()` | ✅ Done | Main process |
| `audioPlayerStore.ts` | ✅ Done | Full playback state + playlist |
| `AudioPlayer.tsx` | ✅ Done | Fixed bottom player, skip/seek/volume |
| `audio:read-file` IPC | ✅ Done | Reads audio files as base64 dataURL |
| `MixTab.tsx` | ⚠️ Placeholder | Shows MetadataSection + read-only SongsList |
| `SongsList.tsx` | ⚠️ Read-only | No play/reorder/remove actions |
| Song IPC channels | ❌ Missing | No `project:add-song` etc. exposed |
| Preload API for songs | ❌ Missing | Not in `window.api` |

---

## 3. IPC Channels to Add

Add to `src/shared/constants.ts`:

```typescript
// Song management
PROJECT_ADD_SONG:        'project:add-song',
PROJECT_REMOVE_SONG:     'project:remove-song',
PROJECT_UPDATE_SONG:     'project:update-song',
PROJECT_REORDER_SONGS:   'project:reorder-songs',
PROJECT_SELECT_AUDIO_FILE: 'project:select-audio-file',  // Open system file picker
```

---

## 4. IPC Handler Changes

Extend `src/main/ipc/projectHandlers.ts` with:

```typescript
// Add song (from external file path)
ipcMain.handle(IPC_CHANNELS.PROJECT_ADD_SONG, async (_event, request: AddSongRequest) => {
  const song = await projectService.addSong(request.projectId, request)
  return { success: true, data: song }
})

// Remove song
ipcMain.handle(IPC_CHANNELS.PROJECT_REMOVE_SONG, async (_event, projectId: string, songId: string) => {
  await projectService.removeSong(projectId, songId)
  return { success: true }
})

// Update song metadata
ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE_SONG, async (_event, request: UpdateSongRequest) => {
  await projectService.updateSong(request.projectId, request.songId, request.updates)
  return { success: true }
})

// Reorder songs (swap order values)
ipcMain.handle(IPC_CHANNELS.PROJECT_REORDER_SONGS, async (_event, projectId: string, songIds: string[]) => {
  await projectService.reorderSongs(projectId, songIds)
  return { success: true }
})

// Open system audio file picker
ipcMain.handle(IPC_CHANNELS.PROJECT_SELECT_AUDIO_FILE, async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'aiff'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})
```

### ProjectService: Add `reorderSongs()`

The only missing method in `ProjectService`:

```typescript
async reorderSongs(projectId: string, orderedSongIds: string[]): Promise<void> {
  const project = this.getProjectById(projectId)
  orderedSongIds.forEach((id, index) => {
    const song = project.songs.find(s => s.id === id)
    if (song) song.order = index
  })
  project.songs.sort((a, b) => a.order - b.order)
  await this.saveProject(project)
}
```

---

## 5. Preload API

Add to `src/preload/index.ts` under a `mix` namespace:

```typescript
mix: {
  addSong: (request: AddSongRequest): Promise<ApiResponse<Song>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD_SONG, request),

  removeSong: (projectId: string, songId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE_SONG, projectId, songId),

  updateSong: (request: UpdateSongRequest): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE_SONG, request),

  reorderSongs: (projectId: string, songIds: string[]): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REORDER_SONGS, projectId, songIds),

  selectAudioFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SELECT_AUDIO_FILE),
},
```

---

## 6. UI Components

### 6.1 MixTab Redesign (`src/renderer/pages/ProjectOverview/components/tabs/MixTab.tsx`)

Replace the placeholder with a full mix builder:

```
MixTab
├── MixHeader         — Mix title, stats (total songs, total duration)
├── MixTracklist      — Reorderable song list (replaces SongsList)
│   ├── TrackRow      — Song row with play button, metadata, drag handle, remove
│   └── AddTrackRow   — "Add track" button row at bottom
├── MetadataSection   — Mix metadata (genre, tags, cover, description) — already exists
└── MixPlaybackBar    — "Play All" button + shuffle — triggers AudioPlayer playlist
```

### 6.2 MixTracklist (`src/renderer/components/features/mix/MixTracklist.tsx`)

Key behaviors:
- Ordered list of `Song` objects from the project
- Each row shows: track number, play button, title (editable), artist (editable), duration, format badge, remove button
- Click play → `audioPlayerStore.playPlaylist(allTracks, index)`
- Drag handles for reordering (use CSS-only drag approach or simple up/down buttons to avoid heavy DnD library)
- Remove → call `window.api.mix.removeSong()`
- Inline edit on title/artist → call `window.api.mix.updateSong()`

### 6.3 AddTrackDialog (`src/renderer/components/features/mix/AddTrackDialog.tsx`)

Two tabs:
1. **From file**: `window.api.mix.selectAudioFile()` → read metadata via `music-metadata` (new IPC call) → `addSong`
2. **From downloads**: Shows completed `QueuedTorrent` files from `downloadQueueStore` → select file → `addSong`

### 6.4 Track → AudioPlayer integration

When user clicks play on a track:
```typescript
const tracks = songs.map(s => ({
  filePath: s.externalFilePath || s.localFilePath || '',
  name: s.title,
  duration: s.duration,
}))
audioPlayerStore.playPlaylist(tracks, clickedIndex)
```

---

## 7. State Management

No new Zustand store needed. Use:
- `useProjectStore` — project/songs CRUD, refresh after mutations
- `useAudioPlayerStore` — playback controls
- Local component state for UI (drag state, edit mode, dialog open)

### Song mutation pattern (renderer side)

```typescript
const handleRemoveSong = async (songId: string) => {
  await window.api.mix.removeSong(currentProject.id, songId)
  // Refresh project to get updated songs list
  const response = await window.api.openProject({ filePath: projectFilePath })
  if (response.success) setCurrentProject(response.data)
}
```

> **Simpler alternative**: After any mutation, re-fetch project state. `ProjectService` returns the updated project on save.

---

## 8. New IPC for Audio Metadata

When adding a file, read its metadata via `music-metadata` (already installed):

```typescript
// src/main/ipc/audioHandlers.ts — add:
ipcMain.handle(IPC_CHANNELS.AUDIO_READ_METADATA, async (_event, filePath: string) => {
  const mm = await import('music-metadata')
  const metadata = await mm.parseFile(filePath)
  return {
    success: true,
    data: {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      duration: metadata.format.duration,
      format: metadata.format.container?.toLowerCase(),
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : undefined,
      sampleRate: metadata.format.sampleRate,
    }
  }
})
```

Add constant: `AUDIO_READ_METADATA: 'audio:read-metadata'`

---

## 9. Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Add IPC constants | `src/shared/constants.ts` |
| 2 | Add `reorderSongs()` to ProjectService | `src/main/services/ProjectService.ts` |
| 3 | Add song + audio metadata IPC handlers | `src/main/ipc/projectHandlers.ts`, `src/main/ipc/audioHandlers.ts` |
| 4 | Expose in preload | `src/preload/index.ts` |
| 5 | Build `MixTracklist` component | `src/renderer/components/features/mix/MixTracklist.tsx` |
| 6 | Build `AddTrackDialog` | `src/renderer/components/features/mix/AddTrackDialog.tsx` |
| 7 | Redesign `MixTab` | `src/renderer/pages/ProjectOverview/components/tabs/MixTab.tsx` |
| 8 | Wire AudioPlayer playlist | `MixTracklist` → `audioPlayerStore` |
| 9 | Update `SongsList` or replace with `MixTracklist` in both Mix and Overview tabs | — |

---

## 10. Out of Scope (v0.2)

- Real-time audio effects (EQ, reverb, etc.)
- BPM detection or beat matching
- Waveform visualization per track (heavy, needs Web Audio API)
- Crossfade between tracks
- Export mix as single audio file (requires server-side ffmpeg)
- Cover art upload (MixMetadata already has `coverImagePath` field — UI deferred)

---

## 11. Architecture Decisions

### ADR-013: No new audio processing library

Use the existing `HTML5 Audio` element (already in `AudioPlayer.tsx`) for playback. Adding Tone.js or Web Audio API nodes would be premature for this scope.

### ADR-014: Reorder via up/down buttons, not drag-and-drop

Avoid `react-beautiful-dnd` or `@dnd-kit/core` for now — both add significant bundle weight and complexity. Simple up/down arrow buttons call `reorderSongs` with the new order. Can be upgraded later.

### ADR-015: Song mutations refresh project state

After any song mutation, refresh `currentProject` from the store. The `useProjectStore` already exposes `setCurrentProject` for this. Avoids needing a separate songs subscription.

---

**End of Document**
