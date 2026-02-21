# Feature: Waveform Visual Improvements

## Overview

Upgrade the timeline waveform rendering from flat-colored bars to a polished, professional visualization with gradient fills, frequency-based coloring, smoother rendering, and zoom-adaptive detail levels.

## User Problem

The current waveforms are functional but visually basic — flat solid colors, hard-edged bars, and a fixed level of detail regardless of zoom. For a music production tool, the waveform is the primary visual artifact and should look professional, convey musical information (frequency content), and scale gracefully across zoom levels.

## User Stories

- As a DJ, I want waveforms colored by frequency content so I can visually identify bass-heavy sections, transitions, and buildups at a glance
- As a user, I want polished gradient waveforms that look professional and match the quality of tools like Rekordbox or Traktor
- As a user, I want the waveform to show more detail when I zoom in and simplify when I zoom out, so I always see the right amount of information

## Improvements

### 1. Gradient Waveforms

Replace flat solid-color bars with vertical gradients that fade from a vibrant color at the peaks to a darker shade at the center line.

**Current:** Flat `#3b82f6` bars
**Proposed:** Linear gradient per bar — bright at extremes, darker toward center. Gives depth and a more polished look.

```
Current:          Proposed:
 ██  ████  ██      ▓█  ████  █▓
████████████      ▓████████████▓
 ██  ████  ██      ▓█  ████  █▓
```

**Implementation:**

- Use `ctx.createLinearGradient(x, top, x, bottom)` per bar (or per-column batch)
- Gradient stops: `0%` → peak color at full alpha, `50%` → peak color at 40% alpha, `100%` → peak color at full alpha
- Per-track color still alternates from the palette, just enhanced with gradient

### 2. Frequency-Colored Waveform (3-Band)

Color each waveform bar based on the dominant frequency content at that time position. Low frequencies (bass) get warm colors, mids get neutral, highs get cool colors.

**Color mapping:**

- **Bass-dominant** (< 250 Hz): Red/orange tones (`#ef4444` → `#f97316`)
- **Mid-dominant** (250 Hz – 4 kHz): Yellow/green (`#eab308` → `#22c55e`)
- **High-dominant** (> 4 kHz): Cyan/blue (`#06b6d4` → `#3b82f6`)

This is the same approach used by Rekordbox, Serato, and other DJ software.

**Implementation — 3-band energy extraction:**

1. During waveform extraction (main process), run FFmpeg with 3 parallel bandpass filters:

   ```
   ffmpeg -i <file> -filter_complex "
     [0:a]lowpass=f=250,aresample=8000,astats=metadata=1:reset=1[low];
     [0:a]bandpass=f=1000:width_type=o:w=2,aresample=8000,astats=metadata=1:reset=1[mid];
     [0:a]highpass=f=4000,aresample=8000,astats=metadata=1:reset=1[high]
   " -map [low] -f f32le pipe:3 -map [mid] -f f32le pipe:4 -map [high] -f f32le pipe:5
   ```

   Alternative (simpler): Extract full PCM, then compute per-window RMS in 3 bands using a simple DFT or filter bank in JS/TS.

