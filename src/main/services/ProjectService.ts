import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'
import {
  Project,
  Song,
  MixMetadata,
  ProjectStats,
  AddSongRequest,
} from '../../shared/types/project.types'
import { FileSystemService } from './FileSystemService'
import { ConfigService } from './ConfigService'
import { LockService } from './LockService'

/**
 * ProjectService
 *
 * Main service for project management.
 * Orchestrates FileSystemService, ConfigService, and LockService
 * to provide complete project CRUD operations.
 */
export class ProjectService {
  private activeProject: Project | null = null

  constructor(
    private fileSystemService: FileSystemService,
    private configService: ConfigService,
    private lockService: LockService
  ) {}

  /**
   * Creates a new project
   *
   * @param name - Project name
   * @param location - Parent directory for project
   * @param description - Optional project description
   * @returns Created project
   * @throws Error if project name is invalid or project already exists
   */
  async createProject(
    name: string,
    location: string,
    description?: string
  ): Promise<Project> {
    // Create project directory structure
    const projectDirectory = await this.fileSystemService.createProjectDirectory(
      location,
      name
    )

    // Create project object
    const project: Project = {
      id: uuidv4(),
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      projectDirectory,
      songs: [],
      mixMetadata: {
        tags: [],
      },
      isActive: true,
    }

    // Save project to disk
    const projectFilePath = path.join(projectDirectory, 'project.json')
    await this.fileSystemService.writeJsonFile(projectFilePath, project)

    // Acquire lock
    await this.lockService.acquireLock(project.id, projectDirectory)

    // Add to recent projects
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: 0,
    })

    // Set as active project
    this.activeProject = project

    return project
  }

  /**
   * Opens an existing project
   *
   * @param filePath - Path to project.json file
   * @returns Opened project
   * @throws Error if project is locked or file doesn't exist
   */
  async openProject(filePath: string): Promise<Project> {
    // Validate file exists
    await this.fileSystemService.validateFilePath(filePath)

    // Read project from disk
    const project = await this.fileSystemService.readJsonFile<Project>(filePath)

    // Convert date strings to Date objects
    project.createdAt = new Date(project.createdAt)
    project.updatedAt = new Date(project.updatedAt)
    project.songs = project.songs.map((song) => ({
      ...song,
      addedAt: new Date(song.addedAt),
    }))

    // Acquire lock
    await this.lockService.acquireLock(project.id, project.projectDirectory)

    // Update isActive
    project.isActive = true

    // Add to recent projects
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: project.songs.length,
      coverImagePath: project.mixMetadata.coverImagePath,
    })

    // Set as active project
    this.activeProject = project

    return project
  }

  /**
   * Saves the current project to disk
   *
   * @param project - Project to save
   * @throws Error if project directory doesn't exist
   */
  async saveProject(project: Project): Promise<void> {
    // Validate project directory exists
    const fs = await import('fs-extra')
    if (!await fs.pathExists(project.projectDirectory)) {
      throw new Error(`Project directory does not exist: ${project.projectDirectory}`)
    }

    // Update timestamp
    project.updatedAt = new Date()

    // Write to disk
    const projectFilePath = path.join(project.projectDirectory, 'project.json')
    await this.fileSystemService.writeJsonFile(projectFilePath, project)
  }

  /**
   * Closes a project
   * Saves the project and releases the lock
   *
   * @param projectId - Project ID to close
   */
  async closeProject(projectId: string): Promise<void> {
    if (this.activeProject && this.activeProject.id === projectId) {
      // Update isActive before saving
      this.activeProject.isActive = false

      // Save before closing
      await this.saveProject(this.activeProject)

      // Release lock
      await this.lockService.releaseLock(
        this.activeProject.id,
        this.activeProject.projectDirectory
      )

      // Clear active project
      this.activeProject = null
    }
  }

  /**
   * Adds a song to a project
   *
   * @param projectId - Project ID
   * @param request - Add song request with song details
   * @returns Added song
   * @throws Error if project not found
   */
  async addSong(
    projectId: string,
    request: Omit<AddSongRequest, 'projectId'>
  ): Promise<Song> {
    const project = this.getProjectById(projectId)

    // Create song object
    const song: Song = {
      id: uuidv4(),
      title: request.title,
      artist: request.metadata?.artist,
      album: request.metadata?.album,
      duration: request.metadata?.duration,
      format: request.metadata?.format,
      bitrate: request.metadata?.bitrate,
      sampleRate: request.metadata?.sampleRate,
      fileSize: request.metadata?.fileSize,
      downloadId: request.downloadId,
      externalFilePath: request.externalFilePath,
      localFilePath: undefined,
      addedAt: new Date(),
      order: request.order,
      metadata: request.metadata,
    }

    // Add to project
    project.songs.push(song)

    // Auto-save
    await this.saveProject(project)

    // Update recent projects
    this.updateRecentProject(project)

    return song
  }

  /**
   * Removes a song from a project
   *
   * @param projectId - Project ID
   * @param songId - Song ID to remove
   * @throws Error if project or song not found
   */
  async removeSong(projectId: string, songId: string): Promise<void> {
    const project = this.getProjectById(projectId)

    const songIndex = project.songs.findIndex((s) => s.id === songId)
    if (songIndex === -1) {
      throw new Error(`Song not found: ${songId}`)
    }

    // Remove song
    project.songs.splice(songIndex, 1)

    // Auto-save
    await this.saveProject(project)

    // Update recent projects
    this.updateRecentProject(project)
  }

  /**
   * Updates a song in a project
   *
   * @param projectId - Project ID
   * @param songId - Song ID to update
   * @param updates - Partial song updates
   * @throws Error if project or song not found
   */
  async updateSong(
    projectId: string,
    songId: string,
    updates: Partial<Omit<Song, 'id' | 'addedAt'>>
  ): Promise<void> {
    const project = this.getProjectById(projectId)

    const song = project.songs.find((s) => s.id === songId)
    if (!song) {
      throw new Error(`Song not found: ${songId}`)
    }

    // Apply updates
    Object.assign(song, updates)

    // Auto-save
    await this.saveProject(project)

    // Update recent projects
    this.updateRecentProject(project)
  }

  /**
   * Updates mix metadata for a project
   *
   * @param projectId - Project ID
   * @param metadata - Partial mix metadata updates
   * @throws Error if project not found
   */
  async updateMixMetadata(
    projectId: string,
    metadata: Partial<MixMetadata>
  ): Promise<void> {
    const project = this.getProjectById(projectId)

    // Apply updates
    Object.assign(project.mixMetadata, metadata)

    // Auto-save
    await this.saveProject(project)

    // Update recent projects
    this.updateRecentProject(project)
  }

  /**
   * Calculates statistics for a project
   *
   * @param projectId - Project ID
   * @returns Project statistics
   * @throws Error if project not found
   */
  async getProjectStats(projectId: string): Promise<ProjectStats> {
    const project = this.getProjectById(projectId)

    const stats: ProjectStats = {
      totalSongs: project.songs.length,
      totalDuration: 0,
      totalSize: 0,
      downloadedSongs: 0,
      externalSongs: 0,
      formatBreakdown: {},
    }

    for (const song of project.songs) {
      // Duration
      if (song.duration) {
        stats.totalDuration += song.duration
      }

      // Size
      if (song.fileSize) {
        stats.totalSize += song.fileSize
      }

      // Downloaded vs external
      if (song.downloadId) {
        stats.downloadedSongs++
      } else if (song.externalFilePath) {
        stats.externalSongs++
      }

      // Format breakdown
      if (song.format) {
        stats.formatBreakdown[song.format] =
          (stats.formatBreakdown[song.format] || 0) + 1
      }
    }

    return stats
  }

  /**
   * Gets the currently active project
   *
   * @returns Active project or null
   */
  getActiveProject(): Project | null {
    return this.activeProject
  }

  /**
   * Checks if there is an active project
   *
   * @returns True if active project exists
   */
  hasActiveProject(): boolean {
    return this.activeProject !== null
  }

  /**
   * Gets a project by ID
   * Currently only supports active project
   *
   * @param projectId - Project ID
   * @returns Project
   * @throws Error if project not found
   */
  private getProjectById(projectId: string): Project {
    if (!this.activeProject || this.activeProject.id !== projectId) {
      throw new Error(`Project not found: ${projectId}`)
    }
    return this.activeProject
  }

  /**
   * Updates recent project entry in config
   *
   * @param project - Project to update
   */
  private updateRecentProject(project: Project): void {
    this.configService.addRecentProject({
      projectId: project.id,
      projectName: project.name,
      projectDirectory: project.projectDirectory,
      lastOpened: new Date(),
      songCount: project.songs.length,
      coverImagePath: project.mixMetadata.coverImagePath,
    })
  }
}
