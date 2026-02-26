# Mix Preparation View v2 — Implementation Plan

**Date:** 2026-02-26
**Status:** Planned
**Feature spec:** [docs/features/mix-preparation-v2.md](../mix-preparation-v2.md)
**v1 plan:** [docs/features/done/plans/mix-preparation-view-plan.md](../done/plans/mix-preparation-view-plan.md)

---

## Scope

This plan covers **Priority 1** (UX Polish 9a–d + Beat-Sync Phase A) and **Priority 2** (Mix Health Dashboard). Higher-effort features (Section Detection, EQ, Advanced Mix-Point, etc.) are covered in the [advanced features plan](mix-preparation-v2-advanced-plan.md).

---

## Decisions

| Question                   | Decision                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Crossfade curve preview    | Reuse `CrossfadeCurveCanvas` from timeline — already renders all 3 curve types           |
| Tempo sync persistence     | Add `tempoAdjustment` field to `Song` type, persist via existing `updateSong` IPC        |
| Save feedback approach     | Inline micro-indicator (not toast) — non-intrusive, no stacking                          |
| Mix Health location        | New tab section inside MixPrepView, toggled via a button in the pair navigation bar area |
| Transition score algorithm | Weighted composite: BPM delta (40%), key compatibility (35%), bitrate match (25%)        |

---

## Phase 1 — Crossfade Control Clarity (9a)

**Goal:** Replace the opaque crossfade slider with a clear, visual control that explains what it does and shows the curve shape.

### Changes to existing files

| File                                                                       | Change                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/TransitionCrossfadeControl.tsx` | Replace `<input type="range">` with Chakra `Slider`. Add inline curve preview. Add helper text. Add save indicator. |

### Step-by-step

1. **Replace HTML range with Chakra Slider**
   - Import `Slider` from `@chakra-ui/react` (Chakra v3 compound component)
   - Replace the raw `<input type="range" ...>` (line 138–146) with:
     ```tsx
     <Slider.Root
       min={0}
       max={30}
       step={0.5}
       value={[duration]}
       onValueChange={({ value }) => handleSliderChange(value[0])}
     >
       <Slider.Control>
         <Slider.Track>
           <Slider.Range />
         </Slider.Track>
         <Slider.Thumb index={0} />
       </Slider.Control>
     </Slider.Root>
     ```
   - Update `handleSliderChange` signature: `(val: number) => void` instead of ChangeEvent

2. **Add inline curve preview**
   - Import `CrossfadeCurveCanvas` from `../timeline/CrossfadeCurveCanvas`
   - Insert a 120×40px canvas between the curve type buttons and the preview button:
     ```tsx
     <Box
       borderWidth="1px"
       borderColor="border.base"
       borderRadius="sm"
       overflow="hidden"
       mx="auto"
       w="120px"
       h="40px"
     >
       <CrossfadeCurveCanvas
         width={120}
         height={40}
         curveType={curveType}
         colorA="#3b82f6"
         colorB="#8b5cf6"
       />
     </Box>
     ```
   - The canvas already handles DPR and renders all 3 curve types

3. **Add helper text**
   - Below the "Crossfade" header, add:
     ```tsx
     <Text fontSize="2xs" color="text.muted">
       How long the outgoing and incoming tracks overlap
     </Text>
     ```

4. **Update layout**
   - Reorder children: Header + helper → Slider → Curve buttons + preview canvas → Preview button
   - Keep the existing debounced persistence logic unchanged

### Acceptance criteria

- [ ] Crossfade slider uses Chakra `Slider` component, visually consistent with app theme
- [ ] Curve preview canvas shows fade-out/fade-in shape, updates when curve type changes
- [ ] Helper text explains crossfade purpose
- [ ] Duration display still shows `X.Xs` value
- [ ] Slider still debounce-persists to backend (500ms)

---

## Phase 2 — Save Feedback Indicator (9d)

**Goal:** Show a brief "Saved" indicator when crossfade settings are persisted.

### Changes to existing files

| File                                                                       | Change                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/renderer/components/features/mix-prep/TransitionCrossfadeControl.tsx` | Add save state tracking and animated indicator |

### Step-by-step

1. **Add save state**

   ```tsx
   const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
     'idle'
   )
   ```

