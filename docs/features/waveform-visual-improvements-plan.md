# Waveform Visual Improvements — Implementation Plan

## Context

The timeline waveform rendering currently uses flat solid-color bars with a fixed 2000-peak resolution at all zoom levels. This feature upgrades to gradient fills, frequency-based coloring (3-band: bass/mid/high), smooth bezier curve rendering, zoom-adaptive level-of-detail, and a beat grid visibility toggle.

Full spec: `docs/features/waveform-visual-improvements.md`

### Current State

- **WaveformCanvas.tsx**: Renders mirrored `fillRect()` bars, single color per track, 2000 peaks always
- **WaveformExtractor.ts**: Extracts mono PCM at 8kHz → downsamples to 2000 peaks → normalizes 0–1 → caches to disk as JSON
- **WaveformData type**: `{ songId, peaks: number[], duration, sampleRate, fileHash }`
- **timelineStore.ts**: Has `zoomLevel` (1–50) but no LOD logic, no beat grid toggle, no waveform style preference
- **BeatGrid.tsx**: Always renders when BPM detected, auto-hides when beat spacing < 3px

---

## Phase 1: High-Resolution Peaks + LOD Downsampling

**Goal:** Extract 8000 peaks instead of 2000. Downsample at render time based on zoom level for adaptive detail.

### Modify

| File                                                           | Change                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/WaveformExtractor.ts`              | Change `PEAK_COUNT` from `2000` to `8000`. Increase extraction sample rate from `8000` to `16000` for more accurate peaks |
| `src/shared/types/waveform.types.ts`                           | No schema change needed — `peaks: number[]` already supports any length                                                   |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx` | Add LOD downsampling before rendering: compute visible peak count from `width` and decimate peaks via max-pooling         |

### Key details

**Extraction change (WaveformExtractor.ts):**

- `PEAK_COUNT = 8000` (4× current)
- `EXTRACT_SAMPLE_RATE = 16000` (2× current, gives more raw samples for accurate peaks)
- Extraction time increases ~1.5× (still under 3s per track)
- Cache file grows from ~16KB to ~64KB per track (negligible)

**LOD downsampling (WaveformCanvas.tsx):**

```ts
function decimatePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length <= targetCount) return peaks
  const windowSize = peaks.length / targetCount
  const result: number[] = []
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * windowSize)
    const end = Math.floor((i + 1) * windowSize)
    let max = 0
    for (let j = start; j < end; j++) {
      if (peaks[j] > max) max = peaks[j]
    }
    result.push(max)
  }
  return result
}
```

- Target count = `Math.min(peaks.length, canvasWidth * 2)` (2 peaks per pixel for smooth rendering)
- At fit-to-view (zoom 1×, ~800px canvas): ~1600 peaks rendered
- At max zoom (50×): all 8000 peaks rendered

**Cache migration:**

- Old 2000-peak caches still load fine (array length is variable)
- Waveforms regenerated lazily on next visit (cache invalidation by file hash handles this naturally)
- For immediate migration: can trigger batch regeneration from timeline tab

### Verify

- `yarn test:main --testPathPatterns WaveformExtractor` — passes with new peak count
- Waveform visually shows more detail when zoomed in (clear difference between 1× and 20×)
- Zoomed-out waveform looks clean (no aliasing or noise)
- Performance: scrolling/zooming remains smooth with 8000 peaks

---

## Phase 2: Gradient Waveform Rendering

**Goal:** Replace flat solid bars with vertical gradient fills — bright at peaks, darker toward center line.

### Modify

