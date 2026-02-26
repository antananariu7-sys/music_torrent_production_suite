# Feature: Mix Preparation View

## Overview

Rework the MixTab into a unified DJ preparation view. A left-panel tracklist shows the full mix order; selecting any track reveals a focused two-track transition panel on the right — stacked waveforms, crossfade controls, and a metadata comparison strip (BPM delta, musical key compatibility, bitrate/format match, energy envelope). The existing TimelineTab remains as a secondary "full arrangement" view.

## User Problem

The current MixTab is a flat table with no waveform context, and the TimelineTab is a DAW-style horizontal arrangement that shows everything at once. Neither matches the DJ preparation workflow — which is fundamentally about **pairs of adjacent tracks**: listening to the transition zone, matching BPMs and keys, spotting quality mismatches, and fine-tuning crossfade points. DJs using tools like rekordbox or Traktor work in a two-deck paradigm focused on the next transition, not a bird's-eye arrangement view.

## User Stories

- As a DJ, I want to see two adjacent tracks stacked with their waveforms so I can visually plan the transition between them
- As a DJ, I want BPM difference, key compatibility, and bitrate warnings displayed between adjacent tracks so I can make informed mixing decisions without switching views
- As a DJ, I want to edit crossfade duration and curve type directly in the transition panel so I can fine-tune the blend while seeing both waveforms
- As a DJ, I want to see an energy envelope on each waveform so I can match energy flow — ending a track's high-energy section into the next track's buildup
- As a DJ, I want to play both tracks simultaneously with independent transport controls so I can audition the transition
- As a DJ, I want the system to suggest optimal mix points based on energy and beat analysis so I have a starting point for each transition
- As a DJ, I want to see BPM sync status and know if tempo adjustment is needed so I can prepare for tempo-matched transitions
- As a mix curator, I want the full tracklist visible alongside the detail view so I can reorder tracks while seeing how it affects transitions

## Proposed UX Flow

### Entry Point

The reworked view replaces the current **MixTab** content. Tab label stays "Mix" — same position in `[Search] [Torrent] [Mix] [Timeline]`. The Timeline tab remains for full-arrangement viewing.

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Search] [Torrent] [Mix] [Timeline]                                  │
├────────────────┬─────────────────────────────────────────────────────┤
│  TRACKLIST     │  TRANSITION DETAIL                                  │
│                │                                                     │
│  1. Track A    │  ┌─ Track B (outgoing) ───────────────────────────┐ │
│     128 BPM    │  │ ▸ Artist - Title            128 BPM  8A  320k │ │
│  ─ ─ ─ ─ ─    │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░ │ │
│  2. Track B    │  │ ╌╌╌╌╌energy envelope╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │ │
│     128 BPM    │  │    ▽drop   ▽breakdown            ▽outro      │ │
│ ►─ ─ ─ ─ ─    │  └───────────────────────────────────────────────┘ │
│  3. Track C    │                                                     │
│     126 BPM    │  ┌─ Comparison Strip ────────────────────────────┐ │
│  ─ ─ ─ ─ ─    │  │ BPM: 128 → 126 (−2)  ⚠                      │ │
│  4. Track D    │  │ Key: 8A → 11B  (compatible ✓)                │ │
│     130 BPM    │  │ Bitrate: 320k → 256k  ⚠ quality drop        │ │
│  ─ ─ ─ ─ ─    │  │ ┌─Crossfade─────────────────────────────┐    │ │
│  5. Track E    │  │ │ Duration: [━━━━●━━━━━] 8s             │    │ │
│     128 BPM    │  │ │ Curve: [linear] [equal-power] [s-crv] │    │ │
│                │  │ │ [▸ Preview crossfade]                  │    │ │
│                │  │ └────────────────────────────────────────┘    │ │
│                │  │ [⊕ Suggest mix point]                        │ │
│                │  └───────────────────────────────────────────────┘ │
│                │                                                     │
│                │  ┌─ Track C (incoming) ───────────────────────────┐ │
│                │  │ ▸ Artist - Title            126 BPM  11B 256k │ │
│                │  │ ░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ │
│                │  │ ╌╌╌╌╌energy envelope╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │ │
│                │  │  ▽intro         ▽buildup       ▽drop         │ │
│                │  └───────────────────────────────────────────────┘ │
│                │                                                     │
│                │  ┌─ Playback Controls ───────────────────────────┐ │
│                │  │ [|◁]  [▸ Play A]  [▸ Play B]  [▸ Both]  [▷|] │ │
│                │  │ ◁ prev pair          2 / 4          next pair ▷│ │
│                │  └───────────────────────────────────────────────┘ │
└────────────────┴─────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