2. **Update `persistUpdates` callback**
   - Set `setSaveState('saving')` when debounce fires
   - On success response, set `setSaveState('saved')`
   - After 1.5s timeout, set back to `setSaveState('idle')`

   ```tsx
   const persistUpdates = useCallback(
     (updates) => {
       if (debounceRef.current) clearTimeout(debounceRef.current)
       setSaveState('saving')
       debounceRef.current = setTimeout(async () => {
         const response = await window.api.mix.updateSong({
           projectId,
           songId: outgoing.id,
           updates,
         })
         if (response.success && response.data) {
           setCurrentProject(response.data)
           setSaveState('saved')
           setTimeout(() => setSaveState('idle'), 1500)
         } else {
           setSaveState('idle')
         }
       }, 500)
     },
     [projectId, outgoing.id, setCurrentProject]
   )
   ```

3. **Render indicator next to duration value**
   - Replace the duration `<Text>` in the header HStack:
     ```tsx
     <HStack gap={1}>
       <Text fontSize="xs" fontFamily="monospace" color="text.muted">
         {duration.toFixed(1)}s
       </Text>
       {saveState === 'saved' && (
         <Icon
           as={FiCheck}
           boxSize={3}
           color="green.400"
           style={{ animation: 'fadeInOut 1.5s ease' }}
         />
       )}
     </HStack>
     ```
   - Add a CSS keyframe for `fadeInOut` via Chakra's `keyframes` utility or inline style with opacity transition

### Acceptance criteria

- [ ] Checkmark appears briefly after crossfade duration or curve type is saved
- [ ] Indicator fades out after ~1.5s
- [ ] No toast popups for routine saves (only for "Suggest Mix Point")
- [ ] No indicator shown during initial mount / pair navigation sync

---

## Phase 3 — Actionable Tempo Sync (9b + Beat-Sync Phase A)

**Goal:** Make the "Slow down Track B by X%" suggestion actionable with Apply/Reset buttons, and persist the adjustment.

### Data model additions

| File                                | Change                                             |
| ----------------------------------- | -------------------------------------------------- |
| `src/shared/types/project.types.ts` | Add `tempoAdjustment?: number` to `Song` interface |

Add after existing BPM fields:

```typescript
interface Song {
  // ... existing fields ...
  /** Playback rate multiplier for tempo matching (e.g. 1.015 = +1.5%). undefined = no adjustment */
  tempoAdjustment?: number
}
```

### Changes to existing files

| File                                                               | Change                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/TempoSyncIndicator.tsx` | Add Apply/Reset buttons, accept callbacks                     |
| `src/renderer/components/features/mix-prep/ComparisonStrip.tsx`    | Pass new props through to TempoSyncIndicator                  |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`   | Wire up tempo sync handlers, pass dualDeck to ComparisonStrip |

### Step-by-step

#### 3a. Update TempoSyncIndicator props

```tsx
interface TempoSyncIndicatorProps {
  outBpm?: number
  inBpm?: number
  tempoAdjustment?: number // NEW: current adjustment on incoming track
  onApplySync?: (rate: number) => void // NEW: callback to apply tempo match
  onResetSync?: () => void // NEW: callback to reset to original
}
```

#### 3b. Add Apply/Reset buttons to TempoSyncIndicator

After the suggestion text (line 161–165 in current file), add:

```tsx
{
  absDelta > 1 && (
    <HStack justify="center" gap={1} mt={1}>
      {!tempoAdjustment ? (
        <Button
          size="2xs"
          variant="outline"
          colorPalette="green"
          onClick={() => {
            // Rate to make incoming match outgoing: outBpm / inBpm
            const rate = outBpm! / inBpm!
            onApplySync?.(rate)
          }}
        >
          <Icon as={FiCheck} boxSize={3} />
          Apply Sync
        </Button>
      ) : (
        <>
          <Badge colorPalette="green" variant="subtle" fontSize="2xs">
            <Icon as={FiCheck} boxSize={3} />
            Synced ({((tempoAdjustment - 1) * 100).toFixed(1)}%)
          </Badge>
          <Button
            size="2xs"
            variant="ghost"
            colorPalette="red"
            onClick={onResetSync}
          >
            Reset
          </Button>
        </>
      )}
    </HStack>
  )
}
```

