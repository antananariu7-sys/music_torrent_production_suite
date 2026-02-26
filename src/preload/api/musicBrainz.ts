import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  AlbumSearchRequest,
  AlbumSearchResponse,
  SearchClassificationRequest,
  SearchClassificationResponse,
  ArtistAlbumsRequest,
  ArtistAlbumsResponse,
  MusicBrainzAlbum,
} from '@shared/types/musicbrainz.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const musicBrainzApi = {
  classifySearch: (
    request: SearchClassificationRequest
  ): Promise<SearchClassificationResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CLASSIFY_SEARCH, request),

  findAlbumsBySong: (
    request: AlbumSearchRequest
  ): Promise<AlbumSearchResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_FIND_ALBUMS, request),

  getAlbumDetails: (
    albumId: string
  ): Promise<ApiResponse<MusicBrainzAlbum | null>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ALBUM, albumId),

  getArtistAlbums: (
    request: ArtistAlbumsRequest
  ): Promise<ArtistAlbumsResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_GET_ARTIST_ALBUMS, request),

  createRuTrackerQuery: (albumId: string): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MUSICBRAINZ_CREATE_QUERY, albumId),
}
