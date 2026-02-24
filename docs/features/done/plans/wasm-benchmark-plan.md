# WASM Benchmark — Implementation Plan

**Status**: Done — Decision: **Skip WASM**

## Benchmark Results (2026-02-21)

Toolchain: AssemblyScript 0.27 → WASM (4.7KB binary). Tested in Node.js (V8).

| Operation          | Input Size    | JS Median | WASM Median | Speedup |
| ------------------ | ------------- | --------- | ----------- | ------- |
| Downsample 8K→200  | 8,000 → 200   | 0.007ms   | 0.007ms     | 0.9x    |
| Downsample 32K→500 | 32,000 → 500  | 0.024ms   | 0.028ms     | 0.9x    |
| Band energy 160K   | 160,000 → 200 | 1.752ms   | 0.578ms     | 3.0x    |
| Band energy 480K   | 480,000 → 600 | 4.146ms   | 1.748ms     | 2.4x    |
| BPM detection 700K | 705,600 → BPM | 1.686ms   | 1.083ms     | 1.6x    |

All JS operations are **under 5ms** — well within the 16.6ms frame budget.

### Decision: Skip WASM

Per the W4 decision criteria:

- **All JS ops < 5ms** → no frame budget pressure
- **Max WASM speedup = 3.0x** → below the 5x threshold to justify build complexity
- **Downsample (renderer hot path): no gain** — memory copy overhead negates WASM benefit
- **Band energy + BPM run in main process** (FFmpeg child process) — not in the renderer render loop

**Conclusion**: JS + Web Workers is sufficient. The performance plan should focus on React.memo, OffscreenCanvas tile caching, and Web Workers. WASM adds build toolchain complexity (AssemblyScript, `asc` compiler) with marginal gains that don't justify the maintenance cost.

Additionally, **WASM cannot accelerate canvas rendering** — Canvas 2D API calls must go through JavaScript. WASM can only pre-compute data, but our data computation is already sub-5ms.

---

## Context

The performance spec lists WASM as Priority 6 with a decision gate: "Only if profiling shows Web Workers alone can't maintain 60fps." This plan creates a **standalone benchmark harness** to measure JS vs WASM for three DSP operations, producing a data-driven go/no-go decision.

This is independent from the main performance improvements plan (`waveform-performance-improvements-plan.md`). It can run at any time, ideally after Phase 1 (React.memo) establishes the baseline.

Full spec: `docs/features/waveform-performance-improvements.md` (section 6: WASM Evaluation)

---

## Scope

Benchmark three operations at realistic data sizes:

| Operation                               | Input                      | Current impl                                  | WASM potential             |
| --------------------------------------- | -------------------------- | --------------------------------------------- | -------------------------- |
| Peak downsampling (max-pool)            | Float32Array 8K→200        | `downsampleArray()` in WaveformCanvas.tsx     | 2-5x faster                |
| Frequency band energy (IIR filter bank) | Float32Array 160K samples  | FFmpeg filter_complex in WaveformExtractor.ts | 10-20x if moved to JS/WASM |
| BPM autocorrelation                     | Float32Array ~700K samples | `autocorrelate()` in BpmDetector.ts           | 5-10x faster               |

---

## Phase W1: JS Baseline Benchmark

### W1A. Benchmark harness

**New file:** `benchmarks/wasm-benchmark.html`

Standalone HTML file (no build step needed). Opens in any browser or Electron.

Features:

1. Generates synthetic Float32Array test data (sine waves at known frequencies)
2. Runs each operation N times, measures `performance.now()` median + p95
3. Reports results in an HTML table
4. "Run Benchmark" button to trigger, progress indicator

### W1B. Pure JS DSP implementations

**New file:** `benchmarks/dsp-js.js`

Extract and adapt from the codebase (pure functions, no imports):

