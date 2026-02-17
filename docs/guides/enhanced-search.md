# Enhanced RuTracker Search & Torrent Download Guide

This guide explains how to use the enhanced search features, including advanced filtering, sorting, album discovery, and torrent downloading.

## Features

### 1. Advanced Search Filters

Filter search results by various criteria:

- **File Format**: mp3, flac, wav, aac, ogg, alac, ape
- **Quality**: Minimum seeders, file size range
- **Categories**: RuTracker-specific categories
- **Date Range**: Upload date filtering

### 2. Smart Sorting

Sort results by multiple criteria:

- **Relevance**: AI-powered relevance scoring based on title match, seeders, and quality
- **Seeders**: Number of seeders (descending/ascending)
- **Date**: Upload date
- **Size**: File size
- **Title**: Alphabetical order

### 3. MusicBrainz Integration

Find albums containing specific songs using the MusicBrainz database.

### 4. Torrent Download Management

- Download torrent files directly to a configured folder
- Track download history
- Auto-open torrents in your default client (optional)

## Usage Examples

### Basic Search with Filters

```typescript
import type { SearchRequest } from '@shared/types/search.types'

const searchRequest: SearchRequest = {
  query: 'Pink Floyd Dark Side of the Moon',
  filters: {
    format: 'flac',          // Only FLAC files
    minSeeders: 10,          // At least 10 seeders
    minSize: 100,            // At least 100 MB
    maxSize: 2000,           // At most 2 GB
  },
  sort: {
    by: 'relevance',         // Sort by relevance score
    order: 'desc'            // Highest first
  },
  maxResults: 20             // Limit to 20 results
}

const response = await window.api.search.start(searchRequest)
```

### Search for MP3 Files Only

```typescript
const searchRequest: SearchRequest = {
  query: 'The Beatles Abbey Road',
  filters: {
    format: 'mp3',
    minSeeders: 5
  },
  sort: {
    by: 'seeders',
    order: 'desc'
  }
}
```

### Find High-Quality Lossless Files

```typescript
const searchRequest: SearchRequest = {
  query: 'Miles Davis Kind of Blue',
  filters: {
    format: 'flac',
    minSeeders: 20,
    minSize: 200   // FLAC albums are typically larger
  },
  sort: {
    by: 'relevance',
    order: 'desc'
  }
}
```

### Find Albums by Song Name

Use MusicBrainz to discover which album contains a specific song:

```typescript
import type { AlbumSearchRequest } from '@shared/types/musicbrainz.types'

// Step 1: Find albums containing the song
const albumRequest: AlbumSearchRequest = {
  songTitle: 'Bohemian Rhapsody',
  artist: 'Queen'  // Optional but improves results
}

const albumResponse = await window.api.musicBrainz.findAlbumsBySong(albumRequest)

// Step 2: Select an album and create RuTracker query
if (albumResponse.success && albumResponse.albums) {
  const selectedAlbum = albumResponse.albums[0]

  // Get full album details with track list
  const albumDetails = await window.api.musicBrainz.getAlbumDetails(selectedAlbum.id)

  // Create optimized RuTracker search query
  const queryResponse = await window.api.musicBrainz.createRuTrackerQuery(selectedAlbum.id)
  const query = queryResponse.data // "Queen - A Night at the Opera"

  // Step 3: Search RuTracker with the generated query
  const searchRequest: SearchRequest = {
    query: query,
    filters: {
      format: 'flac',
      minSeeders: 10
    }
  }

  const searchResponse = await window.api.search.start(searchRequest)
}
```

### Download Torrent File

```typescript
import type { TorrentDownloadRequest } from '@shared/types/torrent.types'

// After finding a result you want
const downloadRequest: TorrentDownloadRequest = {
  torrentId: result.id,
  pageUrl: result.url,
  title: result.title
}

const downloadResponse = await window.api.torrent.download(downloadRequest)

if (downloadResponse.success) {
  console.log('Torrent downloaded to:', downloadResponse.torrent.filePath)
}
```

### Configure Torrent Settings

```typescript
import type { TorrentSettings } from '@shared/types/torrent.types'

// Get current settings
const settings = await window.api.torrent.getSettings()

// Update settings
const newSettings: TorrentSettings = {
  torrentsFolder: 'C:\\Music\\Torrents',
  autoOpen: true,       // Auto-open in torrent client
  keepHistory: true     // Track download history
}

await window.api.torrent.updateSettings(newSettings)
```

