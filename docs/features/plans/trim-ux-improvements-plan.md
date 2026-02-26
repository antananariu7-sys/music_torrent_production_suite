# Trim Point UX Improvements Plan

**Date:** 2026-02-26
**Status:** Done

---

## Context

In the mix-prep transition view, trim overlays are read-only and lack context about which track edge matters for the transition. Users must switch to the Timeline tab to adjust trims and can't tell which trim edges define the crossfade window. This plan adds:

- **Change C (mix-prep):** Inline draggable trim handle on only the relevant edge per waveform
- **Change A (timeline):** "Entry"/"Exit" text labels at trim handles

---

## Change A — Timeline Labels

### Files modified

- `src/renderer/components/features/timeline/TrimOverlay.tsx`
- `src/renderer/components/features/timeline/TimelineLayout.tsx`

### TrimOverlay.tsx

Add `trackIndex` and `trackCount` props. After each TrimHandle, render a small label:

- **Trim-start handle** → "◀ Entry" label (green `#22c55e`), shown when `trackIndex > 0`
- **Trim-end handle** → "Exit ▶" label (red `#ef4444`), shown when `trackIndex < trackCount - 1`

Labels positioned at `top="-18px"` with `pointerEvents="none"`, matching CuePointMarker flag style. Entry label extends right from handle, Exit label extends left (`translateX(-100%)`).

### TimelineLayout.tsx

Pass `trackIndex={index}` and `trackCount={songs.length}` to each `<TrimOverlay>`.

---

## Change C — Mix-Prep Inline Trim Handles

### Files modified

- `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx`
- `src/renderer/components/features/mix-prep/TransitionDetail.tsx`

### TransitionWaveformPanel.tsx — new props

```typescript
trimHandleSide?: 'start' | 'end'  // Which handle to show
onTrimDrag?: (newTimestamp: number) => void
onTrimDragEnd?: () => void
```

When `trimHandleSide` is set:

1. Import `TrimHandle` from `../timeline/TrimHandle`
2. Compute `pixelsPerSecond = (containerWidth - 8) / duration`
3. Compute handle X position from `song.trimEnd` (for 'end') or `song.trimStart` (for 'start')
4. Use a ref to capture initial trim value at drag start (same pattern as TrimOverlay)
5. On drag: clamp to [trimStart + 1s, duration] for end handle, [0, trimEnd - 1s] for start handle, call `onTrimDrag`
6. Render the TrimHandle + a positioned label inside the waveform area (`top="2px"`)
   - "Exit ▶" (red) for trim-end, positioned left of handle
   - "◀ Entry" (green) for trim-start, positioned right of handle
   - Semi-transparent bg for readability: `bg="blackAlpha.600" px={1} borderRadius="sm"`

### TransitionDetail.tsx — wire callbacks

1. Import and call `useTrimDrag()` from timeline hooks (already exists, reusable)
2. Create preview-merged song objects for both panels:
   ```tsx
   const outgoingSong = useMemo(() => {
     const preview = previewTrims[outgoing.song.id]
     return preview ? { ...outgoing.song, ...preview } : outgoing.song
   }, [outgoing.song, previewTrims])
   ```
3. Pass to TransitionWaveformPanel:
   - Outgoing panel: `trimHandleSide="end"`, `onTrimDrag` → `handleTrimEndDrag(songId, ts)`, `onTrimDragEnd` → `handleTrimDragEnd(songId)`
   - Incoming panel: `trimHandleSide="start"`, `onTrimDrag` → `handleTrimStartDrag(songId, ts)`, `onTrimDragEnd` → `handleTrimDragEnd(songId)`

---

## Implementation order

1. Change A: TrimOverlay labels + TimelineLayout props (isolated, quick)
2. Change C: TransitionWaveformPanel handles + TransitionDetail wiring

## Verification

- Timeline: labels appear at correct handles; first track skips Entry, last track skips Exit
- Mix-prep: drag outgoing trim-end handle → dimming overlay updates live → persists on release
- Mix-prep: drag incoming trim-start handle → same behavior
- 1-second minimum gap enforced between trimStart and trimEnd
- Build passes (`yarn build`), tests pass (`yarn test:main`)

## Files touched summary

| File                                                                    | Change                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/renderer/components/features/timeline/TrimOverlay.tsx`             | Add trackIndex/trackCount props, render Entry/Exit labels    |
| `src/renderer/components/features/timeline/TimelineLayout.tsx`          | Pass trackIndex and trackCount to TrimOverlay                |
| `src/renderer/components/features/mix-prep/TransitionWaveformPanel.tsx` | Add draggable trim handle + label for relevant edge          |
| `src/renderer/components/features/mix-prep/TransitionDetail.tsx`        | Wire useTrimDrag hook, pass preview-merged songs + callbacks |