| File                                                           | Change                                                                                                         |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx` | Replace `ctx.fillStyle = color` with a `CanvasGradient` per draw pass. Apply gradient from peak edge to center |

### Key details

**Gradient approach:**

- Create a single `LinearGradient` for the entire canvas (not per-bar — performance):
  ```ts
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, peakColorFull) // top: full alpha
  gradient.addColorStop(0.35, peakColorDimmed) // near-center: 40% alpha
  gradient.addColorStop(0.5, peakColorDimmed) // center: 40% alpha
  gradient.addColorStop(0.65, peakColorDimmed) // near-center: 40% alpha
  gradient.addColorStop(1, peakColorFull) // bottom: full alpha
  ```
- Uses `ctx.fillStyle = gradient` once, then draws all bars — no per-bar gradient needed
- Color parsing: convert hex color to RGBA for alpha stops using a helper

**Track color palette remains unchanged** — each track gets a color from the existing alternating palette, just enhanced with the gradient.

### Verify

- Waveforms show depth with gradient (bright at extremes, darker at center)
- Visual quality noticeably improved over flat bars
- No performance regression

---

## Phase 3: Frequency-Colored Waveform (3-Band Extraction)

**Goal:** Extract low/mid/high frequency peaks alongside the main peaks. Color each bar by dominant frequency band.

### Modify

| File                                                           | Change                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/WaveformExtractor.ts`              | Add a second extraction pass with 3-band filtering. Store `peaksLow`, `peaksMid`, `peaksHigh` arrays |
| `src/shared/types/waveform.types.ts`                           | Add optional `peaksLow?: number[]`, `peaksMid?: number[]`, `peaksHigh?: number[]` to `WaveformData`  |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx` | When frequency data available, compute per-bar color from dominant band. Blend with gradient         |

### New files

| File                                                   | Purpose                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `src/main/services/waveform/FrequencyAnalyzer.ts`      | Pure function: takes Float32Array PCM → applies simple 3-band energy analysis → returns low/mid/high peak arrays |
| `src/main/services/waveform/FrequencyAnalyzer.spec.ts` | Tests: known frequency content (pure sine tones), silence handling, output array length matches peak count       |

### Key details

**Frequency extraction approach (JS-based, no extra FFmpeg pass):**

The simplest reliable approach is to use the same PCM data already extracted by WaveformExtractor and apply a basic filter bank in TypeScript:

1. Extract PCM at 16kHz mono (from Phase 1) — provides Nyquist up to 8kHz
2. For each peak window (~2 samples per peak at 16kHz → 8000 peaks):
   - Actually, window size = `totalSamples / 8000` ≈ many samples per window
   - Compute per-window energy in 3 bands using simple biquad filter approximation:
     - **Low** (< 250 Hz): 2nd-order low-pass at 250 Hz
     - **Mid** (250–4000 Hz): subtract low and high from total
     - **High** (> 4000 Hz): 2nd-order high-pass at 4000 Hz
3. Normalize each band independently to 0–1

**Alternative (simpler, less accurate but good enough):**

- Per-window: compute DFT (or just zero-crossing rate as a proxy for frequency)
- Zero-crossing rate high → high-frequency dominant, low → bass dominant
- Pros: trivial to implement, no filter design needed
- Cons: rough approximation

**Recommended: simple biquad filter approach.** Well-understood DSP, ~50 lines of code, runs in <1s per track.

**Rendering (WaveformCanvas.tsx):**

```ts
const FREQ_COLORS = {
  low: { r: 239, g: 68, b: 68 }, // red/warm
  mid: { r: 234, g: 179, b: 8 }, // yellow/green
  high: { r: 59, g: 130, b: 246 }, // cyan/blue
}

function getBarColor(low: number, mid: number, high: number): string {
  const total = low + mid + high || 1
  const r = Math.round(
    (low * FREQ_COLORS.low.r +
      mid * FREQ_COLORS.mid.r +
      high * FREQ_COLORS.high.r) /
      total
  )
  const g = Math.round(
    (low * FREQ_COLORS.low.g +
      mid * FREQ_COLORS.mid.g +
      high * FREQ_COLORS.high.g) /
      total
  )
  const b = Math.round(
    (low * FREQ_COLORS.low.b +
      mid * FREQ_COLORS.mid.b +
      high * FREQ_COLORS.high.b) /
      total
  )
  return `rgb(${r},${g},${b})`
}
```

- Per-bar color computed from weighted blend of 3-band energies
- When frequency data unavailable (old cache), falls back to single-color gradient (Phase 2)

**Cache extension:**

- `WaveformData` gets 3 new optional arrays, same length as `peaks`
- Cache file grows from ~64KB to ~256KB per track — still negligible
- Missing fields → graceful fallback to single-color mode

### Verify

- `yarn test:main --testPathPatterns FrequencyAnalyzer` — passes
- Bass-heavy sections show red/warm tones
- Hi-hat/cymbal sections show blue/cool tones
- Mixed sections show blended colors
- Old cache files still load (no frequency data → single-color fallback)
- Frequency extraction adds < 2s to per-track waveform generation

---

## Phase 4: Smooth Bezier Curve Rendering

**Goal:** Add bezier curve waveform style as an alternative to bars. Default to smooth; allow switching.

### Modify

| File                                                           | Change                                                                                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx` | Add `renderSmooth()` method alongside existing `renderBars()`. Switch based on `waveformStyle` prop. Smooth mode uses `Path2D` with `quadraticCurveTo()` |
| `src/renderer/store/timelineStore.ts`                          | Add `waveformStyle: 'bars' \| 'smooth'` field (default: `'smooth'`), add `setWaveformStyle()` action                                                     |
| `src/renderer/components/features/timeline/ZoomControls.tsx`   | Add waveform style toggle button: bars icon / smooth icon                                                                                                |

