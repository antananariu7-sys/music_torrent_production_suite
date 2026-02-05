# Smart Search Integration Guide

## Overview

The Smart Search feature provides an intelligent workflow for searching and downloading music from RuTracker. It automatically:

1. **Classifies** the search term (artist, album, or song)
2. **Guides the user** through appropriate choices based on the type
3. **Searches RuTracker** with optimized queries
4. **Downloads** the selected torrent file

## Architecture

### Components

1. **SmartSearchBar** - Search input with status indicators
2. **SmartSearch** - Workflow orchestrator (handles all dialogs and API calls)
3. **SearchClassificationDialog** - Let user choose between artist/album/song matches
4. **AlbumSelectionDialog** - Select specific album or download discography
5. **TorrentResultsDialog** - Select torrent from RuTracker results

### Store

**smartSearchStore** (Zustand) - Manages workflow state:
- Current step in workflow
- Classification results
- Selected album/artist/song
- RuTracker search results
- Download status

## Integration Example

### Basic Integration (Project Details Page)

```tsx
import React from 'react'
import { SmartSearchBar, SmartSearch } from '@/renderer/components/features/search'

export const ProjectDetailsPage: React.FC = () => {
  const handleSearchComplete = (filePath: string) => {
    console.log('Torrent downloaded to:', filePath)
    // Show success notification or update UI
  }

  const handleSearchCancel = () => {
    console.log('Search cancelled')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">
          Project Details
        </h1>

        {/* Smart Search Bar */}
        <SmartSearchBar
          placeholder="Search for artist, album, or song..."
          className="max-w-2xl"
        />
      </div>

      {/* Rest of your page content */}
      <div>
        {/* Project details, tracks, etc. */}
      </div>

      {/* Smart Search Workflow Handler */}
      <SmartSearch
        onComplete={handleSearchComplete}
        onCancel={handleSearchCancel}
      />
    </div>
  )
}
```

## User Workflows

### Workflow 1: Search by Song Name

1. User types: **"Bohemian Rhapsody"**
2. System classifies as **Song**
3. **SearchClassificationDialog** shows:
   - 🎵 Song: "Bohemian Rhapsody" by Queen (95% match)
   - 💿 Album: "Bohemian Rhapsody: The Original Soundtrack" (70% match)
4. User selects **Song**
5. **AlbumSelectionDialog** shows albums containing this song:
   - "A Night at the Opera" (1975)
   - "Greatest Hits" (1981)
   - etc.
6. User selects **"A Night at the Opera"**
7. **TorrentResultsDialog** shows RuTracker results for "Queen - A Night at the Opera"
8. User selects torrent with best quality/seeders
9. Torrent file downloads to configured folder

### Workflow 2: Search by Artist Name

1. User types: **"Pink Floyd"**
2. System classifies as **Artist**
3. **SearchClassificationDialog** shows:
   - 🎤 Artist: "Pink Floyd" (100% match)
   - 💿 Album: "Pink" by Pink Floyd (80% match)
4. User selects **Artist**
5. **AlbumSelectionDialog** shows:
   - Option to download **complete discography**
   - List of individual albums:
     - "The Dark Side of the Moon" (1973)
     - "The Wall" (1979)
     - "Wish You Were Here" (1975)
     - etc.
6a. If user clicks **"Download Complete Discography"**:
   - System searches RuTracker for "Pink Floyd discography"
   - Shows torrent results
6b. If user selects specific album:
   - System searches RuTracker for "Pink Floyd - Album Name"
   - Shows torrent results

### Workflow 3: Search by Album Name

1. User types: **"Dark Side of the Moon"**
2. System classifies as **Album**
3. **SearchClassificationDialog** shows:
   - 💿 Album: "The Dark Side of the Moon" by Pink Floyd (98% match)
   - 🎵 Song: "Dark Side of the Moon" by Various Artists (60% match)
4. User selects **Album**
5. System directly searches RuTracker for "Pink Floyd - The Dark Side of the Moon"
6. **TorrentResultsDialog** shows results
7. User selects torrent
8. Download completes

## Workflow State Machine

```
idle
  ↓ (user submits search)
classifying
  ↓ (MusicBrainz API call)
user-choice (SearchClassificationDialog)
  ↓
  ├─ [Artist Selected]
  │   ↓ (get artist albums)
  │   selecting-album (AlbumSelectionDialog)
  │   ↓
  │   ├─ [Discography Selected] → searching-rutracker
  │   └─ [Album Selected] → searching-rutracker
  │
  ├─ [Album Selected] → searching-rutracker
  │
  └─ [Song Selected]
      ↓ (find albums containing song)
      selecting-album (AlbumSelectionDialog)
      ↓ (album selected)
      searching-rutracker
        ↓ (RuTracker API call)
        selecting-torrent (TorrentResultsDialog)
          ↓ (torrent selected)
          downloading
            ↓ (download complete)
            completed ✅

(Any step can go to 'error' state)
```

## API Methods Used

### MusicBrainz APIs (via window.api.musicBrainz)

```typescript
// Classify search term
await window.api.musicBrainz.classifySearch({ query: 'search term' })

// Find albums containing a song
await window.api.musicBrainz.findAlbumsBySong({
  songTitle: 'song name',
  artist: 'artist name' // optional
})

// Get artist's albums
await window.api.musicBrainz.getArtistAlbums({
  artistId: 'mbid',
  limit: 50
})

// Get album details
await window.api.musicBrainz.getAlbumDetails('album-id')

// Create RuTracker query from album
await window.api.musicBrainz.createRuTrackerQuery('album-id')
```