1. User opens the **Mix** tab — sees the tracklist on the left (all songs in mix order) and the transition panel on the right
2. Clicking **Track N** in the list shows Track (N−1) stacked above Track N — the "incoming transition" to the selected track
3. **Waveforms** load lazily (reusing existing extraction + cache). Each shows the full track with frequency coloring (bass/mid/high) and a smoothed energy envelope overlaid
4. **Comparison strip** between the two waveforms shows:
   - BPM delta with warning icon if > 3 BPM difference
   - Musical key with Camelot wheel compatibility (via Essentia.js)
   - Bitrate/format comparison with warning if quality drops
5. **Crossfade controls** embedded in the comparison strip: duration slider (0–30s), curve type selector (linear / equal-power / s-curve), preview button
6. **Cue points** visible on both waveforms — existing cue point markers, trim handles, beat grid (toggleable)
7. **Playback**: three modes — play Track A only, play Track B only, play both simultaneously (dual-deck with independent transport)
8. **Auto mix-point suggestion**: "Suggest mix point" button analyzes energy + beats and places/adjusts crossfade start point and cue markers at optimal positions
9. **Pair navigation**: arrow buttons or keyboard (← →) to step through transitions: 1→2, 2→3, 3→4, etc.
10. **Tracklist reorder**: drag-and-drop in the left panel. Transition panel updates immediately to reflect new adjacency
11. First track selected: only shows Track 1 (no "incoming" — the detail panel shows single-track view with its waveform + metadata)

### Key Screens / States

- **Empty state**: No songs — "Add songs from Search or import files to build your mix"
- **Single track**: Only one song in mix — shows single waveform with full metadata, no comparison strip
- **Transition view** (primary): Two tracks stacked with comparison strip and crossfade controls
- **Loading state**: Waveform skeletons while peaks extract. BPM/key analysis runs in background with progress indicators per track
- **First track selected**: Shows Track 1 solo view (no incoming transition). Comparison strip replaced with "First track in mix — select track 2+ to see transitions"

## Data Model Changes

### Modified: Song

| Field                  | Type                    | Description                                                       |
| ---------------------- | ----------------------- | ----------------------------------------------------------------- |
| `musicalKey`           | `string \| undefined`   | Detected musical key (e.g., "8A", "11B" in Camelot notation). NEW |
| `musicalKeyConfidence` | `number \| undefined`   | Key detection confidence 0–1. NEW                                 |
| `energyProfile`        | `number[] \| undefined` | Smoothed energy envelope (~200 points, normalized 0–1). NEW       |

All existing Song fields (bpm, firstBeatOffset, cuePoints, trimStart, trimEnd, crossfadeDuration, crossfadeCurveType) remain unchanged.

### New: KeyData (disk cache)

| Field        | Type     | Description                                   |
| ------------ | -------- | --------------------------------------------- |
| `songId`     | `string` | Reference to song                             |
| `key`        | `string` | Detected key in Camelot notation (e.g., "8A") |
| `openKey`    | `string` | Open Key notation (e.g., "6m")                |
| `confidence` | `number` | Detection confidence 0–1                      |
| `fileHash`   | `string` | For cache invalidation                        |

Stored as: `<projectDir>/assets/waveforms/<songId>.key.json`

### New: Camelot Compatibility Map

Static lookup table for key compatibility (same key, +1/-1, relative major/minor). Used for the compatibility indicator in the comparison strip.

## New Services

### KeyDetector (Main Process)

- Uses Essentia.js (WASM) for musical key detection
- Same pattern as BpmDetector: extract audio → analyze → cache to disk → persist to Song
- IPC channels: `key:detect`, `key:detect-batch`, `key:progress`
- Runs as part of the batch analysis pipeline alongside BPM detection

### EnergyAnalyzer (Main Process)

- Computes smoothed energy envelope from existing waveform peaks data
- RMS energy in sliding windows → smooth → normalize → ~200 points per track
- Lightweight — can derive from already-extracted waveform peaks, no additional FFmpeg call
- Stored on Song entity as `energyProfile`

### MixPointSuggester (Renderer)

- Analyzes energy profiles + BPM + beat grid of adjacent tracks
- Suggests optimal crossfade start point: where outgoing track energy is declining and incoming track energy is rising
- Snaps suggestion to nearest beat if beat grid is available
- Returns suggested cue point positions and crossfade duration

## IPC Channels (New)

| Channel            | Direction | Purpose                           |
| ------------------ | --------- | --------------------------------- |
| `key:detect`       | R → M     | Single song key detection         |
| `key:detect-batch` | R → M     | Batch key detection for all songs |
| `key:detect-song`  | R → M     | Manual per-song key detection     |
| `key:progress`     | M → R     | Progress event per track          |

## Edge Cases & Error States