### Key details

**Bezier curve rendering:**

```ts
function renderSmooth(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number
) {
  const centerY = height / 2
  const barWidth = width / peaks.length

  // Top envelope
  const topPath = new Path2D()
  topPath.moveTo(0, centerY)
  for (let i = 0; i < peaks.length; i++) {
    const x = i * barWidth
    const peakY = centerY - peaks[i] * (centerY - 2)
    const nextX = (i + 1) * barWidth
    const nextPeakY =
      i + 1 < peaks.length ? centerY - peaks[i + 1] * (centerY - 2) : centerY
    const controlX = x + barWidth / 2
    topPath.quadraticCurveTo(controlX, peakY, nextX, nextPeakY)
  }

  // Bottom envelope (mirrored)
  const bottomPath = new Path2D()
  bottomPath.moveTo(width, centerY)
  for (let i = peaks.length - 1; i >= 0; i--) {
    const x = i * barWidth
    const peakY = centerY + peaks[i] * (centerY - 2)
    const prevX = (i - 1) * barWidth
    const prevPeakY =
      i - 1 >= 0 ? centerY + peaks[i - 1] * (centerY - 2) : centerY
    const controlX = x - barWidth / 2
    bottomPath.quadraticCurveTo(controlX, peakY, prevX, prevPeakY)
  }

  // Combine and fill
  // ... close path, fill with gradient
}
```

**Fallback rule:** If fewer than 50 peaks visible (extreme zoom-out), switch to bars automatically — bezier looks too blobby with very few control points.

**Integration with frequency colors (Phase 3):**

- In smooth mode, frequency coloring requires drawing multiple small filled segments rather than one big path
- Alternative: use the gradient approach (Phase 2) for smooth mode, save per-bar frequency color for bars mode
- Recommended: gradient in smooth mode, frequency color in bars mode. Both look professional.

### Verify

- Default rendering is smooth bezier curves
- Toggle to bars shows the classic bar style
- Smooth rendering looks organic (no hard edges)
- Setting persists across tab switches
- Performance remains smooth during zoom/scroll

---

## Phase 5: Beat Grid Toggle + Polish

**Goal:** Add beat grid visibility toggle. Polish all visual improvements together.

### Modify

| File                                                           | Change                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/renderer/store/timelineStore.ts`                          | Add `showBeatGrid: boolean` field (default: `true`), add `toggleBeatGrid()` action |
| `src/renderer/components/features/timeline/ZoomControls.tsx`   | Add beat grid toggle button (FiGrid icon) alongside existing snap toggle           |
| `src/renderer/components/features/timeline/BeatGrid.tsx`       | Wrap render in `if (!showBeatGrid) return null` check — read from timelineStore    |
| `src/renderer/components/features/timeline/TimelineLayout.tsx` | Pass `showBeatGrid` from store to BeatGrid components                              |

### Key details

- Beat grid toggle is independent of snap-to-beat (snap can work without visible grid)
- Toggle state lives in `timelineStore` (transient, not persisted to project — it's a view preference)
- Button shows active/inactive state using Chakra color scheme (blue when on, gray when off)

### Polish items

- Ensure gradient + frequency color + smooth rendering all compose correctly
- Verify no visual artifacts at zoom boundaries (LOD switching)
- Confirm old cache files degrade gracefully (no frequency data → single-color gradient)
- Test with 20+ tracks for performance

### Verify

- Beat grid toggle shows/hides beat lines
- Toggle state independent from snap mode
- All visual improvements work together
- `yarn build` passes
- No performance regression with 20+ tracks

---

## File Inventory Summary

**2 new files:** FrequencyAnalyzer.ts, FrequencyAnalyzer.spec.ts
**5 modified files:** WaveformExtractor.ts, waveform.types.ts, WaveformCanvas.tsx, timelineStore.ts, ZoomControls.tsx, BeatGrid.tsx, TimelineLayout.tsx

## Verification (End-to-End)

1. `yarn build` — full build passes
2. `yarn test:main --testPathPatterns WaveformExtractor` — passes
3. `yarn test:main --testPathPatterns FrequencyAnalyzer` — passes
4. Open Timeline tab → waveforms show gradient fills with frequency coloring
5. Bass sections show warm colors, highs show cool colors
6. Toggle waveform style → bars vs smooth curves both work
7. Zoom in → more detail visible (8000 peaks at max zoom)
8. Zoom out → simplified shapes, no aliasing
9. Beat grid toggle shows/hides grid lines
10. Old waveform caches load without errors (single-color fallback)
11. 20-track project → smooth scrolling and rendering
