# Search Results Table — Implementation Plan

**Date:** 2026-02-24
**Status:** Done (2026-02-24)
**Feature spec:** [docs/features/done/search-results-table.md](../search-results-table.md)
**Note:** Page size ConfigService persistence (Phase 5) deferred as minor follow-up.

---

## Decisions from Architecture Review

| Question                                   | Decision                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| Date column (`uploadDate` not scraped)     | **Drop from v1** — add when scraping is implemented                             |
| "Category" column naming                   | **Rename to "Format"** — matches `format` field on SearchResult                 |
| "Discography" group inside Discography tab | **Rename to content-based labels** — skip "Discography" group name in disco tab |
| "Load more results" IPC                    | **Include in plan** — new IPC channel for on-demand page fetching               |

**Columns (final for v1):**

| Album tab            | Discography tab      |
| -------------------- | -------------------- |
| Title (sortable)     | Title (sortable)     |
| Size (sortable)      | Size (sortable)      |
| S/L (sortable)       | S/L (sortable)       |
| Relevance (sortable) | Relevance (sortable) |
| Format               | Match                |
| Actions              | Actions              |

---

## Phase 1 — Table Foundation + Actions

**Goal:** Replace card-based `TorrentItem` list with a data-dense table. Wire up action buttons.

### New files

| File                                                             | Purpose                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/renderer/components/features/search/SearchResultsTable.tsx` | Root table component — renders `<Table.Root>` with header and rows |
| `src/renderer/components/features/search/SearchResultsRow.tsx`   | Single table row — renders columns + action icon buttons           |

### Changes to existing files

| File                                                              | Change                                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/components/features/search/InlineSearchResults.tsx` | Replace the `VStack` / `GroupedTorrentList` / flat `TorrentItem` list in the `torrents` step with `<SearchResultsTable>` |

### Column rendering

- **Title**: 1-line truncated (`lineClamp={1}`), full text in `title` attribute (native tooltip)
- **Size**: Format `sizeBytes` → GB/MB via shared util; fallback to raw `size` string
- **S/L**: `{seeders}↑ / {leechers}↓`, seeders in `green.400`, leechers in `text.muted`
- **Relevance**: `{relevanceScore}%` badge; color gradient (green >70, yellow 40-70, red <40)
- **Format**: Colored badge reusing existing format rendering logic (green=FLAC/ALAC/APE, blue=MP3, purple=WAV)
- **Actions**: 3 icon buttons — `FiExternalLink` (open page via `search:open-url`), `FiChevronDown` (expand row — wired in Phase 4), `FiDownload` (existing collect workflow)

### Key decisions

- Use Chakra UI `Table` component (not a third-party data grid — consistent with design system)
- Table uses `size="sm"` and fixed column widths for data density
- Row hover effect via `_hover={{ bg: 'bg.elevated' }}`
- No sorting, grouping, or pagination in this phase — flat list, all results visible

### Acceptance criteria

- [ ] Results display as a table with all 6 columns
- [ ] Open page button calls `search:open-url` IPC
- [ ] Download button triggers existing collect workflow
- [ ] Preview button present but non-functional (wired in Phase 4)
- [ ] Table scrollable with `maxH` container (matching current `500px` constraint)

---

## Phase 2 — Sorting + Grouped Section Headers

**Goal:** Add sortable column headers and collapsible category group headers within the table.

### New files

| File                                                                   | Purpose                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/search/hooks/useSearchTableState.ts` | Hook managing sort column, sort direction, collapsed groups. Per-instance state (will be per-tab in Phase 3). |
| `src/shared/utils/flacImageDetector.ts`                                | `isFlacImage(result): boolean` — FLAC image detection heuristics                                              |

### Changes to existing files

| File                     | Change                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchResultsTable.tsx` | Add sortable column headers (click handler cycling asc → desc → default). Add group section header rows. Pass sort/group state from hook. |
| `SearchResultsRow.tsx`   | No changes                                                                                                                                |

