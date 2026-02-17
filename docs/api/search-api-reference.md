# Enhanced Search API - Quick Reference

## Search with Filters

```typescript
const response = await window.api.search.start({
  query: 'Pink Floyd',
  filters: {
    format: 'flac',        // mp3 | flac | wav | aac | ogg | alac | ape | any
    minSeeders: 10,        // Minimum seeders
    minSize: 100,          // Minimum size in MB
    maxSize: 2000,         // Maximum size in MB
    categories: ['...']    // RuTracker categories (optional)
  },
  sort: {
    by: 'relevance',       // relevance | seeders | date | size | title
    order: 'desc'          // desc | asc
  },
  maxResults: 20
})
```

## Find Album by Song

```typescript
// Step 1: Find albums
const albums = await window.api.musicBrainz.findAlbumsBySong({
  songTitle: 'Bohemian Rhapsody',
  artist: 'Queen'  // Optional
})

// Step 2: Get album details
const album = await window.api.musicBrainz.getAlbumDetails(albums.albums[0].id)

// Step 3: Create RuTracker query
const query = await window.api.musicBrainz.createRuTrackerQuery(album.id)
// Returns: "Queen - A Night at the Opera"
```

## Download Torrent

```typescript
const download = await window.api.torrent.download({
  torrentId: result.id,
  pageUrl: result.url,
  title: result.title
})

console.log(download.torrent.filePath)
// ~/Music/Torrents/123456.torrent
```

## Manage Download History

```typescript
// Get history
const history = await window.api.getTorrentHistory()

// Clear history
await window.api.clearTorrentHistory()
```

## Configure Torrent Settings

```typescript
await window.api.updateTorrentSettings({
  torrentsFolder: 'C:\\Music\\Torrents',
  autoOpen: true,
  keepHistory: true
})
```

## Common Filter Combinations

### High-Quality FLAC Albums
```typescript
filters: {
  format: 'flac',
  minSeeders: 20,
  minSize: 200
}
```

### Popular MP3 Releases
```typescript
filters: {
  format: 'mp3',
  minSeeders: 50
},
sort: {
  by: 'seeders',
  order: 'desc'
}
```

### Recent Uploads
```typescript
filters: {
  dateFrom: new Date('2024-01-01')
},
sort: {
  by: 'date',
  order: 'desc'
}
```

## Types Reference

```typescript
type FileFormat = 'mp3' | 'flac' | 'wav' | 'aac' | 'ogg' | 'alac' | 'ape' | 'any'
type SortBy = 'relevance' | 'seeders' | 'date' | 'size' | 'title'
type SortOrder = 'asc' | 'desc'

interface SearchFilters {
  format?: FileFormat
  minSeeders?: number
  minSize?: number          // in MB
  maxSize?: number          // in MB
  categories?: string[]
  dateFrom?: Date
  dateTo?: Date
}

interface SearchResult {
  id: string
  title: string
  author: string
  size: string              // "1.5 GB"
  sizeBytes?: number        // 1610612736
  seeders: number
  leechers: number
  url: string
  category?: string
  uploadDate?: string
  relevanceScore?: number   // 0-100
  format?: FileFormat
}
```
