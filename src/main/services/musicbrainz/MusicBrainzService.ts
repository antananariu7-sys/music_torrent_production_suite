import type {
  MusicBrainzAlbum,
  AlbumSearchRequest,
  AlbumSearchResponse,
  SearchClassificationRequest,
  SearchClassificationResponse,
  ArtistAlbumsRequest,
  ArtistAlbumsResponse,
} from '@shared/types/musicbrainz.types'
import { MusicBrainzApiClient } from './MusicBrainzApiClient'
import { findAlbumsBySong, getAlbumDetails } from './api/albumSearch'
import { classifySearch } from './api/classifySearch'
import { getArtistAlbums } from './api/artistAlbums'

/**
 * MusicBrainzService
 *
 * Facade that integrates with MusicBrainz API to classify search terms,
 * discover albums containing specific songs, and fetch artist discographies.
 */
export class MusicBrainzService {
  private client = new MusicBrainzApiClient()

  async findAlbumsBySong(request: AlbumSearchRequest): Promise<AlbumSearchResponse> {
    return findAlbumsBySong(this.client, request)
  }

  async getAlbumDetails(albumId: string): Promise<MusicBrainzAlbum | null> {
    return getAlbumDetails(this.client, albumId)
  }

  /**
   * Create a search query string for RuTracker based on album info
   * Format: "Artist - Album Title"
   */
  createRuTrackerQuery(album: MusicBrainzAlbum): string {
    return `${album.artist} - ${album.title}`
  }

  async classifySearch(request: SearchClassificationRequest): Promise<SearchClassificationResponse> {
    return classifySearch(this.client, request)
  }

  async getArtistAlbums(request: ArtistAlbumsRequest): Promise<ArtistAlbumsResponse> {
    return getArtistAlbums(this.client, request)
  }
}