### Sorting logic (inside hook)

1. Group results using existing `classifyResult()` from `resultClassifier.ts`
2. Fixed group order: Studio → Live → Compilations → Other (Discography group handled in Phase 3)
3. Within each group, sort by active column + direction
4. **FLAC image deprioritization**: Within each group, FLAC images always sort to the bottom regardless of active sort column. Implementation: stable sort with `isFlacImage` as primary boolean key (false < true), then active sort column as secondary.
5. Default sort: Relevance descending
6. Three-click cycle: click 1 = asc, click 2 = desc, click 3 = reset to default (relevance desc)
7. Active sort column shows `▲`/`▼` indicator in header

### Grouped section headers

- Rendered as full-width `Table.Row` spanning all columns
- Shows: chevron icon + group label + count: `▼ Studio Albums (12)`
- Click to collapse/expand group
- Groups with 0 results hidden entirely
- When total results < 5, no grouping applied (flat table)

### FLAC image detection (`flacImageDetector.ts`)

Heuristics from spec — applied to `title` + `format`:

- Title contains: "image", "img", "cue", "образ", "ape+cue", "flac+cue"
- Single file >500MB for a single album (check `sizeBytes` + heuristic on track count if metadata available)

### Acceptance criteria

- [ ] Clicking column header sorts within groups
- [ ] Three-click sort cycle works (asc → desc → reset)
- [ ] Active sort column shows direction arrow
- [ ] Collapsible group section headers with counts
- [ ] Groups with 0 results hidden
- [ ] Flat table when <5 results total
- [ ] FLAC images sorted to bottom within each group

---

## Phase 3 — Tabs (Album / Discography Split)

**Goal:** Split results into Album and Discography tabs with independent state.

### New files

| File                                                            | Purpose                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/renderer/components/features/search/SearchResultsTabs.tsx` | Tab container with `Tabs.Root` — renders two `SearchResultsTable` instances with independent state |

### Changes to existing files

| File                      | Change                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `InlineSearchResults.tsx` | Replace `SearchResultsTable` with `SearchResultsTabs` in the `torrents` step                                              |
| `useSearchTableState.ts`  | No structural changes — each tab creates its own hook instance                                                            |
| `SearchResultsTable.tsx`  | Accept `tabType: 'album' \| 'discography'` prop; conditionally render Format column (album) or Match column (discography) |

### Tab behavior

- Split `ruTrackerResults` by `searchSource` field: `'album'` → Album tab, `'discography'` → Discography tab
- Tab labels: `Album Results (N)` / `Discography Results (N)` with counts
- Default active tab: Album if any album results exist, otherwise Discography
- Each tab has its own `useSearchTableState` instance → independent sort, collapse, filter (Phase 5), pagination (Phase 5)
- Tab state preserved when switching (React keeps both mounted, hidden via CSS or conditional render with state lifted)
- Empty tab shows "No direct album results" / "No discography results" message

### Discography tab: group label renaming

In the Discography tab, rename content-based groups to avoid "Discography" redundancy:

- `studio` → "Studio Releases"
- `live` → "Live Recordings"
- `compilation` → "Compilations"
- `discography` → **"Collections"** (catch-all for discography-type content within discography results)
- `other` → "Other"

Album tab keeps existing labels: "Studio Albums", "Live / Concerts", "Compilations", "Discography", "Other".

### Match column (Discography tab only)

- Replaces the Format column position
- Shows green `✅ {albumName}` badge if scan found a match, truncated with tooltip
- Shows `—` if no match or scan not yet run
- Match data sourced from existing `discographyScanResults` in `smartSearchStore` + `scanResultsMap` prop
- Wire existing `PageContentScanResult` data to the Match column

### Acceptance criteria

- [ ] Two tabs with counts in labels
- [ ] Each tab has independent sort and collapse state
- [ ] Default tab is Album (or Discography if no album results)
- [ ] Switching tabs preserves state
- [ ] Empty tab shows appropriate message
- [ ] Discography tab shows Match column instead of Format
- [ ] Group labels renamed in Discography tab

---

## Phase 4 — Row Expansion

**Goal:** Click a row to expand/collapse inline track list preview.

### Changes to existing files

| File                          | Change                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SearchResultsTable.tsx`      | Track `expandedRowId` state. On row click (outside action buttons), toggle expansion. Only one row expanded at a time. |
| `SearchResultsRow.tsx`        | Accept `isExpanded` + `onToggle` props. When expanded, render a detail row below with `TorrentTrackListPreview`.       |
| `useSearchTableState.ts`      | Add `expandedRowId: string \| null` to state                                                                           |
| `TorrentTrackListPreview.tsx` | No changes — already accepts `highlightSongName` prop                                                                  |

