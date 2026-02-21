# Waveform Performance Improvements — Implementation Plan

## Context

The timeline waveform rendering works correctly but has no performance optimization. **Zero components use React.memo**, causing cascading re-renders on every store update. The Playhead reads `currentTime` at ~60fps and triggers the entire tree to re-render. No OffscreenCanvas, no Web Workers, no virtual rendering. Peak cache is JSON (slow parse). These issues compound with 20+ track projects.

Full spec: `docs/features/waveform-performance-improvements.md`

### Current State

- **WaveformCanvas.tsx** (472 lines): Canvas rendering with LOD downsampling via `useMemo`, bezier/bars/gradient/frequency — NOT wrapped in React.memo
- **TimelineLayout.tsx** (509 lines): Track positioning, scroll sync, zoom, click handlers — recomputes `computeTrackPositions()` on every render
- **Playhead.tsx** (55 lines): Reads `currentTime` at ~60fps via Zustand hook — causes entire parent tree to re-render
- **TimelineTab.tsx** (146 lines): Sorts songs array on every render (not memoized)
- **BeatGrid, TrimOverlay, CuePointMarker, TrackInfoOverlay, Minimap, TimeRuler, ZoomControls**: None use React.memo
- **timelineStore.ts** (139 lines): Zustand store, no perf issues itself
- **WaveformExtractor.ts** (384 lines): FFmpeg extraction, JSON cache on disk
- **Build**: Vite (renderer) with native Worker support, esbuild (main CJS)

---

## Phase 1: React.memo Boundaries

**High impact, low effort. Do first.**

### 1A. Wrap all child components in React.memo

| File                                                             | Comparator                                              | Notes                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`   | Custom — check all 10 props by reference/value          | All props affect canvas draw                       |
| `src/renderer/components/features/timeline/BeatGrid.tsx`         | Default shallow                                         | All props are primitives                           |
| `src/renderer/components/features/timeline/TrimOverlay.tsx`      | Default shallow                                         | All props are numbers/undefined                    |
| `src/renderer/components/features/timeline/CuePointMarker.tsx`   | Custom — compare `cuePoint.id`, `x`, `trackHeight`      | Exclude `onClick` (unstable closure)               |
| `src/renderer/components/features/timeline/TrackInfoOverlay.tsx` | Custom — compare `song.id`, `song.bpm`, display fields  | Song object changes ref on unrelated updates       |
| `src/renderer/components/features/timeline/Minimap.tsx`          | Custom — reference equality on `waveforms`, `positions` | Internally subscribes to scrollPosition            |
| `src/renderer/components/features/timeline/TimeRuler.tsx`        | Default shallow                                         | Props are numbers; internally subscribes to scroll |
| `src/renderer/components/features/timeline/ZoomControls.tsx`     | Default shallow                                         | Single `totalDuration` prop                        |

**Reference equality works for `peaks`:** The `waveformCache` in Zustand holds `WaveformData` objects with `peaks: number[]` arrays created once during extraction. Same reference on every render unless waveform is regenerated.

### 1B. Playhead — direct DOM updates (bypass React rendering)

**File:** `src/renderer/components/features/timeline/Playhead.tsx`

The #1 re-render source. Currently uses `useAudioPlayerStore(s => s.currentTime)` which triggers React re-renders at ~60fps.

**Change:** Use `useAudioPlayerStore.subscribe()` inside `useEffect` to update position via `ref.current.style.transform = translateX(${x}px)` directly. No React state, no re-renders. Use `willChange: 'transform'` for GPU compositing. Wrap in React.memo.

### 1C. Memoize computed values in TimelineTab + TimelineLayout

**File:** `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx`

- `useMemo` for `songs` sort (currently `[...songs].sort()` creates new array every render)
- `useMemo` for `positions` via `computeTrackPositions()`
- `useMemo` for `totalWidth`

**File:** `src/renderer/components/features/timeline/TimelineLayout.tsx`

- `useMemo` for `positions` and `totalWidth`
- `useCallback` for `handleCuePointClick` to stabilize CuePointMarker's onClick

### 1D. ZoomControls — grouped store selector

**File:** `src/renderer/components/features/timeline/ZoomControls.tsx`

Currently 9 separate `useTimelineStore()` calls. Group state selectors with `useShallow` from `zustand/react/shallow`:

```ts
import { useShallow } from 'zustand/react/shallow'