### RuTracker Search API (via window.api.search)

```typescript
await window.api.search.start({
  query: 'Artist - Album',
  filters: {
    format: 'flac',
    minSeeders: 10
  },
  sort: {
    by: 'relevance',
    order: 'desc'
  },
  maxResults: 20
})
```

### Torrent Download API (via window.api.torrent)

```typescript
await window.api.torrent.download({
  torrentId: 'torrent-id',
  pageUrl: 'https://rutracker.org/forum/viewtopic.php?t=...',
  title: 'torrent title'
})
```

## Customization

### Custom Styling

All components use Tailwind CSS classes. You can customize by:

1. Modifying component classes directly
2. Wrapping components with custom containers
3. Using `className` props where available

### Custom Filters

Modify the RuTracker search filters in `SmartSearch.tsx`:

```typescript
const response = await window.api.search.start({
  query,
  filters: {
    format: 'flac',        // Change to 'mp3', 'any', etc.
    minSeeders: 20,        // Increase for better quality
    minSize: 200,          // Minimum size in MB
    maxSize: 2000          // Maximum size in MB
  },
  sort: {
    by: 'seeders',         // Or 'relevance', 'date', 'size'
    order: 'desc'
  },
  maxResults: 50           // Show more results
})
```

### Callbacks

```typescript
<SmartSearch
  onComplete={(filePath) => {
    // Torrent downloaded successfully
    console.log('Downloaded to:', filePath)

    // Custom actions:
    // - Show toast notification
    // - Add to project
    // - Open containing folder
    // - Auto-add to torrent client
  }}
  onCancel={() => {
    // User cancelled workflow
    console.log('Search cancelled')
  }}
/>
```

## Error Handling

The SmartSearch component handles errors gracefully:

- MusicBrainz API failures → Shows error notification
- No results found → Shows helpful message
- RuTracker search failures → Shows error notification
- Download failures → Shows error notification

Errors are displayed as a notification in the bottom-right corner with:
- Error icon (red)
- Error message
- Close button

## Testing

### Manual Testing Checklist

- [ ] Search by artist name (e.g., "The Beatles")
- [ ] Search by album name (e.g., "Abbey Road")
- [ ] Search by song name (e.g., "Come Together")
- [ ] Select artist and browse albums
- [ ] Select artist and download discography
- [ ] Select specific album from list
- [ ] Select torrent from RuTracker results
- [ ] Download completes successfully
- [ ] Cancel at each workflow step
- [ ] Handle no results scenario
- [ ] Handle API errors

### Unit Testing

```typescript
import { useSmartSearchStore } from '@/renderer/store/smartSearchStore'

describe('SmartSearch Store', () => {
  it('should start search with query', () => {
    const { startSearch, step, originalQuery } = useSmartSearchStore.getState()

    startSearch('Pink Floyd')

    expect(step).toBe('classifying')
    expect(originalQuery).toBe('Pink Floyd')
  })

  it('should handle classification results', () => {
    const { setClassificationResults, step } = useSmartSearchStore.getState()

    setClassificationResults([
      { type: 'artist', name: 'Pink Floyd', score: 100 }
    ])

    expect(step).toBe('user-choice')
  })

  // Add more tests...
})
```

## Performance Considerations

- **Rate Limiting**: MusicBrainz enforces 1 request/second
- **Caching**: Consider caching classification results
- **Debouncing**: SmartSearchBar could add debouncing for real-time search
- **Pagination**: Currently loads first 20-50 results

## Recent Enhancements (2026-02-05)

### Implemented Features

✅ **Search History Persistence**
- Search history is now saved per-project to `search-history.json`
- Automatically loads when opening a project
- Preserves history across app restarts
- Maximum 50 entries with auto-cleanup

✅ **Torrent Collection System**
- "Collect" action adds torrents to a per-project collection
- Collections are saved to `torrent-collection.json` in project directory
- Magnet link extraction for easy use in external torrent clients
- Duplicate prevention by torrent ID

✅ **Project Context Integration**
- Smart Search is now project-aware
- All persistence (history, collections) is scoped to current project
- Context is set automatically when project loads

✅ **Workflow Improvements**
- New "collecting" step after torrent selection
- Better state preservation across workflow steps
- Activity log for tracking workflow progress

### Architecture Changes

**Store Updates** (`smartSearchStore.ts`):
- Added `projectId`, `projectName`, `projectDirectory` to state
- New actions: `setProjectContext`, `loadHistoryFromProject`
- Auto-save to disk on history changes
- New workflow step: `collecting`

**New Service** (`TorrentCollectionService.ts`):
- Manages persistent torrent collection storage
- Methods: `loadCollection`, `saveCollection`, `clearCollection`
- File-based storage in project directory

**New IPC Channels**:
- `torrent:collection:load` - Load collection for project
- `torrent:collection:save` - Save collection for project
- `torrent:collection:clear` - Clear project collection

## Future Enhancements

- [ ] Real-time search suggestions (debounced)
- [ ] Favorite artists/albums
- [ ] Advanced filter presets
- [ ] Batch download support
- [ ] Integration with torrent client APIs
- [ ] Download queue management

---

**Implementation Date**: 2026-02-04
**Last Updated**: 2026-02-05
**Status**: ✅ Complete with project persistence