When `tempoAdjustment` is active, update the suggestion text to show "Synced" instead of the adjustment suggestion.

#### 3c. Update ComparisonStrip to pass through

```tsx
interface ComparisonStripProps {
  outgoing: Song
  incoming: Song
  tempoAdjustment?: number // NEW
  onApplySync?: (rate: number) => void // NEW
  onResetSync?: () => void // NEW
}

// Pass to TempoSyncIndicator:
;<TempoSyncIndicator
  outBpm={outgoing.bpm}
  inBpm={incoming.bpm}
  tempoAdjustment={tempoAdjustment}
  onApplySync={onApplySync}
  onResetSync={onResetSync}
/>
```

#### 3d. Wire up in TransitionDetail

```tsx
// Inside TransitionDetail, after dualDeck initialization:

const handleApplySync = useCallback(async (rate: number) => {
  // 1. Apply to live playback
  dualDeck.setPlaybackRate('B', rate)

  // 2. Persist to song model
  if (!incomingTrack) return
  const response = await window.api.mix.updateSong({
    projectId,
    songId: incomingTrack.id,
    updates: { tempoAdjustment: rate },
  })
  if (response.success && response.data) {
    setCurrentProject(response.data)
  }
}, [dualDeck, incomingTrack, projectId, setCurrentProject])

const handleResetSync = useCallback(async () => {
  dualDeck.setPlaybackRate('B', 1.0)

  if (!incomingTrack) return
  const response = await window.api.mix.updateSong({
    projectId,
    songId: incomingTrack.id,
    updates: { tempoAdjustment: undefined },
  })
  if (response.success && response.data) {
    setCurrentProject(response.data)
  }
}, [dualDeck, incomingTrack, projectId, setCurrentProject])

// In JSX, update ComparisonStrip:
<ComparisonStrip
  outgoing={outgoing.song}
  incoming={incoming.song}
  tempoAdjustment={incomingTrack?.tempoAdjustment}
  onApplySync={handleApplySync}
  onResetSync={handleResetSync}
/>
```

#### 3e. Restore tempo adjustment on pair navigation

In `useDualDeck` or in `TransitionDetail`, when pair changes and decks reload:

```tsx
// In TransitionDetail, add effect to restore persisted tempo:
useEffect(() => {
  if (incomingTrack?.tempoAdjustment) {
    dualDeck.setPlaybackRate('B', incomingTrack.tempoAdjustment)
  } else {
    dualDeck.setPlaybackRate('B', 1.0)
  }
}, [incomingTrack?.id, incomingTrack?.tempoAdjustment, dualDeck])
```

### Acceptance criteria

- [ ] "Apply Sync" button appears when BPM delta > 1
- [ ] Clicking Apply sets playback rate on Deck B and persists `tempoAdjustment` to Song
- [ ] "Synced" badge replaces the Apply button when adjustment is active
- [ ] "Reset" button reverts to original BPM (rate 1.0) and clears `tempoAdjustment`
- [ ] Tempo adjustment survives pair navigation (restored from persisted value)
- [ ] Suggestion text hidden when synced, shown when not synced

---

## Phase 4 — Layout Density Improvements (9c)

**Goal:** Reduce vertical space between waveforms so both are visible without scrolling on smaller windows.

### Changes to existing files

| File                                                                       | Change                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`           | Move "Suggest Mix Point" into crossfade control, adjust layout |
| `src/renderer/components/features/mix-prep/TransitionCrossfadeControl.tsx` | Accept and render suggest button internally                    |
| `src/renderer/components/features/mix-prep/ComparisonStrip.tsx`            | Tighten padding, ensure single-row layout                      |

### Step-by-step

#### 4a. Move "Suggest Mix Point" into crossfade control

Currently in `TransitionDetail.tsx` (lines 188–201), the suggest button is a standalone `<HStack>`. Move it into `TransitionCrossfadeControl` as an icon button next to the header.

**TransitionCrossfadeControl** — add props:

```tsx
interface TransitionCrossfadeControlProps {
  outgoing: Song
  incoming: Song
  projectId: string
  onSuggestMixPoint?: () => void // NEW
  isSuggesting?: boolean // NEW
  canSuggest?: boolean // NEW
}
```

In the header HStack, add the suggest button:

```tsx
<HStack justify="space-between">
  <VStack gap={0} align="start">
    <Text fontSize="xs" fontWeight="semibold" color="text.primary">
      Crossfade
    </Text>
    <Text fontSize="2xs" color="text.muted">
      How long the outgoing and incoming tracks overlap
    </Text>
  </VStack>
  <HStack gap={1}>
    <Text fontSize="xs" fontFamily="monospace" color="text.muted">
      {duration.toFixed(1)}s
    </Text>
    {/* Save indicator from Phase 2 */}
    {onSuggestMixPoint && (
      <Button
        size="2xs"
        variant="ghost"
        colorPalette="blue"
        onClick={onSuggestMixPoint}
        disabled={!canSuggest || isSuggesting}
        loading={isSuggesting}
        title="Suggest optimal crossfade duration based on energy analysis"
      >
        <Icon as={FiZap} boxSize={3} />
      </Button>
    )}
  </HStack>