const { zoomLevel, snapMode, frequencyColorMode, waveformStyle, showBeatGrid } =
  useTimelineStore(
    useShallow((s) => ({
      zoomLevel: s.zoomLevel,
      snapMode: s.snapMode,
      frequencyColorMode: s.frequencyColorMode,
      waveformStyle: s.waveformStyle,
      showBeatGrid: s.showBeatGrid,
    }))
  )
```

Action selectors (toggleX, zoomIn, etc.) are stable refs from `create()` — keep separate.

### Verify

- React DevTools Profiler: record during playback + scroll, verify WaveformCanvas/BeatGrid show 0 unnecessary renders
- Playhead moves smoothly without TimelineLayout re-rendering
- `yarn build` passes

---

## Phase 2: OffscreenCanvas Pre-Rendering

**High impact, medium effort.**

### 2A. Extract drawing functions to pure module

**New file:** `src/renderer/components/features/timeline/waveformDrawing.ts`

Move from WaveformCanvas.tsx: `colorWithAlpha`, `createBarGradient`, `getDominantBand`, `drawFrequencyBars`, `buildEnvelopePath`, `drawSmoothWaveform`, `downsampleArray`, `BAND_COLORS`, `FREQ_THRESHOLD`. These are pure functions that take a `CanvasRenderingContext2D` (or `OffscreenCanvasRenderingContext2D`) — work identically on OffscreenCanvas.

### 2B. Tile cache infrastructure

**New file:** `src/renderer/components/features/timeline/waveformTileCache.ts`

- Tile size: 4096 CSS pixels wide (stays under Chrome's 32768px canvas limit)
- `makeCacheKey(peaksLength, width, color, frequencyColorMode, waveformStyle)` — invalidation key
- Each tile rendered to `OffscreenCanvas` → converted to `ImageBitmap` via `createImageBitmap()`
- LRU eviction: max ~50 tiles across all tracks to cap memory

Types:

```ts
export const TILE_WIDTH = 4096

