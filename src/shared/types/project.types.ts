// Project-related types

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  path: string
}

export interface CreateProjectRequest {
  name: string
  description?: string
}

export interface ProjectMetadata {
  totalSearches: number
  totalDownloads: number
  totalFiles: number
  lastOpened: Date
}
