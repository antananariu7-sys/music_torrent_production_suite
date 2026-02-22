import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockWindowApi = {
  getRecentProjects: jest.fn<() => Promise<any>>(),
  createProject: jest.fn<() => Promise<any>>(),
  openProject: jest.fn<() => Promise<any>>(),
  closeProject: jest.fn<() => Promise<any>>(),
  deleteProject: jest.fn<() => Promise<any>>(),
  deleteProjectFromDisk: jest.fn<() => Promise<any>>(),
}

;(globalThis as any).window = { api: mockWindowApi }

import { useProjectStore } from './useProjectStore'
import type { Project, RecentProject } from '@shared/types/project.types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    location: '/projects/test',
    description: '',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  } as Project
}

function makeRecent(overrides: Partial<RecentProject> = {}): RecentProject {
  return {
    projectId: 'proj-1',
    name: 'Test Project',
    filePath: '/projects/test/project.json',
    lastOpened: '2024-01-01',
    ...overrides,
  } as RecentProject
}

describe('useProjectStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useProjectStore.setState({
      currentProject: null,
      recentProjects: [],
      isLoading: false,
      error: null,
    })
  })

  describe('loadRecentProjects', () => {
    it('should load recent projects on success', async () => {
      const projects = [
        makeRecent({ projectId: 'p1' }),
        makeRecent({ projectId: 'p2' }),
      ]
      mockWindowApi.getRecentProjects.mockResolvedValue({
        success: true,
        data: projects,
      } as never)

      await useProjectStore.getState().loadRecentProjects()

      const state = useProjectStore.getState()
      expect(state.recentProjects).toEqual(projects)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set error on failure response', async () => {
      mockWindowApi.getRecentProjects.mockResolvedValue({
        success: false,
        error: 'DB error',
      } as never)

      await useProjectStore.getState().loadRecentProjects()

      expect(useProjectStore.getState().error).toBe('DB error')
      expect(useProjectStore.getState().isLoading).toBe(false)
    })

    it('should set error on exception', async () => {
      mockWindowApi.getRecentProjects.mockRejectedValue(
        new Error('Network') as never
      )

      await useProjectStore.getState().loadRecentProjects()

      expect(useProjectStore.getState().error).toBe('Network')
      expect(useProjectStore.getState().isLoading).toBe(false)
    })
  })

  describe('createProject', () => {
    it('should set currentProject and refresh recent list', async () => {
      const project = makeProject()
      const recent = [makeRecent()]
      mockWindowApi.createProject.mockResolvedValue({
        success: true,
        data: project,
      } as never)
      mockWindowApi.getRecentProjects.mockResolvedValue({
        success: true,
        data: recent,
      } as never)

      await useProjectStore.getState().createProject('Test', '/projects')

      const state = useProjectStore.getState()
      expect(state.currentProject).toEqual(project)
      expect(state.recentProjects).toEqual(recent)
      expect(state.isLoading).toBe(false)
    })

    it('should set error on create failure', async () => {
      mockWindowApi.createProject.mockResolvedValue({
        success: false,
        error: 'Invalid name',
      } as never)

      await useProjectStore.getState().createProject('', '/projects')

      expect(useProjectStore.getState().error).toBe('Invalid name')
      expect(useProjectStore.getState().currentProject).toBeNull()
    })

    it('should handle exception', async () => {
      mockWindowApi.createProject.mockRejectedValue(
        new Error('Disk full') as never
      )

      await useProjectStore.getState().createProject('Test', '/projects')

      expect(useProjectStore.getState().error).toBe('Disk full')
    })
  })

  describe('openProject', () => {
    it('should set currentProject and refresh recent list', async () => {
      const project = makeProject()
      const recent = [makeRecent()]
      mockWindowApi.openProject.mockResolvedValue({
        success: true,
        data: project,
      } as never)
      mockWindowApi.getRecentProjects.mockResolvedValue({
        success: true,
        data: recent,
      } as never)

      await useProjectStore
        .getState()
        .openProject('/projects/test/project.json')

      const state = useProjectStore.getState()
      expect(state.currentProject).toEqual(project)
      expect(state.recentProjects).toEqual(recent)
    })

    it('should set error on failure', async () => {
      mockWindowApi.openProject.mockResolvedValue({
        success: false,
        error: 'Not found',
      } as never)

      await useProjectStore.getState().openProject('/bad/path')

      expect(useProjectStore.getState().error).toBe('Not found')
    })
  })

  describe('closeProject', () => {
    it('should clear currentProject on success', async () => {
      useProjectStore.setState({ currentProject: makeProject() })
      mockWindowApi.closeProject.mockResolvedValue({ success: true } as never)

      await useProjectStore.getState().closeProject()

      expect(useProjectStore.getState().currentProject).toBeNull()
    })

    it('should do nothing if no current project', async () => {
      await useProjectStore.getState().closeProject()

      expect(mockWindowApi.closeProject).not.toHaveBeenCalled()
    })

    it('should set error on failure', async () => {
      useProjectStore.setState({ currentProject: makeProject() })
      mockWindowApi.closeProject.mockResolvedValue({
        success: false,
        error: 'Busy',
      } as never)

      await useProjectStore.getState().closeProject()

      expect(useProjectStore.getState().error).toBe('Busy')
      // currentProject is NOT cleared on failure
    })
  })

  describe('deleteProject', () => {
    it('should remove from recentProjects on success', async () => {
      useProjectStore.setState({
        recentProjects: [
          makeRecent({ projectId: 'p1' }),
          makeRecent({ projectId: 'p2' }),
        ],
      })
      mockWindowApi.deleteProject.mockResolvedValue({ success: true } as never)

      const result = await useProjectStore.getState().deleteProject('p1')

      expect(result).toBe(true)
      const recent = useProjectStore.getState().recentProjects
      expect(recent).toHaveLength(1)
      expect(recent[0].projectId).toBe('p2')
    })

    it('should set error and return false on failure', async () => {
      mockWindowApi.deleteProject.mockResolvedValue({
        success: false,
        error: 'Locked',
      } as never)

      const result = await useProjectStore.getState().deleteProject('p1')

      expect(result).toBe(false)
      expect(useProjectStore.getState().error).toBe('Locked')
    })

    it('should handle exception', async () => {
      mockWindowApi.deleteProject.mockRejectedValue(new Error('IO') as never)

      const result = await useProjectStore.getState().deleteProject('p1')

      expect(result).toBe(false)
      expect(useProjectStore.getState().error).toBe('IO')
    })
  })

  describe('deleteProjectFromDisk', () => {
    it('should remove from recentProjects on success', async () => {
      useProjectStore.setState({
        recentProjects: [makeRecent({ projectId: 'p1' })],
      })
      mockWindowApi.deleteProjectFromDisk.mockResolvedValue({
        success: true,
      } as never)

      const result = await useProjectStore
        .getState()
        .deleteProjectFromDisk('p1', '/projects/p1')

      expect(result).toBe(true)
      expect(useProjectStore.getState().recentProjects).toHaveLength(0)
    })

    it('should set error and return false on failure', async () => {
      mockWindowApi.deleteProjectFromDisk.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      } as never)

      const result = await useProjectStore
        .getState()
        .deleteProjectFromDisk('p1', '/proj')

      expect(result).toBe(false)
      expect(useProjectStore.getState().error).toBe('Permission denied')
    })
  })

  describe('simple setters', () => {
    it('setCurrentProject should update state', () => {
      const project = makeProject()
      useProjectStore.getState().setCurrentProject(project)
      expect(useProjectStore.getState().currentProject).toEqual(project)
    })

    it('setError and clearError should work', () => {
      useProjectStore.getState().setError('test error')
      expect(useProjectStore.getState().error).toBe('test error')

      useProjectStore.getState().clearError()
      expect(useProjectStore.getState().error).toBeNull()
    })
  })
})