</HStack>
```

**TransitionDetail** — remove the standalone suggest button `<HStack>` (lines 188–201) and pass props:

```tsx
<TransitionCrossfadeControl
  outgoing={outgoing.song}
  incoming={incoming.song}
  projectId={projectId}
  onSuggestMixPoint={handleSuggestMixPoint}
  isSuggesting={isSuggesting}
  canSuggest={!!outgoing.peaks && !!incoming.peaks}
/>
```

#### 4b. Tighten ComparisonStrip padding

Reduce padding from `px={4} py={2}` to `px={3} py={1}`:

```tsx
<Box bg="bg.surface" borderWidth="1px" borderColor="border.base"
  borderRadius="md" px={3} py={1}>
```

#### 4c. Reduce vertical gaps in the middle section

In `TransitionDetail.tsx`, the middle `<VStack my={2} gap={1}>` can be tightened:

```tsx
<VStack my={1} gap={1} align="stretch">
```

### Acceptance criteria

- [ ] "Suggest Mix Point" appears as a small icon button (FiZap) in the crossfade control header
- [ ] No standalone button row between crossfade and dual-deck controls
- [ ] ComparisonStrip is more compact (less vertical padding)
- [ ] Both waveforms visible without scrolling on a 768px-tall window
- [ ] All functionality preserved (suggest still works, toast still shows)

---

## Phase 5 — Mix Health Dashboard

**Goal:** Add a bird's-eye view of the entire mix quality: transition scores, energy flow, key journey, format report.

### New files

| File                                                                | Purpose                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/renderer/components/features/mix-prep/MixHealthDashboard.tsx`  | Main dashboard component with collapsible sections     |
| `src/renderer/components/features/mix-prep/TransitionScoreList.tsx` | List of all transitions with green/yellow/red scores   |
| `src/renderer/components/features/mix-prep/EnergyFlowGraph.tsx`     | Full-mix energy curve canvas                           |
| `src/renderer/components/features/mix-prep/KeyJourneyStrip.tsx`     | Camelot key path visualization                         |
| `src/renderer/components/features/mix-prep/hooks/useMixHealth.ts`   | Hook computing aggregate health metrics from song list |

### Changes to existing files

| File                                                                   | Change                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/renderer/components/features/mix-prep/MixPrepView.tsx`            | Add dashboard toggle button, render MixHealthDashboard when active |
| `src/renderer/components/features/mix-prep/hooks/usePairNavigation.ts` | Export `goToIndex(index)` for dashboard click-to-navigate          |

### Step-by-step

#### 5a. Health computation hook — `useMixHealth.ts`

```tsx
interface TransitionScore {
  index: number // Pair index (0-based)
  outgoing: Song
  incoming: Song
  bpmDelta: number
  bpmScore: number // 0–1 (1 = perfect match)
  keyCompatible: boolean | null
  keyLabel: string // From getCompatibilityLabel
  keyScore: number // 0–1
  bitrateScore: number // 0–1
  overallScore: number // Weighted composite 0–1
  grade: 'good' | 'warning' | 'poor'
}

interface MixHealth {
  totalDuration: number // Sum of effective durations
  trackCount: number
  transitions: TransitionScore[]
  overallScore: number // Average of transition scores
  overallGrade: 'good' | 'warning' | 'poor'
  issues: string[] // Human-readable issue list
  keyPath: string[] // Array of Camelot codes through the mix
  energyCurve: number[] // Concatenated normalized energy per track
}