```js
// 1. Peak downsampling — max-pool
function downsampleMaxPool(input, targetCount) {
  /* ... */
}

// 2. Frequency band energy — 2nd-order IIR biquad filter bank
//    Low-pass at 250Hz, high-pass at 4kHz, mid = residual
function computeBandEnergy(pcm, sampleRate) {
  /* ... returns { low, mid, high } */
}

// 3. Autocorrelation for BPM detection
//    Standard unbiased autocorrelation over lag range [minLag, maxLag]
function autocorrelate(onsets, minBpm, maxBpm, sampleRate) {
  /* ... returns { bpm, confidence } */
}
```

### W1C. Test data generation

```js
function generateSineWave(frequency, sampleRate, durationSec) {
  const n = sampleRate * durationSec
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    buf[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate)
  }
  return buf
}

function generateMixedSignal(sampleRate, durationSec) {
  // Mix of 100Hz (bass), 1kHz (mid), 6kHz (high) at different amplitudes
  // Simulates real audio for frequency band testing
}
```

### W1D. Test data sizes (matching real usage)

| Operation          | Input size                      | Iterations | Why                       |
| ------------------ | ------------------------------- | ---------- | ------------------------- |
| Downsample 8K→200  | 8000 floats                     | 1000       | Current peak count        |
| Downsample 32K→500 | 32000 floats                    | 1000       | Future hi-res scenario    |
| Band energy        | 160000 samples (10s at 16kHz)   | 100        | Typical track segment     |
| Band energy        | 480000 samples (30s at 16kHz)   | 50         | Long segment              |
| Autocorrelation    | 700000 samples (16s at 44.1kHz) | 50         | Full BPM detection window |

### Verify

- Open `benchmarks/wasm-benchmark.html` in Chrome/Electron
- Click "Run Benchmark" — all JS benchmarks complete, table shows median + p95 times
- No errors in console

---

## Phase W2: WASM Implementation

### W2A. Toolchain: AssemblyScript

Why AssemblyScript over Rust/C:

- TypeScript-like syntax (familiar to the team)
- No external toolchain to install (Rust, Emscripten)
- Simple: `npm install assemblyscript && npx asc`
- Output: `.wasm` file loadable via `WebAssembly.instantiate()`
- Good enough for numeric DSP (typed arrays, no GC pressure, SIMD support)

### W2B. Project structure

**New directory:** `benchmarks/wasm/`

```
benchmarks/wasm/
├── assembly/
│   ├── index.ts         # AssemblyScript source (all 3 DSP functions)
│   └── tsconfig.json    # AS-specific config
├── build/
│   └── dsp.wasm         # Compiled output (gitignored)
├── package.json         # { "devDependencies": { "assemblyscript": "^0.27" } }
└── README.md            # Build instructions
```

### W2C. AssemblyScript DSP functions

**File:** `benchmarks/wasm/assembly/index.ts`