### Expansion behavior

- Click anywhere on the row (except action buttons) → toggle expansion
- Expanding a row collapses any previously expanded row (single expansion)
- Expanded area renders as a `Table.Row` with a single cell spanning all columns
- Content: reuse `TorrentTrackListPreview` with torrent metadata fetch-on-expand pattern (existing in `TorrentItem`)
- Preview action button (`FiChevronDown`/`FiChevronUp`) also toggles expansion
- **Discography tab expanded rows**: Pass `highlightSongName` from SmartSearch classification (the classified album/song name, not raw query) to `TorrentTrackListPreview` — this enables the existing `isSongMatch` highlighting

### Metadata fetching

The existing `TorrentItem` fetches torrent page metadata on "Preview tracks" click via the torrent URL. Replicate this pattern:

- On first expansion of a row, fetch metadata if not cached
- Show `TorrentTrackListLoading` during fetch
- Show `TorrentTrackListError` on failure
- Cache metadata in local component state or a `Map<id, TorrentPageMetadata>`

### Acceptance criteria

- [ ] Click row to expand/collapse track list
- [ ] Only one row expanded at a time
- [ ] Preview action button toggles expansion
- [ ] Metadata fetched on first expansion, cached thereafter
- [ ] Loading and error states displayed
- [ ] Discography tab highlights search term in expanded track lists (via existing `highlightSongName` prop)

---

## Phase 5 — Client-Side Filter + Pagination

**Goal:** Add text filter above table and paginated navigation below.

### New files

| File                                                                  | Purpose                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/renderer/components/features/search/SearchResultsFilter.tsx`     | Text input with search icon, debounced onChange (~200ms)  |
| `src/renderer/components/features/search/SearchResultsPagination.tsx` | Page controls + page size selector + result count summary |

### Changes to existing files

| File                      | Change                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `useSearchTableState.ts`  | Add `filterText`, `currentPage`, `pageSize` to state. Add computed `filteredResults`, `paginatedResults`. |
| `SearchResultsTable.tsx`  | Render filter above table, pagination below. Consume paginated results.                                   |
| `SearchResultsRow.tsx`    | Highlight matching filter text in title cell with `bg.accent` background                                  |
| `src/shared/constants.ts` | Add `CONFIG_KEYS.SEARCH_RESULTS_PAGE_SIZE` constant                                                       |

### Filter logic

1. Filter by title substring match (case-insensitive)
2. Applied to all results before grouping and pagination
3. Debounced 200ms to avoid excessive re-renders
4. On filter change: reset to page 1, collapse expanded row
5. Empty state: "No results match '{query}'" with clear button
6. Filter text persists while results are displayed, cleared on new search

### Title highlighting

- Split title into segments at filter match boundaries
- Wrap matching segments in `<Mark>` or `<Box as="span" bg="bg.accent">`
- Case-insensitive matching, preserve original casing in display

### Pagination logic

1. Compute: `totalResults` (after filter, before pagination), `totalPages`, `startIndex`, `endIndex`
2. Pagination applies AFTER grouping — groups may be split across pages
3. Page controls: `[< 1 2 3 ... N >]` — show max 5 page numbers with ellipsis
4. Page size selector: dropdown `[20 | 50 | 100]`, default 20
5. Page size persisted via ConfigService key `search-results-page-size`
6. Summary text: `Showing 1-20 of 87 results` or `Showing 1-20 of 34 results (filtered from 87)`
7. On sort change: reset to page 1

### ConfigService integration

- Read initial page size: `api.config.get('search-results-page-size')` or default to 20
- Write on change: `api.config.set('search-results-page-size', value)`
- Check existing ConfigService API — should already support arbitrary key-value get/set

### Acceptance criteria

- [ ] Text filter filters by title with 200ms debounce
- [ ] Filter text highlighted in matching title cells
- [ ] Pagination controls below table
- [ ] Page size selector with 20/50/100 options
- [ ] Page size persisted across sessions via ConfigService
- [ ] Summary text shows counts (with filtered count when filter active)
- [ ] Page resets to 1 on filter or sort change
- [ ] Empty filter state with clear button

---

## Phase 6 — Non-Audio Exclusion + FLAC Image Badges

**Goal:** Auto-hide non-audio results, show FLAC image warning badges.

### New files

| File                                   | Purpose                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/shared/utils/nonAudioDetector.ts` | `isNonAudioResult(result): boolean` — heuristics for PDFs, videos, guitar tabs, software, karaoke |

