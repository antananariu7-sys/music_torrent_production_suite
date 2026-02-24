# Feature: Mix Preparation View — v2 Roadmap

> Advanced DJ features building on top of the v1 Mix Preparation View.
> Prerequisites: all 5 phases of [mix-preparation-view.md](mix-preparation-view.md) completed.

---

## 1. Auto Section Detection & Labels

**Problem**: v1 shows a raw energy envelope — DJs must mentally interpret where the intro, buildup, drop, breakdown, and outro are. Pro tools like rekordbox auto-label these sections, letting DJs instantly see track structure.

**Approach**:

- Spectral novelty function: compute a self-similarity matrix from chromagram / MFCC features, then detect boundaries via novelty peaks
- Classify sections by energy level + spectral characteristics:
  - **Intro** — low energy, first segment
  - **Buildup** — rising energy trend
  - **Drop** — sustained high energy, strong bass
  - **Breakdown** — sudden energy dip after drop
  - **Outro** — declining energy, final segment
- Render as colored bands behind the waveform with text labels
- Allow manual correction: drag section boundaries, rename labels
- Persist section data per song in project.json

**Complexity**: High — needs spectral feature extraction (FFmpeg or Essentia.js) + novelty peak picking + classification heuristics. Consider ML-based approach if heuristics prove insufficient.

**UX sketch**:

```
┌─────────────────────────────────────────────────────────┐
│ [intro ][  buildup  ][    drop    ][breakdn][  outro  ] │
│ ░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒░░░░░░░░░░░ │
│ ╌╌╌╌╌╌╌╌╌╌╌waveform with section colors╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Automatic Beat-Sync (Tempo Matching)

**Problem**: v1 shows BPM difference and suggests tempo adjustment percentage, but doesn't actually modify playback or export. DJs need tracks to play at the same BPM for a smooth transition.

**Approach**:

- **Preview**: Use Web Audio API `playbackRate` to pitch-shift one track to match the other's BPM during dual-deck playback. Simple but affects pitch.
- **Export**: Integrate a time-stretch algorithm (e.g., SoundTouch.js or Rubber Band via WASM) into the export pipeline. Preserves pitch while adjusting tempo.
- **UI**: "Sync BPM" toggle per transition. When enabled, shows which track is adjusted and by how much. Visual beat grid alignment indicator.
- **Gradual tempo ramp**: Option to gradually shift BPM over the crossfade zone rather than an abrupt change.

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  tempoAdjustment?: number // Playback rate multiplier (e.g., 1.015 = +1.5%)
  tempoSyncEnabled?: boolean // Whether this track should be tempo-matched
}
```

**Complexity**: Medium (preview via playbackRate) to High (quality time-stretch for export).

---

## 3. EQ & Effects Preview

**Problem**: DJs routinely use EQ (cutting bass, boosting highs) during transitions. Without EQ preview, the user can't hear how the transition will actually sound with frequency adjustments.

**Approach**:

- Web Audio API `BiquadFilterNode` for 3-band EQ (low/mid/high) per deck
- EQ knobs in the transition panel, one set per track
- Optional filter sweep (low-pass / high-pass) as a transition effect
- **Preview only** — not baked into export (export uses FFmpeg filters if needed)
- Consider: reverb send, delay as optional effects

**UX sketch**:

```
┌─ EQ: Track A ─┐  ┌─ EQ: Track B ─┐
│ Hi:  [━━●━━━]  │  │ Hi:  [━━━━●━]  │
│ Mid: [━━━●━━]  │  │ Mid: [━━━●━━]  │
│ Lo:  [━●━━━━]  │  │ Lo:  [━━━━━●]  │
│ [Filter sweep] │  │ [Filter sweep] │
└────────────────┘  └────────────────┘
```

**Complexity**: Medium. Web Audio EQ is straightforward. UX for knobs/sliders needs care.

---

## 4. Auto Mix-Point Detection (Advanced)

**Problem**: v1's "Suggest mix point" uses energy + beats for a basic suggestion. v2 should be smarter — considering phrase boundaries (8/16/32 bar groups), key transitions, and energy arc across the entire mix.

**Approach**:

- **Phrase detection**: Use beat grid + energy to identify phrase boundaries (every 8/16/32 bars). Crossfade should start/end on phrase boundaries for musical transitions.
- **Global energy arc**: Analyze the full mix's energy flow. Suggest track order changes if the energy arc has unnatural dips or spikes.
- **Key-aware suggestions**: Prefer transition points where key change is harmonically smooth (Camelot +1/-1 or relative major/minor).
- **Learning from user edits**: Track which suggestions the user accepts/rejects. Adjust weighting over time (local heuristic, no ML needed).

**Complexity**: High. Phrase detection requires reliable downbeat tracking. Global optimization is an interesting algorithmic problem.

---

## 5. Per-Track Volume & Gain Automation

**Problem**: Some tracks are louder than others. The current loudnorm pass normalizes everything, but DJs sometimes want manual gain adjustment or volume curves — e.g., gradually reducing volume during an outro.

**Approach**:

- Volume envelope editor per track: draw a curve on the waveform
- Breakpoint-based: click to add points, drag to adjust, delete to remove
- Predefined shapes: fade-in, fade-out, constant
- Export integration: FFmpeg `volume` filter with keyframes
- Preview via Web Audio `GainNode` with scheduled value changes