export interface WaveformTile {
  index: number
  bitmap: ImageBitmap
  cacheKey: string
}
```

### 2C. Refactor WaveformCanvas to tile-based rendering

**File:** `src/renderer/components/features/timeline/WaveformCanvas.tsx`

Two-layer architecture:

1. **Tile rendering** (when cacheKey changes): slice peaks per tile → draw on OffscreenCanvas → `createImageBitmap()` → store in `tilesRef`
2. **Blitting** (on mount / after tile render): `ctx.drawImage(tile.bitmap, ...)` to compose tiles onto visible canvas

Since the parent container uses native CSS `overflow-x: auto` scrolling, the canvas renders at full track width. Browser handles scroll via CSS. Tiles are composited once and the bitmap stays static.

**What triggers tile re-render vs no-op:**

| Event              | Canvas work                            |
| ------------------ | -------------------------------------- |
| Scroll             | None (browser CSS overflow handles it) |
| Playhead           | None (separate DOM element)            |
| Zoom change        | Re-render tiles (new peak count)       |
| Style/color toggle | Re-render tiles                        |
| Selection change   | Border only (no canvas work)           |

**Memory budget:** 4096×480 tile at 2x DPR = ~15MB each. For 20-track project at 4x zoom: ~6 tiles per track × 20 = 120 tiles uncapped. LRU at 50 tiles = ~750MB worst case. Consider capping DPR to 1 for offscreen tiles if memory is a concern.

### Verify

- Scroll rapidly — canvas never visibly redraws
- Toggle frequency mode — tiles rebuild (brief flash acceptable)
- Memory: check `performance.memory` stays under 200MB for 20-track project
- `yarn build` passes

---

## Phase 3: Binary Peak Storage

**Medium impact, low effort. Can run in parallel with Phase 2.**

### 3A. Binary file format

Replace JSON cache with binary `.peaks` + `.meta.json` per song.

**`.peaks` binary layout:**

```
[0-3]   Magic: 0x50454B53 ("PEKS")
[4-7]   Version: uint32 = 1
[8-11]  Peak count (N): uint32
[12-15] Flags: uint32 (bit 0 = hasBands)
[16..]  Float32Array: peaks[N], peaksLow[N], peaksMid[N], peaksHigh[N]
```

Size: ~125 KB vs ~300 KB JSON. Parse: buffer read vs JSON.parse (~10x faster).

**`.meta.json`:** `{ songId, duration, sampleRate, fileHash, peakCount, hasBands }`

### 3B. Modify WaveformExtractor

**File:** `src/main/services/waveform/WaveformExtractor.ts`

- `writeCache()` → write `.peaks` binary (Buffer.alloc + Float32Array) + `.meta.json`
- `readCache()` → try binary first (check `.peaks` exists), fall back to old `.json` for migration
- Validate binary on read: check magic number `0x50454B53`, file size matches `16 + peakCount * 4 * arrayCount`
- `Array.from(Float32Array)` on read (WaveformData type stays `number[]` for IPC compat)

### 3C. Update tests

**File:** `src/main/services/waveform/WaveformExtractor.spec.ts`

- Test binary write/read roundtrip
- Test JSON fallback migration
- Test corrupted `.peaks` file → regeneration (no crash)

### Verify

- Delete old `.json` caches, re-extract → `.peaks` + `.meta.json` created
- Keep one old `.json` → verify fallback read works
- Truncate a `.peaks` file → verify regeneration
- `yarn test:main --testPathPatterns WaveformExtractor`
- `yarn build`

---

## Phase 4: Web Worker for Peak Downsampling

**Medium impact, medium effort.**

### 4A. Worker file

**New file:** `src/renderer/components/features/timeline/waveform.worker.ts`

Message protocol:

```ts
interface WorkerRequest {
  id: number
  type: 'downsample'
  peaks: Float32Array
  peaksLow?: Float32Array
  peaksMid?: Float32Array
  peaksHigh?: Float32Array
  targetCount: number
}