### Changes to existing files

| File                     | Change                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `useSearchTableState.ts` | Add `showHidden: boolean` state. Filter out non-audio results from visible set (unless `showHidden` is true). Track `hiddenCount`.     |
| `SearchResultsTable.tsx` | Show `(N hidden)` in summary. Add "Show N hidden results" link at bottom. Hidden results rendered in muted/dimmed style when revealed. |
| `SearchResultsRow.tsx`   | Accept `isDimmed` prop for muted styling. Add orange `⚠ IMG` badge next to format when `isFlacImage` is true.                          |
| `flacImageDetector.ts`   | Already created in Phase 2 — no changes needed                                                                                         |

### Non-audio detection heuristics (`nonAudioDetector.ts`)

Applied to `title.toLowerCase()`:

- **PDFs**: "pdf", "книга", "учебник", "самоучитель"
- **Videos**: "video", "видео", "dvd", "blu-ray", "concert film"
- **Guitar tabs**: "tabs", "табулатур", "ноты", "gtp", "guitar pro"
- **Software**: "vst", "plugin", "software", "программ"
- **Karaoke**: "karaoke", "караоке", "минус"

### Exclusion behavior

1. Non-audio results filtered out of visible results by default
2. Hidden count shown in summary: `(5 hidden)`
3. "Show N hidden results" link at table bottom toggles `showHidden`
4. When revealed, hidden results rendered with `opacity={0.5}` and muted text
5. Hidden results do NOT count toward pagination totals (excluded before pagination)
6. If ALL results are excluded: "All results were filtered as non-audio. [Show hidden results]"

### FLAC image badge

- Orange `⚠ IMG` badge rendered next to format badge in the Format column
- Tooltip (via `title` attribute): "Single-file FLAC/APE image (CUE+FLAC). Needs splitting before adding to mix."
- Badge is informational only — no action change

### Acceptance criteria

- [ ] Non-audio results auto-hidden with count shown
- [ ] "Show hidden results" link reveals them in dimmed style
- [ ] Hidden results excluded from pagination totals
- [ ] FLAC image results show orange badge with tooltip
- [ ] All-excluded edge case shows appropriate message

---

## Phase 7 — Discography Match Enhancements

**Goal:** Polish match column badge, add match-based sort priority, enhance expanded row highlighting.

### Changes to existing files

