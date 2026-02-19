// Internal MusicBrainz API response types (not exported to consumers)

export interface MBRecording {
  id: string
  title: string
  score?: number
  'artist-credit'?: Array<{ artist?: { id: string; name: string } }>
  releases?: Array<{
    id: string
    title: string
    date?: string
    'release-group'?: { id: string; 'primary-type'?: string }
    'track-count'?: number
  }>
}

export interface MBRelease {
  id: string
  title: string
  score?: number
  date?: string
  'artist-credit'?: Array<{ artist?: { id: string; name: string } }>
  'release-group'?: { id: string; 'primary-type'?: string }
  'track-count'?: number
}

export interface MBArtist {
  id: string
  name: string
  score?: number
  type?: string
}

export interface MBRecordingResponse {
  recordings: MBRecording[]
}

export interface MBReleaseResponse {
  releases: MBRelease[]
}

export interface MBArtistResponse {
  artists: MBArtist[]
}
