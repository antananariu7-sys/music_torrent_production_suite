# Feature: Waveform Performance Improvements

## Overview

Optimize the timeline rendering pipeline for smooth performance with large projects (20+ tracks) and high zoom levels. Introduces React.memo boundaries, adaptive peak resolution, OffscreenCanvas pre-rendering, virtual track rendering, and Web Workers for heavy computation.

## User Problem

The timeline previously rendered all tracks simultaneously with fixed 2000-point peaks and no component memoization. For typical 5–15 track projects this worked well, but as projects grew and zoom levels increased, performance degraded: unnecessary re-renders cascaded through the component tree, canvas drawing blocked the main thread, and peak data was too sparse for high-zoom detail. These improvements have been implemented.

## User Stories

- As a user with 20+ track mixes, I want smooth scrolling and zooming without dropped frames
- As a user, I want waveform generation and BPM detection to happen in the background without freezing the UI
- As a user, I want high zoom levels to show more waveform detail, not just stretched-out sparse bars

## Improvements

### 1. React.memo Component Boundaries

Wrap frequently-rendered child components in `React.memo` with appropriate comparison functions to prevent unnecessary re-renders.

**Components to memoize:**

| Component          | Re-render trigger today | Memo comparison                                                        |
| ------------------ | ----------------------- | ---------------------------------------------------------------------- |
| `WaveformCanvas`   | Any parent state change | `peaks`, `width`, `height`, `color`, `isSelected`, `currentTime`       |
| `BeatGrid`         | Any parent state change | `bpm`, `firstBeatOffset`, `visibleRange`, `showBeatGrid`               |
| `TrimOverlay`      | Any parent state change | `trimStart`, `trimEnd`, `trackWidth`, `pixelsPerSecond`                |
| `CuePointMarker`   | Any parent state change | `cuePoint.id`, `cuePoint.timestamp`, `pixelsPerSecond`                 |
| `TrackInfoOverlay` | Any parent state change | `format`, `bitrate`, `bpm`                                             |
| `CrossfadePopover` | Any parent state change | `songId`, `duration`, `isOpen`                                         |
| `Minimap`          | Every scroll/zoom       | `tracks` (by reference), `totalWidth`, `viewportLeft`, `viewportWidth` |

**Implementation:**

```tsx
const WaveformCanvas = React.memo(
  function WaveformCanvas(props: WaveformCanvasProps) {
    // ... existing implementation
  },
  (prev, next) => {
    return (
      prev.peaks === next.peaks &&
      prev.width === next.width &&
      prev.color === next.color &&
      prev.isSelected === next.isSelected
    )
    // ... shallow compare relevant props
  }
)
```

**Expected impact:** Significant reduction in canvas redraws during scroll/zoom (most re-renders are no-ops today).

### 2. Adaptive Peak Resolution

Generate waveform peaks at higher base resolution and dynamically downsample based on the current zoom level and canvas pixel width.

**Current:** Fixed 2000 peaks per track, regardless of track duration or zoom.
**Problem:** A 10-minute track at 2000 peaks = 1 peak per 0.3s. At high zoom, this looks blocky. A 30-second track at 2000 peaks is wasteful.

**Proposed architecture:**

```
Extraction: FFmpeg → 8000 Hz mono PCM → store as full-res peaks (~8000/s × duration)
                                         ↓
                               Disk cache: full-res peaks file
                                         ↓
Render:    Canvas width in pixels → compute visible time range
           → downsample full-res peaks to canvas_width peaks
           → render
```

**Peak LOD (Level of Detail):**

| Zoom level       | Peaks shown | Visual result              |
| ---------------- | ----------- | -------------------------- |
| 1× (fit-to-view) | ~200-500    | Smooth broad shapes        |
| 5×               | ~1000-2000  | Standard detail            |
| 15×              | ~5000-8000  | Fine detail visible        |
| 50×              | ~20000+     | Individual waveform cycles |

**Downsampling algorithm (max-pooling):**

```ts
function downsamplePeaks(peaks: Float32Array, targetCount: number): number[] {
  const windowSize = peaks.length / targetCount
  const result = new Array(targetCount)
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * windowSize)
    const end = Math.floor((i + 1) * windowSize)
    let max = 0
    for (let j = start; j < end; j++) {
      if (Math.abs(peaks[j]) > max) max = Math.abs(peaks[j])
    }
    result[i] = max
  }
  return result
}
```

**Storage:** Store full-resolution peaks as a binary `Float32Array` file (`.peaks` extension) instead of JSON. Binary is ~4× smaller and ~10× faster to read/write than JSON arrays.