| File                          | Change                                                                                                                                                                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useSearchTableState.ts`      | Add match-based secondary sort for discography tab: rows with matches sort above rows without (after FLAC image deprioritization)                                                                                                                   |
| `SearchResultsRow.tsx`        | Match badge: green `✅ {albumName}` truncated to ~15 chars with full text tooltip. `—` if no match.                                                                                                                                                 |
| `TorrentTrackListPreview.tsx` | Add `highlightSearchTerm?: string` prop (separate from `highlightSongName`). Highlight matching folder names with `bg.accent` background. Add left-border accent (`borderLeft="2px solid" borderLeftColor="brand.400"`) on matching albums/folders. |

### Sort priority (discography tab only)

Within each group, the sort order becomes a 3-level stable sort:

1. **FLAC image** (non-image first, image last)
2. **Match presence** (has match first, no match last) — discography tab only
3. **Active sort column** (user-selected or default relevance desc)

### Expanded row highlighting (discography tab)

- The `highlightSongName` prop (already wired from Phase 4) uses `isSongMatch` for track-level highlighting
- Additionally, matching folder/album titles get a subtle left-border accent: `borderLeft="2px solid" borderLeftColor="brand.400"`
- Highlight uses the classified album/song name from SmartSearch (available as `selectedClassification` or `selectedAlbum` from store), NOT the raw query text

### Acceptance criteria

- [ ] Match badge shows truncated album name with tooltip
- [ ] Rows with matches sorted above rows without in discography tab
- [ ] Expanding discography row highlights matching tracks with accent background
- [ ] Matching folders/albums have left-border accent
- [ ] Highlight uses classified name, not raw query

---

## Phase 8 — Load More Results

**Goal:** Add "Load more results" button to fetch additional RuTracker pages on demand.

### New files

| File                                                                | Purpose                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/renderer/components/features/search/SearchResultsLoadMore.tsx` | "Load more results" button with loading state and page estimates |

### Changes to existing files

| File                                          | Change                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/shared/constants.ts`                     | Add `SEARCH_LOAD_MORE: 'search:load-more'` IPC channel                                                                   |
| `src/shared/types/search.types.ts`            | Add `LoadMoreRequest` and `LoadMoreResponse` types                                                                       |
| `src/shared/schemas/search.schema.ts`         | Add Zod schemas for load-more types                                                                                      |
| `src/main/ipc/search-handlers.ts`             | Add `ipcMain.handle('search:load-more', ...)` handler                                                                    |
| `src/main/services/RuTrackerSearchService.ts` | Add `loadMoreResults(query, fromPage, toPage)` method — reuses existing scraping logic (navigate to page, parse results) |
| `src/preload/index.ts`                        | Add `api.search.loadMore(request)` method                                                                                |
| `src/renderer/window.d.ts`                    | Auto-derives from preload — no manual change                                                                             |
| `smartSearchStore.ts`                         | Add `appendResults(newResults)` action to merge and deduplicate incoming results                                         |
| `useSearchTableState.ts`                      | Consume appended results reactively                                                                                      |
| `SearchResultsTabs.tsx`                       | Render `SearchResultsLoadMore` below the active tab's table                                                              |

### IPC contract

```
Channel: 'search:load-more'
Request: { query: string, fromPage: number, toPage: number }
Response: { results: SearchResult[], loadedPages: number, totalPages: number, isComplete: boolean }
```

### Backend logic (`RuTrackerSearchService.loadMoreResults`)

1. Reuse existing Puppeteer session (browser should already be authenticated)
2. Navigate to search results page N, parse with `ResultParser`
3. Loop from `fromPage` to `toPage` (batch of ~10 pages)
4. Apply relevance scoring via `calculateRelevanceScores()`
5. Return results + metadata
6. Track `totalPages` (already known from initial search via `PaginationHandler`)

### UI behavior

- Button below table: `Load more results (pages 11-20 of ~45)`
- Show spinner on button while fetching
- On success: append results to store, table updates reactively
- Button hidden when `isComplete` (all pages loaded)
- Error state: show error text with retry option
- Each click fetches next batch (configurable batch size, default 10 pages)

### Store integration

- `smartSearchStore.appendResults()` merges new results by `id`, deduplicates, preserves `searchSource` tags
- Both tabs update reactively since they derive from `ruTrackerResults`
- The `totalPages` from initial progressive search should be stored for the "pages X-Y of ~Z" estimate

### Acceptance criteria

- [ ] "Load more results" button shown below table when more pages available
- [ ] Button shows estimated page range
- [ ] Clicking fetches next batch and appends to results
- [ ] Loading state on button during fetch
- [ ] Button hidden when all pages loaded
- [ ] Results properly merged and deduplicated
- [ ] Both tabs update with new results

---

## Phase 9 — Duplicate Detection (Optional)

**Goal:** Warn users before downloading content that already exists in their project audio folder. Carried over from the completed [search-refactor-plan](search-refactor-plan.md).

### New files

| File                                                                | Purpose                                                                                                                 |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/shared/utils/trackMatcher.ts`                                  | Pure functions: fuzzy string matching for track names (normalized Levenshtein or substring match with confidence score) |
| `src/main/services/DuplicateDetectionService.ts`                    | Scans project audio directory, builds file index, compares torrent track listings against existing files                |
| `src/main/ipc/duplicateHandlers.ts`                                 | IPC handlers: `duplicate:check`, `duplicate:rescan`                                                                     |
| `src/shared/types/duplicateDetection.types.ts`                      | Types: `AudioFileIndex`, `DuplicateCheckRequest`, `DuplicateCheckResponse`                                              |
| `src/renderer/components/features/search/DuplicateWarningBadge.tsx` | Inline badge on search result rows indicating potential duplicates                                                      |