```ts
// Peak downsampling — max-pool over Float32 arrays via raw memory access
export function downsample(
  inputPtr: usize, // pointer to Float32Array in WASM linear memory
  inputLen: i32,
  targetCount: i32,
  outputPtr: usize // pointer to pre-allocated output Float32Array
): void {
  const windowSize: f64 = f64(inputLen) / f64(targetCount)
  for (let i: i32 = 0; i < targetCount; i++) {
    const start: i32 = i32(Math.floor(f64(i) * windowSize))
    const end: i32 = i32(Math.floor(f64(i + 1) * windowSize))
    let max: f32 = 0
    for (let j: i32 = start; j < end; j++) {
      const val = load<f32>(inputPtr + (j << 2))
      if (val > max) max = val
    }
    store<f32>(outputPtr + (i << 2), max)
  }
}

// Frequency band energy — 2nd-order IIR biquad filters
//
// Implements three parallel biquad filters:
//   - Low-pass at 250Hz (bass)
//   - High-pass at 4000Hz (treble)
//   - Band-pass 250-4000Hz (mid) via subtraction
//
// Each filter processes the input and writes per-window RMS energy
// to the output arrays (same length as peak count).
export function bandEnergy(
  inputPtr: usize, // raw PCM Float32
  inputLen: i32,
  sampleRate: f32,
  peakCount: i32,
  lowPtr: usize, // output: low-band energy per peak window
  midPtr: usize, // output: mid-band energy per peak window
  highPtr: usize // output: high-band energy per peak window
): void {
  const windowSize: i32 = inputLen / peakCount

  // Biquad coefficients for low-pass at 250Hz
  const wLow: f64 = (2.0 * Math.PI * 250.0) / f64(sampleRate)
  const alphaLow: f64 = Math.sin(wLow) / (2.0 * 0.707) // Q = 0.707
  // ... (a0, a1, a2, b0, b1, b2 for low-pass)

  // Biquad coefficients for high-pass at 4000Hz
  const wHigh: f64 = (2.0 * Math.PI * 4000.0) / f64(sampleRate)
  const alphaHigh: f64 = Math.sin(wHigh) / (2.0 * 0.707)
  // ... (a0, a1, a2, b0, b1, b2 for high-pass)

  // Process each peak window
  for (let p: i32 = 0; p < peakCount; p++) {
    const start: i32 = p * windowSize
    const end: i32 = min(start + windowSize, inputLen)

    let sumLow: f64 = 0,
      sumHigh: f64 = 0,
      sumTotal: f64 = 0
    // ... filter each sample, accumulate RMS
    // midEnergy = totalEnergy - lowEnergy - highEnergy

    store<f32>(lowPtr + (p << 2), f32(Math.sqrt(sumLow / f64(end - start))))
    store<f32>(highPtr + (p << 2), f32(Math.sqrt(sumHigh / f64(end - start))))
    store<f32>(
      midPtr + (p << 2),
      f32(Math.sqrt(max(0, sumTotal - sumLow - sumHigh) / f64(end - start)))
    )
  }
}

// Autocorrelation for BPM detection
//
// Computes normalized autocorrelation of onset signal over
// lag range corresponding to [minBpm, maxBpm].
// Returns lag with highest correlation via output array.
export function autocorrelate(
  onsetsPtr: usize,
  onsetsLen: i32,
  minLag: i32, // samples per beat at maxBpm
  maxLag: i32, // samples per beat at minBpm
  resultPtr: usize // output: correlation values for each lag
): void {
  for (let lag: i32 = minLag; lag <= maxLag; lag++) {
    let sum: f64 = 0
    let count: i32 = 0
    for (let i: i32 = 0; i < onsetsLen - lag; i++) {
      sum +=
        f64(load<f32>(onsetsPtr + (i << 2))) *
        f64(load<f32>(onsetsPtr + ((i + lag) << 2)))
      count++
    }
    store<f32>(resultPtr + ((lag - minLag) << 2), f32(sum / f64(count)))
  }
}
```

### W2D. Build script

**File:** `benchmarks/wasm/package.json`

```json
{
  "private": true,
  "scripts": {
    "build": "asc assembly/index.ts -o build/dsp.wasm --optimize --exportRuntime",
    "build:debug": "asc assembly/index.ts -o build/dsp.wasm --debug"
  },
  "devDependencies": {
    "assemblyscript": "^0.27.0"
  }
}
```

### Verify

- `cd benchmarks/wasm && npm install && npm run build`
- `build/dsp.wasm` file created (~5-20 KB)
- No compilation errors

---

## Phase W3: Benchmark Comparison

### W3A. WASM loader in benchmark HTML

**Update `benchmarks/wasm-benchmark.html`:**

```js
async function loadWasm() {
  const response = await fetch('wasm/build/dsp.wasm')
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer()
  )
  return instance.exports
}

function copyToWasm(wasm, data) {
  // Allocate in WASM linear memory, copy Float32Array
  const ptr = wasm.__alloc(data.byteLength)
  new Float32Array(wasm.memory.buffer, ptr, data.length).set(data)
  return ptr
}
```