### View Download History

```typescript
const history = await window.api.torrent.getHistory()

if (history.success) {
  history.data.forEach(torrent => {
    console.log(`${torrent.title} - Downloaded: ${torrent.downloadedAt}`)
  })
}

// Clear history
await window.api.torrent.clearHistory()
```

## Relevance Scoring Algorithm

The relevance score (0-100) is calculated based on:

1. **Title Match** (up to 40 points):
   - Exact match: 40 points
   - Contains full query: 30 points
   - Contains all words: 20 points
   - Partial word match: 5 points per word

2. **Seeder Boost** (up to 30 points):
   - Logarithmic scale based on number of seeders
   - More seeders = higher score

3. **Format Boost** (10 points):
   - Lossless formats (FLAC, ALAC, APE, WAV) get bonus points

**Example**:
- Exact title match + 100 seeders + FLAC = ~80+ points
- Partial match + 5 seeders + MP3 = ~30 points

## Complete Workflow Example

Here's a complete workflow from song search to torrent download:

```typescript
// 1. User wants to find "Stairway to Heaven"
const albumSearch: AlbumSearchRequest = {
  songTitle: 'Stairway to Heaven',
  artist: 'Led Zeppelin'
}

const albums = await window.api.musicBrainz.findAlbumsBySong(albumSearch)

// 2. Display albums to user, they select "Led Zeppelin IV"
const selectedAlbum = albums.albums[0]
const query = await window.api.musicBrainz.createRuTrackerQuery(selectedAlbum.id)

// 3. Search RuTracker with filters
const searchRequest: SearchRequest = {
  query: query.data,
  filters: {
    format: 'flac',
    minSeeders: 10
  },
  sort: {
    by: 'relevance',
    order: 'desc'
  },
  maxResults: 10
}

const results = await window.api.search.start(searchRequest)

// 4. Display results, user selects top result
const selectedResult = results.results[0]

// 5. Download torrent
const downloadRequest: TorrentDownloadRequest = {
  torrentId: selectedResult.id,
  pageUrl: selectedResult.url,
  title: selectedResult.title
}

const download = await window.api.torrent.download(downloadRequest)

// 6. Torrent is saved and ready to open
if (download.success) {
  console.log('Torrent ready at:', download.torrent.filePath)
  // If autoOpen is enabled, it will open in default client
}
```

## API Reference

### IPC Channels

```typescript
// Search
'search:start' - Enhanced search with filters and sorting
'search:open-url' - Open torrent page in browser

// Torrent Download
'torrent:download' - Download torrent file
'torrent:get-history' - Get download history
'torrent:clear-history' - Clear download history
'torrent:get-settings' - Get torrent settings
'torrent:update-settings' - Update torrent settings

// MusicBrainz
'musicbrainz:find-albums' - Find albums by song name
'musicbrainz:get-album' - Get album details with tracks
'musicbrainz:create-query' - Create RuTracker query from album
```

### Type Definitions

See the following files for complete type definitions:

- `src/shared/types/search.types.ts` - Search request/response types
- `src/shared/types/torrent.types.ts` - Torrent download types
- `src/shared/types/musicbrainz.types.ts` - MusicBrainz types
- `src/shared/schemas/` - Zod validation schemas

## Best Practices

1. **Always use filters**: Narrow down results for better performance
2. **Set minSeeders**: Files with more seeders download faster
3. **Use MusicBrainz for accuracy**: When you know a song but not the album
4. **Check relevance scores**: Higher scores = better matches
5. **Configure torrents folder**: Use a dedicated folder for organization
6. **Enable history**: Track what you've downloaded

## Troubleshooting

### No results with filters
- Try relaxing filters (lower minSeeders, wider size range)
- Use 'any' for format instead of specific format

### MusicBrainz not finding albums
- Check spelling of song title
- Try without artist name first
- Use alternate song titles if available

### Torrent download fails
- Ensure you're logged in to RuTracker
- Check that torrents folder is writable
- Verify the page URL is correct

## Future Enhancements

Potential future features:

- [ ] Auto-download torrents matching criteria
- [ ] Batch torrent downloads
- [ ] Integration with torrent clients (qBittorrent, Transmission)
- [ ] Download progress tracking
- [ ] Automatic quality detection (bitrate, sample rate)
- [ ] Custom relevance scoring weights
- [ ] Saved filter presets

---

**Last Updated**: 2026-02-04