export function useMixHealth(songs: Song[]): MixHealth
```

**Scoring logic:**

- **BPM score**: `1 - clamp(absDelta / 5, 0, 1)` — 0 delta = 1.0, ≥5 delta = 0.0
- **Key score**: compatible = 1.0, incompatible = 0.3, unknown = 0.5
- **Bitrate score**: same format & <64k difference = 1.0, format mismatch or >64k = 0.5
- **Overall**: `bpmScore * 0.4 + keyScore * 0.35 + bitrateScore * 0.25`
- **Grade**: ≥0.7 good, ≥0.4 warning, <0.4 poor

#### 5b. TransitionScoreList component

Renders a compact list of all transitions with color-coded scores:

```
┌─ Transitions ────────────────────────────────┐
│  1→2  128→128 ✓  8A→8A ✓  320k→320k  ● 9/10 │
│  2→3  128→126 ⚠  8A→11B ✓ 320k→256k  ● 7/10 │
│  3→4  126→130 ✗  11B→3A ✗ 256k→320k  ● 3/10 │
└──────────────────────────────────────────────┘
```

Each row is clickable — calls `pairNav.goToIndex(transitionIndex + 1)` to navigate to that pair.

Props:

```tsx
interface TransitionScoreListProps {
  transitions: TransitionScore[]
  onNavigate: (songIndex: number) => void // Navigate to pair
}
```

#### 5c. EnergyFlowGraph component

Canvas-based full-mix energy visualization:

- Concatenate each track's `energyProfile` (scaled by effective duration ratio)
- Draw a filled area chart with gradient (low=blue, high=orange)
- Vertical dashed lines at track boundaries
- Track labels at top

Props:

```tsx
interface EnergyFlowGraphProps {
  songs: Song[]
  width: number
  height: number // ~80px
}
```

Implementation approach:

- Use `ResizeObserver` for responsive width (same pattern as `TransitionWaveformPanel`)
- Canvas 2D rendering with `requestAnimationFrame` (not needed for static) — just render on mount and prop change
- If a song has no `energyProfile`, show a flat line at 0.5 for that segment

#### 5d. KeyJourneyStrip component

Horizontal strip showing the key path through the mix:

```
8A → 8A → 11B → 3A → 7B
 ✓     ✓     ✗     ⚠
```

Props:

```tsx
interface KeyJourneyStripProps {
  songs: Song[]
}
```

Implementation:

- Map songs to their `musicalKey` values
- Between each pair, check compatibility via `getCompatibilityLabel()`
- Render as a horizontal `<HStack>` with key badges and arrow connectors
- Color connectors: green (compatible), orange (incompatible), gray (unknown)

#### 5e. MixHealthDashboard component

Container that assembles all sub-components:

```tsx
interface MixHealthDashboardProps {
  songs: Song[]
  onNavigateToPair: (songIndex: number) => void
}
```

Layout:

```
┌─ Mix Health ──────────────────────────────────┐
│ Duration: 1:23:45 │ 7 tracks │ Score: 8.2/10 │
│                                                │
│ ┌─ Energy Flow ──────────────────────────────┐ │
│ │ ╱╲╱╲___╱╲╲╱╲___╱╲  (canvas)              │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ Key Journey ──────────────────────────────┐ │
│ │ 8A → 8A → 11B → 3A → 7B                   │ │
│ │  ✓     ✓     ✗     ⚠                       │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌─ Transitions ──────────────────────────────┐ │
│ │ (clickable rows)                            │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Issues:                                        │
│  ⚠ 1 key clash (transition 3→4)              │
│  ⚠ 1 bitrate drop (transition 2→3)           │
└────────────────────────────────────────────────┘
```

#### 5f. Integrate into MixPrepView

Add a toggle button and conditional rendering:

```tsx
// In MixPrepView, add state:
const [showDashboard, setShowDashboard] = useState(false)

// In MixPrepView layout, add toggle in the header/toolbar area:
<Button size="2xs" variant={showDashboard ? 'solid' : 'outline'}
  colorPalette="teal" onClick={() => setShowDashboard(prev => !prev)}>
  <Icon as={FiActivity} boxSize={3} />
  Mix Health
