# Feature: Search Results Table Overhaul

## Overview

Replace the current card-based grouped torrent results list with a data-dense, sortable table layout. Separate album and discography results into distinct tabs. Add client-side text filtering with match highlighting, paginated results, authenticated page links, relevance scoring column, non-audio result exclusion, FLAC image warnings, and search term highlighting in discography track lists.

## User Problem

When searching for music on RuTracker, results can be numerous and hard to scan. The current card layout wastes space and lacks sorting, filtering, and pagination. Non-relevant results (PDFs, videos, guitar tabs) add noise. FLAC image rips (CUE+FLAC) look identical to track-based FLAC releases but require extra splitting work. Album-specific results and discography results are currently mixed together, making it hard to find what you need. When browsing discography results, it's unclear which albums inside match the original search term.

## User Stories

- As a DJ, I want to sort search results by seeders so that I download the fastest available option
- As a producer, I want to filter results by typing a keyword so that I quickly find the specific release I need
- As a user, I want non-audio results (PDFs, videos, tabs) hidden automatically so that I only see relevant music
- As a user, I want to open the RuTracker page for a torrent in an authenticated session so that I can read comments and details
- As a user, I want FLAC image rips clearly marked so that I know they need splitting before use
- As a user, I want paginated results with configurable page size so that large result sets don't overwhelm the UI
- As a user, I want album and discography results in separate tabs so that I can focus on what's relevant
- As a user, I want the search term highlighted in discography track lists so that I can quickly spot matching albums inside large discography torrents

## Proposed UX Flow

### Entry Point

No change — results appear in the same location within the SmartSearch workflow (step 3: torrent selection). The change is in how results are displayed.

### Layout: Tabbed Tables (Album / Discography)

