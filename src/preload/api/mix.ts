import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  AddSongFromFileRequest,
  UpdateSongRequest,
  Project,
} from '@shared/types/project.types'

export const mixApi = {
  addSong: (
    request: AddSongFromFileRequest
  ): Promise<{ success: boolean; data?: Project; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD_SONG, request),

  removeSong: (
    projectId: string,
    songId: string
  ): Promise<{ success: boolean; data?: Project; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REMOVE_SONG, projectId, songId),

  updateSong: (
    request: UpdateSongRequest
  ): Promise<{ success: boolean; data?: Project; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE_SONG, request),

  reorderSongs: (
    projectId: string,
    orderedSongIds: string[]
  ): Promise<{ success: boolean; data?: Project; error?: string }> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROJECT_REORDER_SONGS,
      projectId,
      orderedSongIds
    ),

  syncAudioFolder: (
    projectId: string
  ): Promise<{
    success: boolean
    data?: Project
    newCount?: number
    error?: string
  }> => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SYNC_AUDIO_FOLDER, projectId),
}