**Cache file format:**

- `<project>/assets/waveforms/<songId>.peaks` — Binary Float32Array (full-res)
- `<project>/assets/waveforms/<songId>.meta.json` — Metadata: `{ duration, sampleRate, fileHash, peakCount, bands: { low, mid, high } }`

### 3. OffscreenCanvas Pre-Rendering

Pre-render waveforms to `OffscreenCanvas` or `ImageBitmap` and blit the result to the visible canvas. This avoids redrawing thousands of bars on every paint.

**Architecture:**

```
                    ┌─────────────────────────────┐
  Peak data ──────→ │ OffscreenCanvas (full track) │  ← rendered once
                    └────────────┬────────────────┘
                                 │
                        createImageBitmap()
                                 │
                    ┌────────────▼────────────────┐
  On scroll/paint → │ Visible canvas (viewport)    │  ← blit via drawImage()
                    └─────────────────────────────┘
```

**When to re-render the OffscreenCanvas:**

- Zoom level changes (peaks change)
- Track data changes (new waveform, cue points change)
- Selection state changes (frequency coloring mode toggle)

**When to only blit:**

- Scroll (just change the `drawImage` source rectangle)
- Playhead movement
- Hover/highlight state

**Implementation:**

```ts
// Render once to offscreen
const offscreen = new OffscreenCanvas(trackWidthPx, trackHeightPx)
const offCtx = offscreen.getContext('2d')!
drawWaveform(offCtx, peaks /* ... */)

// Blit visible portion on every frame
const visibleCanvas = canvasRef.current!
const visCtx = visibleCanvas.getContext('2d')!
visCtx.drawImage(
  offscreen,
  scrollLeft,
  0,
  viewportWidth,
  trackHeightPx, // source rect
  0,
  0,
  viewportWidth,
  trackHeightPx // dest rect
)
```

**Canvas size limits:**

- Browsers cap canvas dimensions (~32768px width on Chrome)
- For very long tracks at high zoom, split into tiles (e.g., 4096px chunks)
- Only render tiles that overlap the viewport + 1 tile buffer on each side

**Expected impact:** 10-50× reduction in paint time during scroll (blit is near-instant vs redrawing 2000+ bars).

### 4. Virtual Track Rendering

Only mount and render tracks that are visible in the viewport. Tracks outside the viewport are replaced with lightweight placeholder divs of the correct height.

**Implementation using IntersectionObserver:**

```tsx
function VirtualTrackContainer({ song, trackPosition, children }) {
  const [isVisible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '200px 0px' } // 200px buffer above/below
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        height: TRACK_HEIGHT,
        position: 'absolute',
        top: trackPosition.top,
      }}
    >
      {isVisible ? children : null}
    </div>
  )
}
```