### W3B. Run comparative benchmarks

For each operation:

1. Generate test data (same seed for both)
2. Run JS implementation N times, collect timing
3. Copy data to WASM memory
4. Run WASM implementation N times, collect timing
5. Verify outputs match (tolerance ±0.001 for floating point)
6. Display comparison table

### W3C. Expected output format

```
┌────────────────────┬───────────┬─────────────┬─────────┐
│ Operation          │ JS median │ WASM median │ Speedup │
├────────────────────┼───────────┼─────────────┼─────────┤
│ Downsample 8K→200  │    0.3ms  │      0.1ms  │   3.0x  │
│ Downsample 32K→500 │    1.2ms  │      0.2ms  │   6.0x  │
│ Band energy 160K   │   12.0ms  │      1.5ms  │   8.0x  │
│ Band energy 480K   │   35.0ms  │      4.0ms  │   8.8x  │
│ Autocorrelation    │   45.0ms  │      5.0ms  │   9.0x  │
└────────────────────┴───────────┴─────────────┴─────────┘
```

(Values are estimates — actual numbers will determine the decision.)

### Verify

- Open `benchmarks/wasm-benchmark.html` in browser
- Both JS and WASM columns populated
- Outputs match within tolerance
- Speedup column calculated correctly

---

## Phase W4: Decision & Documentation

### Decision criteria

| Result                                               | Decision                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| All JS ops < 2ms                                     | **Skip WASM** — not worth the build complexity                                            |
| Downsample < 2ms, band energy/autocorrelation > 10ms | **WASM for band energy + autocorrelation only** (main process Node WASM, not renderer)    |
| Multiple ops > 5ms in renderer path                  | **WASM via Web Worker** in renderer for downsampling; WASM in main process for extraction |
| WASM < 2x speedup over JS                            | **Skip WASM** — marginal gains don't justify toolchain complexity                         |

### Key considerations

- **Build complexity cost:** AssemblyScript adds `npm install` + `asc` build step. Acceptable if gains are > 5x.
- **Maintenance cost:** WASM functions must be kept in sync with JS implementations. Low risk for stable DSP algorithms.
- **Integration scope:**
  - Renderer (Web Worker + WASM): peak downsampling — only if array sizes grow beyond 32K
  - Main process (Node.js WASM): band energy extraction — replaces FFmpeg filter_complex if faster
  - Main process (Node.js WASM): BPM autocorrelation — replaces pure TS implementation if faster

### Documentation output

Update `docs/features/waveform-performance-improvements.md` acceptance criteria with:

1. Actual benchmark numbers (table)
2. Go/no-go decision with rationale
3. If go: which operations to port, integration architecture
4. If no-go: document why JS + Web Workers is sufficient

---

## Files Summary

| File                                     | Purpose                                      |
| ---------------------------------------- | -------------------------------------------- |
| `benchmarks/wasm-benchmark.html`         | Standalone benchmark runner (HTML + JS)      |
| `benchmarks/dsp-js.js`                   | Pure JS DSP implementations for baseline     |
| `benchmarks/wasm/assembly/index.ts`      | AssemblyScript WASM source (3 DSP functions) |
| `benchmarks/wasm/assembly/tsconfig.json` | AS TypeScript config                         |
| `benchmarks/wasm/package.json`           | AS dev dependency + build script             |
| `benchmarks/wasm/build/dsp.wasm`         | Compiled WASM binary (gitignored)            |

## End-to-End Verification

1. `cd benchmarks/wasm && npm install && npm run build` — compiles without errors
2. Open `benchmarks/wasm-benchmark.html` in Chrome or Electron
3. Click "Run Benchmark" — all operations complete
4. JS and WASM results populated in comparison table
5. Output correctness verified (JS vs WASM outputs match within ±0.001)
6. Decision documented in `docs/features/waveform-performance-improvements.md`
