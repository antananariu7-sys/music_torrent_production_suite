import { create } from 'zustand'
import type { Project, RecentProject } from '@shared/types/project.types'

interface ProjectState {
  // State
  currentProject: Project | null
  recentProjects: RecentProject[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentProject: (project: Project | null) => void
  setRecentProjects: (projects: RecentProject[]) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void

  // Async actions
  loadRecentProjects: () => Promise<void>
  createProject: (name: string, location: string, description?: string) => Promise<void>
  openProject: (filePath: string) => Promise<void>
  closeProject: () => Promise<void>
  deleteProject: (projectId: string) => Promise<boolean>
}

export const useProjectStore = create<ProjectState>((set) => ({
  // Initial state
  currentProject: null,
  recentProjects: [],
  isLoading: false,
  error: null,

  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),

  setRecentProjects: (projects) => set({ recentProjects: projects }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  // Async actions
  loadRecentProjects: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.getRecentProjects()
      if (response.success && response.data) {
        set({ recentProjects: response.data, isLoading: false })
      } else {
        set({ error: response.error || 'Failed to load recent projects', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load recent projects',
        isLoading: false,
      })
    }
  },

  createProject: async (name: string, location: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.createProject({ name, location, description })
      if (response.success && response.data) {
        set({
          currentProject: response.data,
          isLoading: false,
        })
        // Refresh recent projects
        const recentResponse = await window.api.getRecentProjects()
        if (recentResponse.success && recentResponse.data) {
          set({ recentProjects: recentResponse.data })
        }
      } else {
        set({ error: response.error || 'Failed to create project', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create project',
        isLoading: false,
      })
    }
  },

  openProject: async (filePath: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await window.api.openProject({ filePath })
      if (response.success && response.data) {
        set({
          currentProject: response.data,
          isLoading: false,
        })
        // Refresh recent projects
        const recentResponse = await window.api.getRecentProjects()
        if (recentResponse.success && recentResponse.data) {
          set({ recentProjects: recentResponse.data })
        }
      } else {
        set({ error: response.error || 'Failed to open project', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open project',
        isLoading: false,
      })
    }
  },

  closeProject: async () => {
    const { currentProject } = useProjectStore.getState()
    if (!currentProject) return

    try {
      const response = await window.api.closeProject(currentProject.id)
      if (response.success) {
        set({ currentProject: null })
      } else {
        set({ error: response.error || 'Failed to close project' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to close project',
      })
    }
  },

  deleteProject: async (projectId: string) => {
    try {
      const response = await window.api.deleteProject(projectId)
      if (response.success) {
        // Remove from local state
        const { recentProjects } = useProjectStore.getState()
        set({ recentProjects: recentProjects.filter((p) => p.projectId !== projectId) })
        return true
      } else {
        set({ error: response.error || 'Failed to delete project' })
        return false
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete project',
      })
      return false
    }
  },
}))