**Note:** Since the timeline scrolls horizontally (not vertically), the IntersectionObserver approach is primarily useful for vertical overflow if the track list becomes tall. For horizontal virtualization, the OffscreenCanvas tiling approach (improvement #3) handles it.

**Vertical virtualization matters when:**

- 20+ tracks × 120px height = 2400px+ total height
- If the timeline area has a fixed height with vertical scroll, only visible tracks need full rendering

### 5. Web Workers for Heavy Computation

Move CPU-intensive operations off the main thread to prevent UI freezes.

**Operations to move to Web Workers:**

| Operation                 | Current location                      | Worker approach                                                                     |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| Peak downsampling         | Render loop (main thread)             | Dedicated worker: receives full-res peaks + target count, returns downsampled array |
| Frequency band extraction | Main process (FFmpeg)                 | Keep in main process (FFmpeg is already async)                                      |
| Beat grid computation     | `useMemo` (main thread)               | Move to worker if > 1000 beats (long tracks at high zoom)                           |
| Layout computation        | `computeTrackPositions` (main thread) | Move to worker for 20+ tracks                                                       |

**Worker architecture:**

```
Main thread                      Worker thread
───────────                      ─────────────
postMessage({                    onmessage = (e) => {
  type: 'downsample',             const result = downsample(e.data)
  peaks: Float32Array,             postMessage(result, [result.buffer])
  targetCount: 1000              }
})
  ↓
onmessage = (e) => {
  setPeaks(e.data)  // update state with downsampled peaks
}
```

**Transfer semantics:** Use `Transferable` objects (`ArrayBuffer`) for zero-copy data passing between main thread and worker.

**Worker lifecycle:**

- Create a single persistent `WaveformWorker` on Timeline tab mount
- Terminate on tab unmount
- Handle concurrent requests via message ID correlation

**Vite worker import:**

```ts
const worker = new Worker(new URL('./waveform.worker.ts', import.meta.url), {
  type: 'module',
})
```

### 6. WASM Evaluation for DSP Operations

**Status: Evaluated — Decision: Skip WASM**

Benchmark conducted 2026-02-21 using AssemblyScript 0.27 → WASM (4.7KB binary). Full results in [done/wasm-benchmark-plan.md](done/wasm-benchmark-plan.md).

| Operation          | JS Median | WASM Median | Speedup |
| ------------------ | --------- | ----------- | ------- |
| Downsample 8K→200  | 0.007ms   | 0.007ms     | 0.9x    |
| Downsample 32K→500 | 0.024ms   | 0.028ms     | 0.9x    |
| Band energy 160K   | 1.752ms   | 0.578ms     | 3.0x    |
| Band energy 480K   | 4.146ms   | 1.748ms     | 2.4x    |
| BPM detection 700K | 1.686ms   | 1.083ms     | 1.6x    |

**Conclusion:** All JS operations are under 5ms. Max WASM speedup is 3.0x — below the 5x threshold to justify build complexity. Downsample (the renderer hot path) shows no gain due to memory copy overhead. Band energy and BPM run in the main process via FFmpeg, not in the render loop. WASM also cannot accelerate canvas rendering (Canvas 2D API calls must go through JS).

**Decision: JS + Web Workers is sufficient.** Focus on React.memo, OffscreenCanvas, and Web Workers instead.

## Implementation Priority

| Priority | Improvement                   | Impact                                                  | Effort   |
| -------- | ----------------------------- | ------------------------------------------------------- | -------- |
| 1        | React.memo boundaries         | High (eliminates wasted renders)                        | Low      |
| 2        | Adaptive peak resolution      | High (zoom quality + performance)                       | Medium   |
| 3        | OffscreenCanvas pre-rendering | High (scroll performance)                               | Medium   |
| 4        | Web Workers                   | Medium (non-blocking compute)                           | Medium   |
| 5        | Virtual track rendering       | Medium (20+ track support)                              | Low      |
| 6        | ~~WASM evaluation~~           | ~~Low-Medium~~ **Skipped** — benchmarked, not justified | ~~High~~ |

## Acceptance Criteria

- [x] React.memo on all timeline child components (WaveformCanvas, BeatGrid, TrimOverlay, CuePointMarker, TrackInfoOverlay, Minimap, etc.)
- [x] Waveform detail increases visibly when zooming from 1× to 10× (MAX_ZOOM)
- [x] LOD downsampling: 8000 peaks max-pooled to canvas width at render time
- [x] OffscreenCanvas tile cache (4096px tiles, LRU max 50) — blit-only on scroll
- [x] Peak data stored in binary format (`.peaks` + `.meta.json`) — smaller and faster than JSON
- [x] VirtualTrack with IntersectionObserver-based virtualization (500px horizontal buffer)
- [x] DPR-aware canvas rendering for crisp HiDPI displays
- [x] Canvas-based BeatGrid rendering (not DOM elements)
- [x] WASM evaluation documented with benchmark results and go/no-go decision — **Skipped** (all JS ops < 5ms, max 3x speedup)

## Edge Cases

- **OffscreenCanvas not supported:** Fall back to standard canvas rendering (OffscreenCanvas is supported in all modern Chromium/Electron versions, but have a fallback)
- **Web Worker creation fails:** Fall back to main-thread computation with a console warning
- **Binary peak file corruption:** Validate file size against expected byte count (`peakCount × 4 bytes`). If mismatch, regenerate.
- **Canvas size > 32768px:** Tile the OffscreenCanvas into 4096px chunks. Blit visible tiles only.
- **Transferable ArrayBuffer detached:** After `postMessage` with transfer, the source ArrayBuffer is no longer usable. Clone if needed before transfer.

## Out of Scope

- GPU-accelerated rendering (WebGL/WebGPU for waveforms)
- Streaming peak data (progressive loading during extraction)
- Multi-threaded FFmpeg (FFmpeg already runs as a separate process)
- Service Worker caching of peak data

## Dependencies

- Existing: WaveformExtractor, BpmDetector, WaveformCanvas, TimelineLayout
- Existing: Vite worker import support (`new Worker(new URL(...))`)
- New: OffscreenCanvas API (Chromium 69+, well within Electron 40)
- ~~Optional: Rust toolchain + wasm-pack~~ — WASM evaluation complete, not needed
