import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { MusicBrainzService } from '../services/MusicBrainzService'
import type {
  AlbumSearchRequest,
  SearchClassificationRequest,
  ArtistAlbumsRequest,
} from '@shared/types/musicbrainz.types'

export function registerMusicBrainzHandlers(musicBrainzService: MusicBrainzService): void {
  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_FIND_ALBUMS, async (_event, request: AlbumSearchRequest) => {
    try {
      const response = await musicBrainzService.findAlbumsBySong(request)
      return response
    } catch (error) {
      console.error('MusicBrainz album search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Album search failed',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_GET_ALBUM, async (_event, albumId: string) => {
    try {
      const album = await musicBrainzService.getAlbumDetails(albumId)
      return { success: true, data: album }
    } catch (error) {
      console.error('Failed to get album details:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get album details',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MUSICBRAINZ_CREATE_QUERY, async (_event, albumId: string) => {
    try {
      const album = await musicBrainzService.getAlbumDetails(albumId)
      if (!album) {
        return {
          success: false,
          error: 'Album not found',
        }
      }
      const query = musicBrainzService.createRuTrackerQuery(album)
      return { success: true, data: query }
    } catch (error) {
      console.error('Failed to create RuTracker query:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create query',
      }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.MUSICBRAINZ_CLASSIFY_SEARCH,
    async (_event, request: SearchClassificationRequest) => {
      try {
        const response = await musicBrainzService.classifySearch(request)
        return response
      } catch (error) {
        console.error('Search classification failed:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Search classification failed',
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MUSICBRAINZ_GET_ARTIST_ALBUMS,
    async (_event, request: ArtistAlbumsRequest) => {
      try {
        const response = await musicBrainzService.getArtistAlbums(request)
        return response
      } catch (error) {
        console.error('Failed to get artist albums:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get artist albums',
        }
      }
    }
  )
}