### Changes to existing files

| File                      | Change                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `src/shared/constants.ts` | Add `DUPLICATE_CHECK`, `DUPLICATE_RESCAN` IPC channels         |
| `src/main/ipc/index.ts`   | Register duplicate handlers                                    |
| `src/preload/index.ts`    | Add `api.duplicate.check()`, `api.duplicate.rescan()`          |
| `SearchResultsRow.tsx`    | Show duplicate warning badge when match found                  |
| `SearchResultsTable.tsx`  | Run duplicate check after results load (debounced, background) |

### Detection approach

1. **Index project audio**: Scan `<projectDir>/assets/audio/` for audio files on project open (or on first duplicate check)
2. **Cache index**: Store as `<projectDir>/assets/.audio-index.json` — invalidate when directory mtime changes
3. **Match algorithm**: For each search result title, run fuzzy match against indexed file names
   - Normalize both: lowercase, strip extensions, strip common prefixes ("01.", "01 -")
   - Score: Levenshtein-based similarity, threshold ≥ 85% for "likely duplicate"
4. **Display**: Orange `⚠ DUP` badge on matching rows with tooltip listing matched files
5. **Non-blocking**: Check runs in background after results render, badges appear as matches are found

### Acceptance criteria

- [ ] Project audio directory scanned and indexed
- [ ] Index cached to disk, invalidated on directory changes
- [ ] Search results checked against index after loading
- [ ] Duplicate badge shown on matching rows with tooltip
- [ ] "Rescan" button available in settings or inline
- [ ] False positives acceptable — badge is informational only (user can still download)

---

## Component Dependency Graph

```
InlineSearchResults
  └── SearchResultsTabs              (Phase 3)
        ├── SearchResultsFilter      (Phase 5)
        ├── SearchResultsTable       (Phase 1)
        │     ├── GroupSectionHeader  (Phase 2, inline)
        │     └── SearchResultsRow   (Phase 1)
        │           └── TorrentTrackListPreview  (Phase 4, expanded)
        ├── SearchResultsPagination  (Phase 5)
        └── SearchResultsLoadMore    (Phase 8)
```