</Button>

// Conditional rendering:
// When dashboard is shown, replace the right panel content:
{showDashboard ? (
  <MixHealthDashboard
    songs={songs}
    onNavigateToPair={(idx) => {
      pairNav.goToIndex(idx)
      setShowDashboard(false)  // Switch back to transition view
    }}
  />
) : (
  <TransitionDetail ... />
)}
```

#### 5g. Add `goToIndex` to usePairNavigation

Currently the hook exposes `goPrev`/`goNext`. Add:

```tsx
const goToIndex = useCallback(
  (index: number) => {
    if (index >= 0 && index < songs.length) {
      setSelectedIndex(index)
    }
  },
  [songs.length]
)

return { ...existing, goToIndex }
```

### Acceptance criteria

- [ ] "Mix Health" button in MixPrepView toggles dashboard view
- [ ] Dashboard shows total duration, track count, overall score
- [ ] Energy flow graph renders concatenated energy profiles for all tracks
- [ ] Key journey strip shows Camelot key path with compatibility indicators
- [ ] Transition list shows per-pair scores with BPM/key/bitrate breakdown
- [ ] Clicking a transition row navigates to that pair and closes the dashboard
- [ ] Issues section lists specific problems (key clashes, bitrate drops, large BPM jumps)
- [ ] Dashboard handles edge cases: 0 songs, 1 song, missing BPM/key data

---

## Execution Order & Dependencies

```
Phase 1 (9a: Crossfade clarity)
  └─ Phase 2 (9d: Save feedback) ← modifies same file, do sequentially
      └─ Phase 4 (9c: Layout density) ← moves suggest button into crossfade control

Phase 3 (9b + Beat-Sync Phase A) ← independent, can parallelize with Phase 1–2
  └─ requires Song type update first (tempoAdjustment field)

Phase 5 (Mix Health Dashboard) ← independent of Phases 1–4
  └─ can start after Phase 3 (uses same Song type update)
```

**Suggested order:**

1. Phase 3 first (Song type change is a prerequisite for other phases to be aware of)
2. Phase 1 → Phase 2 → Phase 4 sequentially (all modify TransitionCrossfadeControl)
3. Phase 5 can be done in parallel with Phases 1–4 or after

**Estimated total:** ~5 phases, each 1 session of focused work.

---

## Files touched summary

| File                                                                         | Phases  |
| ---------------------------------------------------------------------------- | ------- |
| `src/shared/types/project.types.ts`                                          | 3       |
| `src/renderer/components/features/mix-prep/TransitionCrossfadeControl.tsx`   | 1, 2, 4 |
| `src/renderer/components/features/mix-prep/TempoSyncIndicator.tsx`           | 3       |
| `src/renderer/components/features/mix-prep/ComparisonStrip.tsx`              | 3, 4    |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`             | 3, 4    |
| `src/renderer/components/features/mix-prep/MixPrepView.tsx`                  | 5       |
| `src/renderer/components/features/mix-prep/hooks/usePairNavigation.ts`       | 5       |
| **New:** `src/renderer/components/features/mix-prep/MixHealthDashboard.tsx`  | 5       |
| **New:** `src/renderer/components/features/mix-prep/TransitionScoreList.tsx` | 5       |
| **New:** `src/renderer/components/features/mix-prep/EnergyFlowGraph.tsx`     | 5       |
| **New:** `src/renderer/components/features/mix-prep/KeyJourneyStrip.tsx`     | 5       |
| **New:** `src/renderer/components/features/mix-prep/hooks/useMixHealth.ts`   | 5       |

---

## Risk notes

- **Chakra v3 Slider API**: Verify exact compound component syntax — Chakra v3 uses `Slider.Root`/`Slider.Track`/`Slider.Thumb` pattern (not Chakra v2's `<Slider>` with children)
- **CrossfadeCurveCanvas at small sizes**: Test that 120×40px renders legibly with DPR scaling. May need to adjust line width or remove fill at small sizes
- **Energy profile availability**: Some songs may not have `energyProfile` populated. Mix Health Dashboard must handle nulls gracefully (show "?" or flat line)
- **Tempo adjustment precision**: `outBpm / inBpm` can produce irrational numbers. Round to 4 decimal places for storage, display as percentage with 1 decimal