interface WorkerResponse {
  id: number
  type: 'downsample-result'
  peaks: Float32Array
  peaksLow?: Float32Array
  peaksMid?: Float32Array
  peaksHigh?: Float32Array
}
```

Uses `Transferable` ArrayBuffers for zero-copy transfer both ways.

Vite handles bundling: `new Worker(new URL('./waveform.worker.ts', import.meta.url), { type: 'module' })`

### 4B. Worker hook

**New file:** `src/renderer/hooks/useWaveformWorker.ts`

- Creates persistent Worker on mount, terminates on unmount
- `downsample()` returns `Promise<WorkerResponse>` with pending request map (id → resolve)
- Converts `number[]` → `Float32Array` for transfer, `Array.from()` on result
- Fallback: if Worker creation fails, run synchronously on main thread

### 4C. Integration into WaveformCanvas

Replace synchronous `useMemo` LOD with async worker call. **Gate on array size**: only use worker for `peaks.length > 10000` (below that, sync is faster due to message overhead). Keep synchronous `useMemo` as fallback for initial render to avoid visual flash.

### Verify

- Check `dist/renderer/assets/` for bundled `.worker.js`
- DevTools Performance: downsample not on main thread
- No "ArrayBuffer is detached" errors
- `yarn build`

---

## Phase 5: Virtual Track Rendering

**Medium impact, low effort.**

### 5A. VirtualTrack wrapper

**New file:** `src/renderer/components/features/timeline/VirtualTrack.tsx`

Uses `IntersectionObserver` with `rootMargin: '0px 500px 0px 500px'` (500px horizontal buffer). Children only mount when track intersects viewport.

```tsx
export const VirtualTrack = memo(function VirtualTrack({
  left,
  width,
  height,
  children,
}: VirtualTrackProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '0px 500px 0px 500px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', left, top: 0, width, height }}
    >
      {isVisible ? children : null}
    </div>
  )
})
```

### 5B. Integrate into TimelineLayout

**File:** `src/renderer/components/features/timeline/TimelineLayout.tsx`

Replace `<Box position="absolute">` wrapper per track with `<VirtualTrack>`. Content (WaveformCanvas, BeatGrid, TrimOverlay, CuePointMarkers) only mounts when visible.

**Impact:** 20-track project with ~1200px viewport → only 2-3 tracks mounted at once vs all 20.

### Verify

- Load 10+ track project → only 2-3 WaveformCanvas instances mount
- Scroll → tracks mount/unmount at edges
- Playhead still works for unmounted tracks
- `yarn build`

---

## Implementation Order

```
Phase 1 (React.memo) ──────────────────────> Phase 2 (OffscreenCanvas) ──> Phase 4 (Worker)
                      \
                       \──> Phase 3 (Binary peaks) [parallel with Phase 2]
                        \
                         \──> Phase 5 (Virtual tracks) [anytime after Phase 1]
```

## New Files Summary

| File                                                             | Phase |
| ---------------------------------------------------------------- | ----- |
| `src/renderer/components/features/timeline/waveformDrawing.ts`   | 2A    |
| `src/renderer/components/features/timeline/waveformTileCache.ts` | 2B    |
| `src/renderer/components/features/timeline/waveform.worker.ts`   | 4A    |
| `src/renderer/hooks/useWaveformWorker.ts`                        | 4B    |
| `src/renderer/components/features/timeline/VirtualTrack.tsx`     | 5A    |

## Modified Files Summary

| File                                                                 | Phases     |
| -------------------------------------------------------------------- | ---------- |
| `src/renderer/components/features/timeline/WaveformCanvas.tsx`       | 1A, 2C, 4C |
| `src/renderer/components/features/timeline/BeatGrid.tsx`             | 1A         |
| `src/renderer/components/features/timeline/TrimOverlay.tsx`          | 1A         |
| `src/renderer/components/features/timeline/CuePointMarker.tsx`       | 1A         |
| `src/renderer/components/features/timeline/TrackInfoOverlay.tsx`     | 1A         |
| `src/renderer/components/features/timeline/Minimap.tsx`              | 1A         |
| `src/renderer/components/features/timeline/TimeRuler.tsx`            | 1A         |
| `src/renderer/components/features/timeline/ZoomControls.tsx`         | 1A, 1D     |
| `src/renderer/components/features/timeline/Playhead.tsx`             | 1B         |
| `src/renderer/components/features/timeline/TimelineLayout.tsx`       | 1C, 5B     |
| `src/renderer/pages/ProjectOverview/components/tabs/TimelineTab.tsx` | 1C         |
| `src/main/services/waveform/WaveformExtractor.ts`                    | 3B         |
| `src/main/services/waveform/WaveformExtractor.spec.ts`               | 3C         |

## End-to-End Verification

1. **Phase 1:** React DevTools Profiler shows zero wasted renders during scroll/playback
2. **Phase 2:** Canvas never redraws on scroll (only on zoom/style change)
3. **Phase 3:** `yarn test:main --testPathPatterns WaveformExtractor` passes with binary cache
4. **Phase 4:** Downsample runs off main thread (DevTools Performance tab)
5. **Phase 5:** Only visible tracks mount (console.log verification)
6. **Full build:** `yarn build` passes after all phases
