import Store from 'electron-store'
import { RecentProject } from '../../shared/types/project.types'

/**
 * Schema for electron-store
 */
interface StoreSchema {
  recentProjects: any[]
  [key: string]: any
}

/**
 * ConfigService
 *
 * Manages application configuration and persistent storage.
 * Uses electron-store for cross-platform storage.
 * Handles recent projects list and general application settings.
 */
export class ConfigService {
  private store: Store<StoreSchema>

  private static readonly RECENT_PROJECTS_KEY = 'recentProjects'
  private static readonly MAX_RECENT_PROJECTS = 10

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'music-production-suite-config',
      defaults: {
        [ConfigService.RECENT_PROJECTS_KEY]: [],
      },
    })
  }

  /**
   * Gets the list of recent projects
   * Returns projects sorted by lastOpened (most recent first)
   *
   * @returns Array of recent projects
   */
  getRecentProjects(): RecentProject[] {
    const projects = this.store.get(ConfigService.RECENT_PROJECTS_KEY, []) as any[]

    // Convert date strings back to Date objects and sort
    const recentProjects = projects.map((p) => ({
      ...p,
      lastOpened: new Date(p.lastOpened),
    }))

    // Sort by lastOpened (most recent first)
    return recentProjects.sort(
      (a, b) => b.lastOpened.getTime() - a.lastOpened.getTime()
    )
  }

  /**
   * Adds or updates a project in the recent projects list
   * If project already exists, updates it and moves to top
   * Limits list to MAX_RECENT_PROJECTS
   *
   * @param project - Recent project to add
   */
  addRecentProject(project: RecentProject): void {
    let projects = this.getRecentProjects()

    // Remove existing entry if present
    projects = projects.filter((p) => p.projectId !== project.projectId)

    // Add new entry at the beginning
    projects.unshift(project)

    // Limit to MAX_RECENT_PROJECTS
    if (projects.length > ConfigService.MAX_RECENT_PROJECTS) {
      projects = projects.slice(0, ConfigService.MAX_RECENT_PROJECTS)
    }

    this.store.set(ConfigService.RECENT_PROJECTS_KEY, projects)
  }

  /**
   * Removes a project from the recent projects list
   *
   * @param projectId - ID of project to remove
   */
  removeRecentProject(projectId: string): void {
    const projects = this.getRecentProjects()
    const filtered = projects.filter((p) => p.projectId !== projectId)
    this.store.set(ConfigService.RECENT_PROJECTS_KEY, filtered)
  }

  /**
   * Clears all recent projects
   */
  clearRecentProjects(): void {
    this.store.set(ConfigService.RECENT_PROJECTS_KEY, [])
  }

  /**
   * Gets a setting value
   *
   * @param key - Setting key
   * @param defaultValue - Default value if setting doesn't exist
   * @returns Setting value or default value
   */
  getSetting<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.store.get(key, defaultValue) as T | undefined
  }

  /**
   * Sets a setting value
   *
   * @param key - Setting key
   * @param value - Setting value
   */
  setSetting<T = any>(key: string, value: T): void {
    this.store.set(key, value)
  }

  /**
   * Deletes a setting
   *
   * @param key - Setting key to delete
   */
  deleteSetting(key: string): void {
    this.store.delete(key)
  }

  /**
   * Checks if a setting exists
   *
   * @param key - Setting key
   * @returns True if setting exists, false otherwise
   */
  hasSetting(key: string): boolean {
    return this.store.has(key)
  }
}
