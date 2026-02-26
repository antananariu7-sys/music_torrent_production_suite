import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import type {
  CreateProjectRequest,
  OpenProjectRequest,
  Project,
  RecentProject,
} from '@shared/types/project.types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const projectApi = {
  createProject: (
    request: CreateProjectRequest
  ): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, request),

  openProject: (request: OpenProjectRequest): Promise<ApiResponse<Project>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, request),

  closeProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLOSE, projectId),

  getRecentProjects: (): Promise<ApiResponse<RecentProject[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

  deleteProject: (projectId: string): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, projectId),

  deleteProjectFromDisk: (
    projectId: string,
    projectDirectory: string
  ): Promise<ApiResponse<void>> =>
    ipcRenderer.invoke(
      IPC_CHANNELS.PROJECT_DELETE_FROM_DISK,
      projectId,
      projectDirectory
    ),

  selectDirectory: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_DIRECTORY, title),

  selectAudioFiles: (): Promise<string[] | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_AUDIO_FILES),

  openPath: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_PATH, filePath),
}