Results are split into two tabs based on the `searchSource` field on each `SearchResult`:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Album Results (12)]  [Discography Results (45)]                │
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Filter results...]           Showing 1-20 of 12 (3 hidden) │
│                                   Per page: [20 ▾]              │
├─────────────────────────────────────────────────────────────────┤
│ Title▾          │ Size │ S/L  │ Rel  │ Date │ Cat  │ Actions   │
├─────────────────────────────────────────────────────────────────┤
│ ▼ Studio (3)                                                    │
├─────────────────────────────────────────────────────────────────┤
│ Album Name      │ 1.2G │ 45/3 │ 95%  │ 2024 │ FLAC │ [↗][▶][⬇]│
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  FLAC │ 320kbps                                             │ │
│ │  01. Track One          4:32                                │ │
│ │  02. Track Two          3:15                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Another Album   │ 890M │ 12/1 │ 82%  │ 2023 │ MP3  │ [↗][▶][⬇]│
│ FLAC Image ⚠IMG │ 2.1G │ 89/5 │ 78%  │ 2024 │ FLAC │ [↗][▶][⬇]│
├─────────────────────────────────────────────────────────────────┤
│ ▼ Live (2)                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Concert 2024    │ 3.4G │ 22/4 │ 65%  │ 2024 │ FLAC │ [↗][▶][⬇]│
│ ...                                                             │
├─────────────────────────────────────────────────────────────────┤
│                    [< 1  2  3  4  5 >]                          │
└─────────────────────────────────────────────────────────────────┘
```

**Tab behavior:**

- Two tabs: `Album Results (N)` and `Discography Results (N)` — counts shown in tab labels
- Each tab has its own independent table with full sorting, filtering, and pagination
- Default active tab: Album Results (if any exist), otherwise Discography Results
- Tab state (filter text, sort, page) preserved when switching between tabs
- If only one source has results, still show both tabs but the empty one shows "No results" message
- Results split by existing `searchSource` field: `'album'` → Album tab, `'discography'` → Discography tab

### Discography Tab: Search Term Highlighting

When viewing the **Discography Results** tab, the original search term (album or song name) is prominently displayed and highlighted:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Album Results (12)]  [*Discography Results (45)*]              │
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Filter...]                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Title▾          │ Size │ S/L  │ Rel  │ Match       │ Actions   │
├─────────────────────────────────────────────────────────────────┤
│ Discography     │ 12G  │ 33/5 │ 70%  │ ✅ OK Compu │ [↗][▶][⬇]│
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  CD1/                                                       │ │
│ │  01. Some Track               4:32                          │ │
│ │  02. >>OK Computer<<          3:15    ← highlighted         │ │
│ │  CD2/                                                       │ │
│ │  03. Another Track            5:01                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Discography 2   │ 8.2G │ 15/2 │ 65%  │ ✅ OK Compu │ [↗][▶][⬇]│
│ Full Collection  │ 25G  │ 5/1  │ 40%  │ —           │ [↗][▶][⬇]│
├─────────────────────────────────────────────────────────────────┤
│                    [< 1  2 >]                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Match badge (collapsed row):**

- Green `✅ Match: {album name}` badge shown in a **Match** column (discography tab only, replaces Category column)
- Badge text truncated with tooltip for full match context
- If no match found inside the torrent, show `—` (dash)
- Rows with matches sorted above rows without matches (secondary sort priority, after FLAC image deprioritization)

**Highlighted track list (expanded row):**

- When a discography torrent row is expanded, the search term is highlighted with `bg.accent` background in folder names and track names
- Matching albums/folders get a subtle left-border accent color
- Non-matching folders/tracks shown in normal style for context
- Highlight uses the album/song name from the SmartSearch classification step (not the raw query text)

### Table Columns

| Column    | Sortable                | Content                                                                                                          |
| --------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Title     | Yes (alphabetical)      | Torrent title, 1-line truncated with tooltip for full text                                                       |
| Size      | Yes (by sizeBytes)      | Formatted size (GB/MB)                                                                                           |
| S/L       | Yes (by seeders)        | Seeders↑ / Leechers↓, color-coded (green/muted)                                                                  |
| Relevance | Yes (by relevanceScore) | Percentage badge (0-100%)                                                                                        |
| Date      | Yes (by uploadDate)     | Year or relative date                                                                                            |
| Category  | No                      | Badge/tag (FLAC, MP3, etc.) + FLAC image warning badge if applicable. **Album tab only.**                        |
| Match     | No                      | Green match badge with album/song name, or `—` if no match. **Discography tab only** (replaces Category column). |
| Actions   | No                      | Icon buttons: Open page (↗), Preview tracks (▶), Download (⬇)                                                    |

### Sorting Behavior

- Click column header to sort ascending; click again for descending; third click resets to default (relevance desc)
- Active sort column shows directional arrow indicator (▲/▼)
- Sorting applies **within each group** — group order stays fixed (Studio → Discography → Live → Compilations → Other)
- Default sort: Relevance descending

### Grouped Section Headers

- Collapsible section headers: `▼ Studio (12)` / `▶ Live (3)`
- Click to collapse/expand group
- Group order fixed: Studio → Discography → Live → Compilations → Other
- Groups with 0 results (after filtering) are hidden
- When results < 5 total, no grouping applied (flat table)

### Expandable Rows

- Click anywhere on a row (except action buttons) to toggle track list preview
- Expanded area shows:
  - Format and bitrate info
  - Track listing (reuse existing `TorrentTrackListPreview` content)
  - Play buttons for individual tracks (when magnet available)
- Only one row expanded at a time (expanding another collapses the previous)

### Action Buttons

| Button         | Icon                    | Action                                                                           |
| -------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Open page      | FiExternalLink          | Opens RuTracker page via `search:open-url` IPC (authenticated Puppeteer session) |
| Preview tracks | FiList or FiChevronDown | Toggles row expansion to show track list                                         |
| Download       | FiDownload              | Adds torrent to collection (existing collect workflow)                           |

### Client-Side Text Filter

- Input field above the table: placeholder "Filter results..."
- Filters by title text across all groups
- Real-time filtering as user types (debounced ~200ms)
- Matching text highlighted with `bg.accent` background in result rows
- Pagination and result counts update to reflect filtered set
- Filter persists while results are displayed, cleared on new search
- Empty filter state: "No results match your filter" with clear button

### Pagination

- Controls below table: `[< 1 2 3 4 5 ... N >]`
- Page size selector: dropdown with options `[20 | 50 | 100]`
- Page size persisted in app settings via ConfigService (key: `search-results-page-size`)
- Summary text: `Showing 1-20 of 87 results`
- When filter active: `Showing 1-20 of 34 results (filtered from 87)`
- Page resets to 1 when filter text changes or sort changes

### Non-Audio Result Exclusion

**Detection heuristics** (applied to title + category):

- PDFs: title contains "pdf", "книга" (book), "учебник" (textbook), "самоучитель" (tutorial)
- Videos: title contains "video", "видео", "dvd", "blu-ray", "concert film"
- Guitar tabs: title contains "tabs", "табулатур", "ноты" (sheet music), "gtp", "guitar pro"
- Software: title contains "vst", "plugin", "software", "программ"
- Karaoke: title contains "karaoke", "караоке", "минус" (backing track)

**Behavior:**

- Excluded results hidden by default
- Summary text shows count: `(5 hidden)`
- Clickable "Show N hidden results" link at bottom reveals them in a dimmed/muted style
- Hidden results do NOT count toward pagination totals

### FLAC Image Detection & Warning

**Detection heuristics** (applied to title + track preview data):

- Title contains "image", "img", "cue", "образ", "ape+cue", "flac+cue"
- Track preview shows single audio file + .cue file
- Very large single file (>500MB for a single album)

**Display:**

- Orange `⚠ IMG` badge next to format in the Category column
- Tooltip on hover: "Single-file FLAC/APE image (CUE+FLAC). Needs splitting before adding to mix."
- **Sort deprioritization**: within each group, FLAC image results sort to the bottom regardless of active sort column (secondary sort tiebreaker)

## Data Model Changes

No new entities needed. Changes are UI-only + one new config key.

| Store/Config  | Field                      | Type     | Description                                              |
| ------------- | -------------------------- | -------- | -------------------------------------------------------- |
| ConfigService | `search-results-page-size` | `number` | User's preferred page size (20, 50, or 100). Default: 20 |

Existing `SearchResult` fields used:

- `sizeBytes` for size sorting
- `seeders` / `leechers` for S/L column and sorting
- `relevanceScore` for relevance column
- `uploadDate` for date column
- `url` for page link action
- `category` for grouping + exclusion detection
- `title` for text filter, exclusion detection, FLAC image detection

## Edge Cases & Error States

- **0 results after exclusion**: Show "All results were filtered as non-audio. [Show hidden results]" message
- **0 results after text filter**: "No results match '{query}'. [Clear filter]"
- **Missing uploadDate**: Show "—" in date column, sort these to the bottom when sorted by date
- **Missing sizeBytes**: Show raw `size` string, sort to bottom when sorted by size
- **Group with all items excluded**: Group header hidden entirely
- **Text filter + pagination**: Filter applies first, then pagination. Changing filter resets to page 1
- **FLAC image detection false positive**: Badge is informational only, user can still download normally
- **Only album results, no discography**: Discography tab shows "No discography results" message, Album tab active by default
- **Only discography results, no album**: Album tab shows "No direct album results" message, Discography tab auto-selected
- **Discography match data unavailable**: Match column shows `—` for all rows until discography scan is run; badge appears once scan completes
- **Search term ambiguous for highlighting**: Use the classified album/song name from SmartSearch, not the raw query

## Acceptance Criteria

- [ ] Search results display as a table with columns: Title, Size, S/L, Relevance, Date, Category, Actions
- [ ] Clicking column headers sorts results within groups (asc/desc toggle)
- [ ] Results grouped by category with collapsible section headers
- [ ] Clicking a row expands/collapses track list preview
- [ ] Action buttons: open authenticated page, preview tracks, download (collect)
- [ ] Text filter above table filters results by title with debounce
- [ ] Matching text highlighted in filtered results
- [ ] Pagination with page controls and user-configurable page size (20/50/100)
- [ ] Page size persisted in ConfigService across sessions
- [ ] Non-audio results (PDF, video, tabs, software, karaoke) auto-hidden with count shown
- [ ] "Show hidden results" link reveals excluded items in muted style
- [ ] FLAC image rips show orange warning badge with tooltip
- [ ] FLAC image rips deprioritized in sort order (pushed to bottom within group)
- [ ] Results count summary includes hidden/filtered counts
- [ ] Album and discography results shown in separate tabs with counts in tab labels
- [ ] Each tab has independent sorting, filtering, and pagination state
- [ ] Default active tab is Album Results (or Discography if no album results)
- [ ] Tab state preserved when switching between tabs
- [ ] Discography tab shows Match column (replaces Category) with green badge for matched albums
- [ ] Match badge shows truncated album/song name with tooltip for full text
- [ ] Rows with matches sorted above rows without matches in discography tab
- [ ] Expanding a discography row highlights the search term in folder/track names with accent background
- [ ] Matching folders in expanded discography rows have left-border accent color
- [ ] Highlight uses classified album/song name, not raw query text

### User-Controlled Pagination ("Load More")

- Initial search fetches results from the pages returned by progressive search (no hardcoded cap)
- Below the table, a "Load more results" button lets the user fetch additional pages on demand
- Button shows estimated remaining pages: `Load more results (pages 11-20 of ~45)`
- Each click fetches the next batch (e.g., 10 pages) and appends results to the table
- Loading state shown on the button while fetching
- Button hidden when all available pages have been loaded
- This replaces the previous hardcoded 10-page cap in PaginationHandler — the user decides how many pages to fetch

## Open Questions

- Should the exclusion heuristics be configurable by the user, or is the hardcoded list sufficient for v1?
- Should we add a "format" quick-filter (FLAC/MP3/etc. chips) in a future iteration?
- Should FLAC image splitting be a future feature (auto-split CUE+FLAC on download)?

## Out of Scope (v1)

- Server-side re-search with different filters (new RuTracker query)
- Column reordering or resizing
- Saved filter presets
- Bulk download selection (multi-select checkboxes)
- FLAC image auto-splitting
- Format filter chips (future enhancement)
- Seeders threshold slider (future enhancement)

## Dependencies

- Existing `search:open-url` IPC handler (for authenticated page links)
- Existing `resultClassifier.ts` (for category grouping logic)
- Existing `TorrentTrackListPreview` component (reused in expanded rows)
- Existing `ConfigService` (for page size persistence)
- Existing `SearchResult` type with `url`, `sizeBytes`, `relevanceScore`, `uploadDate`, `searchSource` fields
- Existing `DiscographySearchService` scan results (for match data in discography tab)
- Existing `songMatcher.ts` utility (for search term matching in track lists)