## State Architecture

```
useSearchTableState (one instance per tab)
  ├── sortColumn: SortBy          (Phase 2)
  ├── sortDirection: SortOrder    (Phase 2)
  ├── collapsedGroups: Set        (Phase 2)
  ├── expandedRowId: string|null  (Phase 4)
  ├── filterText: string          (Phase 5)
  ├── currentPage: number         (Phase 5)
  ├── pageSize: number            (Phase 5)
  └── showHidden: boolean         (Phase 6)

Derived (computed in hook):
  ├── filteredResults       (filter + non-audio exclusion)
  ├── groupedResults        (classify + sort within groups)
  ├── paginatedResults      (slice for current page)
  ├── hiddenCount           (non-audio excluded count)
  └── totalResults          (count after filter, before pagination)
```

## Files Created / Modified per Phase

| Phase | New files                                                                                                                             | Modified files                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `SearchResultsTable.tsx`, `SearchResultsRow.tsx`                                                                                      | `InlineSearchResults.tsx`                                                                                                                                                 |
| 2     | `useSearchTableState.ts`, `flacImageDetector.ts`                                                                                      | `SearchResultsTable.tsx`                                                                                                                                                  |
| 3     | `SearchResultsTabs.tsx`                                                                                                               | `InlineSearchResults.tsx`, `SearchResultsTable.tsx`                                                                                                                       |
| 4     | —                                                                                                                                     | `SearchResultsTable.tsx`, `SearchResultsRow.tsx`, `useSearchTableState.ts`                                                                                                |
| 5     | `SearchResultsFilter.tsx`, `SearchResultsPagination.tsx`                                                                              | `useSearchTableState.ts`, `SearchResultsTable.tsx`, `SearchResultsRow.tsx`, `constants.ts`                                                                                |
| 6     | `nonAudioDetector.ts`                                                                                                                 | `useSearchTableState.ts`, `SearchResultsTable.tsx`, `SearchResultsRow.tsx`                                                                                                |
| 7     | —                                                                                                                                     | `useSearchTableState.ts`, `SearchResultsRow.tsx`, `TorrentTrackListPreview.tsx`                                                                                           |
| 8     | `SearchResultsLoadMore.tsx`                                                                                                           | `constants.ts`, `search.types.ts`, `search.schema.ts`, `search-handlers`, `RuTrackerSearchService.ts`, `preload/index.ts`, `smartSearchStore.ts`, `SearchResultsTabs.tsx` |
| 9     | `trackMatcher.ts`, `DuplicateDetectionService.ts`, `duplicateHandlers.ts`, `duplicateDetection.types.ts`, `DuplicateWarningBadge.tsx` | `constants.ts`, `ipc/index.ts`, `preload/index.ts`, `SearchResultsRow.tsx`, `SearchResultsTable.tsx`                                                                      |

## Testing Strategy

- **Utility functions** (phases 2, 6, 9): Unit tests for `flacImageDetector`, `nonAudioDetector`, `trackMatcher`, sorting logic — `.spec.ts` files alongside source
- **Hook** (phases 2-7): Unit tests for `useSearchTableState` — sort, filter, pagination, exclusion logic
- **IPC** (phases 8, 9): Unit tests for `loadMoreResults` and `DuplicateDetectionService` with mocked dependencies
- **UI components**: No UI tests per project convention — verify manually through the SmartSearch workflow

## Risk Notes

- **Performance**: With 500+ results across both tabs, ensure table rendering stays smooth. Memoize rows, use `React.memo` on `SearchResultsRow`. If needed, add virtualization in a follow-up (out of scope for v1).
- **FLAC image false positives**: Heuristics may flag legitimate results. Badge is informational only — acceptable tradeoff.
- **Puppeteer session reuse (Phase 8)**: "Load more" needs the same authenticated session. If session expired between initial search and load-more click, need graceful error handling + potential re-auth.