2. Store 3 peak arrays alongside the main peaks: `peaksLow[], peaksMid[], peaksHigh[]`
3. At render time, compute dominant band per bar → map to color
4. Blend with gradient (improvement #1) for the final look

**Cache extension:**
Add `peaksLow`, `peaksMid`, `peaksHigh` to `WaveformData`. Cache file grows slightly (~4× from ~16KB to ~64KB per track). Negligible.

### 3. Smoother Waveform Rendering

Replace hard-edged rectangular bars with anti-aliased bezier curves for a softer, more organic look — similar to SoundCloud or Ableton's waveform style.

**Current:** Individual `fillRect()` bars
**Proposed:** Two `Path2D` curves (top and bottom) connecting peak values with quadratic bezier interpolation, filled with gradient.

```
Current (bars):     Proposed (curves):
 █  ████  █         ╱‾╲ ╱‾‾‾‾╲ ╱╲
████████████       ╱    ╲      ╲  ╲
 █  ████  █         ╲_╱ ╲____╱ ╲╱
```

**Implementation:**

- Build a `Path2D` for the top envelope: `moveTo(0, centerY)` → for each peak, `quadraticCurveTo(controlX, peakY, nextX, nextPeakY)`
- Mirror for bottom envelope
- Fill the enclosed area with the gradient from improvement #1
- Optionally add a thin stroke on the envelope edge (`1px`, lighter color) for definition
- Keep bar rendering as a fallback/option for users who prefer the classic look

### 4. Zoom-Adaptive Detail (LOD — Level of Detail)

Show more waveform detail when zoomed in and less when zoomed out. At high zoom, individual samples become visible. At low zoom, the waveform simplifies to broad shapes.

**LOD levels:**

| Zoom range       | Detail                | Rendering                                       |
| ---------------- | --------------------- | ----------------------------------------------- |
| 1× (fit-to-view) | ~200 peaks            | Smooth curves, no individual bars visible       |
| 2–5×             | ~500 peaks            | Smooth curves, slight bar texture               |
| 5–15×            | ~2000 peaks (current) | Individual bars/curves visible                  |
| 15–50×           | ~8000+ peaks          | High detail, individual waveform cycles visible |

**Implementation:**

- Store multiple peak resolutions per track (or generate on-demand from higher-res data)
- During waveform extraction, generate peaks at ~8000 points (4× current) instead of 2000
- At render time, downsample to the appropriate count based on `pixelsPerSecond × trackDuration / canvasWidth`
- The downsampling is cheap (max-pooling over windows) and can happen in the render loop
- For the highest zoom levels (>15×), optionally re-extract at even higher resolution (16000+ peaks) on demand

**Ties into adaptive peak resolution (performance spec)** — this is the visual side of that same improvement.

### 5. Beat Grid Visibility Toggle

Add a toolbar control to show/hide the beat grid overlay, independent of BPM detection state.

**Current:** Beat grid always visible when BPM is detected, auto-hides when bars are < 3px apart.
**Proposed:** Toolbar toggle in ZoomControls: `Beat grid: [on | off]`, defaults to on. State persisted in timelineStore.

## Data Model Changes

### Modified: WaveformData (cache file)

| Field       | Type       | Description                                                          |
| ----------- | ---------- | -------------------------------------------------------------------- |
| `peaks`     | `number[]` | _(existing, increase to ~8000 points)_ Main amplitude peaks          |
| `peaksLow`  | `number[]` | **New.** Low-band (< 250 Hz) amplitude peaks, same length as `peaks` |
| `peaksMid`  | `number[]` | **New.** Mid-band (250 Hz – 4 kHz) amplitude peaks                   |
| `peaksHigh` | `number[]` | **New.** High-band (> 4 kHz) amplitude peaks                         |

### Modified: timelineStore

| Field           | Type                 | Description                                           |
| --------------- | -------------------- | ----------------------------------------------------- |
| `showBeatGrid`  | `boolean`            | **New.** Beat grid visibility toggle. Default: `true` |
| `waveformStyle` | `'bars' \| 'smooth'` | **New.** Rendering mode. Default: `'smooth'`          |

## Edge Cases

- **Frequency extraction fails:** Fall back to single-color gradient (no frequency data). Don't block waveform display.
- **Very quiet tracks:** Frequency coloring may be unreliable for near-silent sections. Use mid-band color as default for peaks below a threshold.
- **Cache migration:** Old cache files without frequency bands should still load — treat missing `peaksLow/Mid/High` as null, render in single-color gradient mode. Regenerate in background.
- **Bezier rendering with very sparse peaks:** At extreme zoom-out (< 50 peaks visible), bezier curves may look too smooth/blobby. Fall back to bar rendering below a threshold.

## Acceptance Criteria

- [x] Waveforms render with vertical gradient fills (bright at peaks, darker at center)
- [x] Frequency-colored mode shows bass/mid/high distribution as warm-to-cool colors
- [x] Smooth bezier curve rendering available as the default waveform style
- [x] Bar-style rendering available as an alternative option
- [x] Zoom in shows progressively more waveform detail (visible difference between 1× and 4×)
- [x] Zoom out simplifies waveform to broad shapes without aliasing artifacts
- [x] Beat grid toggle in toolbar shows/hides beat lines
- [x] Old waveform cache files still load (graceful degradation)
- [x] Frequency extraction adds < 2s to per-track waveform generation time
- [x] Visual quality comparable to professional DJ software (Rekordbox, Serato)

## Implementation Notes

- Frequency extraction uses FFmpeg `filter_complex` with 3 parallel bandpass filters directly in `WaveformExtractor.ts` (no separate `FrequencyAnalyzer.ts` module — simpler integration)
- Max zoom capped at 4× (not 50× as originally speculated) for performance
- Peak count: 8000 (from 2000), sample rate: 16kHz (from 8kHz)
- `frequencyColorMode` toggle added to `timelineStore` alongside `waveformStyle` and `showBeatGrid`
- TimeRuler virtualized to fix white band artifact at high zoom

### Commits

- `55123a1` — Gradient waveforms, 3-band frequency coloring
- `10a0ab1` — Smooth bezier waveform rendering with style toggle
- `b611638` — Zoom-adaptive LOD and timeline layout fixes
- `d8f5abe` — Space bar play/pause and timeline track height
- `c831e40` — Beat grid visibility toggle
- `9f74373` — TimeRuler canvas virtualization fix
- `2718230` — Max zoom cap to 4×, version bump to 0.3.1
- `1eae766` — WaveformExtractor test update for 8000 peaks

## Out of Scope

- Full spectrogram display (continuous frequency heatmap)
- Stereo split view (left/right channels separately)
- User-configurable color palettes
- Waveform theming/skins