**UX sketch**:

```
┌─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ │  waveform
│ ────────────────●                       │
│                  ╲                      │  volume envelope
│                   ╲____●────────        │
│ [+3dB gain]            [-6dB]           │
└─────────────────────────────────────────┘
```

**Complexity**: Medium-High. The envelope editor UI is the main challenge. FFmpeg integration is straightforward.

---

## 6. Waveform Editing (Non-Destructive)

**Problem**: Sometimes a track has an unwanted section (long ambient intro, spoken word segment, silence gap) that should be cut — not just trimmed from the edges.

**Approach**:

- **Split**: Click to split a track into segments at a timestamp. Segments can be independently removed or reordered.
- **Remove region**: Select a region → delete. Waveform closes the gap.
- **Non-destructive**: All edits stored as a list of cuts/regions in project.json. Original audio file untouched. Export applies `atrim` + `concat` filters.
- **Undo/redo**: Essential for editing operations. Implement as an edit history stack.

**Data model additions**:

```typescript
interface Song {
  // ... existing fields ...
  regions?: AudioRegion[] // Non-destructive edit regions
}

interface AudioRegion {
  id: string
  startTime: number
  endTime: number
  enabled: boolean // Can disable a region without deleting
}
```

**Complexity**: High. Non-destructive editing with undo/redo is a significant architectural addition. FFmpeg filter graph becomes more complex.

---

## 7. Mix Health Dashboard

**Problem**: After preparing individual transitions, the DJ needs a bird's-eye view of the entire mix's quality: are there any problematic transitions, bitrate drops, large BPM jumps, key clashes?

**Approach**:

- Summary panel (could live in the Timeline tab or as a collapsible section):
  - **Transition quality scores**: green/yellow/red per transition based on BPM delta, key compatibility, bitrate match
  - **Energy flow graph**: full-mix energy curve showing the overall arc
  - **Mix duration**: total with breakdown per track
  - **Format/quality report**: list any quality drops or format inconsistencies
  - **Key journey**: Camelot wheel visualization showing the key path through the mix
- Clicking any issue navigates to that transition in the Mix tab

**UX sketch**:

```
┌─ Mix Health ─────────────────────────────────┐
│ Duration: 1:23:45  │  7 tracks  │  Score: 8/10 │
│                                                │
│ Energy: ╱╲╱╲___╱╲╲╱╲___╱╲                    │
│                                                │
│ Transitions:                                   │
│  1→2  128→128 BPM ✓  8A→8A ✓  320→320 ✓  ●   │
│  2→3  128→126 BPM ⚠  8A→11B ✓  320→256 ⚠ ●   │
│  3→4  126→130 BPM ✗  11B→3A ✗  256→320 ✓  ●   │
│  ...                                           │
│                                                │
│ Key path: 8A → 8A → 11B → 3A → ...           │
│ ⚠ 1 key clash (transition 3→4)                │
│ ⚠ 1 bitrate drop (transition 2→3)            │
└────────────────────────────────────────────────┘
```

**Complexity**: Medium. Mostly data aggregation + visualization. Depends on Phase 2 (key detection) and Phase 3 (energy) from v1.

---

## 8. Collaborative Mix Sharing

**Problem**: DJs sometimes prepare mixes together or want feedback from collaborators on their tracklist and transitions before exporting.

**Approach**:

- Export mix project as a shareable package (zip of project.json + metadata, no audio)
- Import shared package to view the tracklist, transition settings, and notes — even without the audio files
- Comment/annotation system per transition: "I think the crossfade is too long here"
- Future: real-time collaborative editing via CRDT (ambitious, likely v3+)

**Complexity**: Low (export/import) to Very High (real-time collaboration).

---

## Priority Matrix

| Feature                | Impact     | Effort        | Suggested Order                               |
| ---------------------- | ---------- | ------------- | --------------------------------------------- |
| Auto Section Detection | High       | High          | 1st — most visible improvement to waveform UX |
| Mix Health Dashboard   | High       | Medium        | 2nd — aggregates existing data, high value    |
| Auto Beat-Sync         | High       | Medium-High   | 3rd — core DJ workflow need                   |
| EQ & Effects Preview   | Medium     | Medium        | 4th — nice to have for transition preview     |
| Advanced Mix-Point     | Medium     | High          | 5th — builds on section detection             |
| Volume Automation      | Medium     | Medium-High   | 6th — useful but less critical                |
| Waveform Editing       | Low-Medium | High          | 7th — trim + cue points cover most cases      |
| Collaborative Sharing  | Low        | Low-Very High | 8th — nice to have, scope varies wildly       |

---

## Technical Debt to Address Before v2

- **TimelineLayout.tsx (~950 lines)**: Should be split into smaller components before adding more features
- **Undo/redo infrastructure**: Needed for waveform editing, useful everywhere. Consider implementing as a middleware in Zustand stores
- **Web Audio graph management**: Dual-deck from v1 Phase 4 should be abstracted into a reusable audio engine before adding EQ/effects
- **Essentia.js scope**: If key detection (v1 Phase 2) works well, reuse Essentia.js for section detection (chromagram + MFCC already available)
