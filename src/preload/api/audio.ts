import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type { AudioMetadata } from '@shared/types/project.types'

export const audioApi = {
  readFile: (
    filePath: string
  ): Promise<{ success: boolean; url?: string; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUDIO_READ_FILE, filePath),

  readMetadata: (
    filePath: string
  ): Promise<{ success: boolean; data?: AudioMetadata; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUDIO_READ_METADATA, filePath),
}