- **First track in mix**: No incoming transition — show single-track detail view with waveform + metadata only
- **Last track**: Has incoming transition (from previous track) but no outgoing. Show normally with note "Last track in mix"
- **Key detection failure**: Some tracks may not have detectable key (noise, spoken word). Show "Key: unknown" — compatibility indicator hidden
- **Large BPM difference (> 10 BPM)**: Show prominent warning. Suggest reordering tracks
- **Bitrate mismatch**: Show warning icon + text when adjacent tracks differ by > 64kbps or format changes (FLAC → MP3)
- **Essentia.js load failure**: WASM module fails to load — show "Key detection unavailable" gracefully. All other features work independently
- **Energy profile for very short tracks (< 30s)**: Still compute but with fewer data points. No section suggestions
- **Dual playback**: Both tracks playing — if user navigates to different pair, stop both and reset
- **Track reorder during playback**: Stop playback, update transition view
- **Missing audio file**: Show placeholder waveform with "File missing" message. Metadata from project.json still displayed

## Acceptance Criteria

### Phase 1: Core Hybrid View

- [ ] MixTab replaced with split-panel layout: tracklist (left) + transition detail (right)
- [ ] Clicking track N shows Track (N−1) / Track N stacked with waveforms
- [ ] Waveforms reuse existing extraction pipeline (WaveformCanvas, peaks cache)
- [ ] Comparison strip shows BPM delta between adjacent tracks
- [ ] Comparison strip shows bitrate/format comparison with mismatch warnings
- [ ] Crossfade controls (duration slider, curve type, preview) in the comparison strip
- [ ] Existing cue points, trim handles, beat grid visible on both waveforms
- [ ] Pair navigation via arrows / keyboard
- [ ] Tracklist drag-and-drop reorder preserved
- [ ] First/last track edge cases handled

### Phase 2: Key Detection

- [ ] Essentia.js WASM integrated for musical key detection
- [ ] Key displayed per track in Camelot notation
- [ ] Key compatibility indicator in comparison strip (compatible / clashing)
- [ ] Batch key detection with progress, cached to disk
- [ ] Key persisted to Song entity in project.json

### Phase 3: Energy Analysis + Mix Point Suggestion

- [ ] Smoothed energy envelope overlaid on waveforms
- [ ] Energy profile stored per song (~200 points)
- [ ] "Suggest mix point" button analyzes energy curves of both tracks
- [ ] Suggestion places/adjusts crossfade start and cue markers at optimal positions
- [ ] Suggestions snap to beat grid when available

### Phase 4: Dual-Deck Playback

- [ ] Play Track A, Play Track B, Play Both buttons
- [ ] Dual playback uses Web Audio API (two simultaneous sources)
- [ ] Independent playhead per track during dual playback
- [ ] Crossfade preview plays the overlap zone with configured curve applied

### Phase 5: Tempo Sync Display

- [ ] BPM difference shown with visual indicator (slider-style "how far off")
- [ ] Tempo adjustment suggestion ("speed up Track B by 1.5%")
- [ ] (Optional) Basic time-stretch preview via Web Audio playbackRate

## Open Questions

- **Essentia.js bundle size**: ~5MB WASM — acceptable for desktop app? Or load on demand?
- **Auto section labels**: Deferred to v2. v1 shows energy envelope only. What algorithm for v2? (Spectral novelty + peak picking, or ML-based?)
- **Manual key override**: Should users be able to manually correct detected key? (Useful when detection is wrong)
- **Time-stretch quality**: Web Audio `playbackRate` is basic pitch-shifting. Acceptable for preview, or need a proper time-stretch algorithm?

## Out of Scope

- EQ, effects, or filters on individual tracks
- Per-track volume/gain automation curves
- Full automatic beat-sync (auto-align BPMs by time-stretching)
- Waveform editing (cut, split, reverse)
- Streaming the rendered mix
- Auto section labels (v1 shows energy envelope only — auto-labels are v2)

## Dependencies

- Existing: WaveformExtractor, BpmDetector, WaveformCanvas, AudioPlayer, crossfade preview (useCrossfadePreview)
- Existing: Song entity, MixMetadata, project.json persistence, cue points, trim, beat grid
- Existing: TimelineTab (stays as secondary view — no changes needed)
- New: essentia.js npm package (WASM, key detection)
- New: KeyDetector service (main process)
- New: EnergyAnalyzer service (main process or derived in renderer from peaks)
- New: MixPointSuggester (renderer-side analysis)
- New: Camelot compatibility lookup table
- Modified: MixTab.tsx (complete rewrite → split-panel layout)
- Modified: audioPlayerStore (dual-deck playback support)
- Modified: AudioPlayer component (dual source support via Web Audio API)
