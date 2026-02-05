import * as fs from 'fs-extra'
import * as path from 'path'

/**
 * FileSystemService
 *
 * Handles all file system operations for the application.
 * Provides methods for creating directories, reading/writing files,
 * and validating file paths.
 */
export class FileSystemService {
  /**
   * Creates a project directory with all required subdirectories
   *
   * @param parentDir - Parent directory where project will be created
   * @param projectName - Name of the project
   * @returns Absolute path to the created project directory
   * @throws Error if parent directory doesn't exist or project already exists
   */
  async createProjectDirectory(parentDir: string, projectName: string): Promise<string> {
    // Validate project name
    if (!this.isValidFileName(projectName)) {
      throw new Error(`Invalid project name: ${projectName}. Name contains invalid characters.`)
    }

    // Check if parent directory exists
    if (!await fs.pathExists(parentDir)) {
      throw new Error(`Parent directory does not exist: ${parentDir}`)
    }

    const projectDir = path.join(parentDir, projectName)

    // Check if project directory already exists
    if (await fs.pathExists(projectDir)) {
      throw new Error(`Project directory already exists: ${projectDir}`)
    }

    // Create project directory structure
    await fs.ensureDir(projectDir)
    await fs.ensureDir(path.join(projectDir, 'assets'))
    await fs.ensureDir(path.join(projectDir, 'assets', 'covers'))
    await fs.ensureDir(path.join(projectDir, 'assets', 'audio'))

    return projectDir
  }

  /**
   * Validates that a file path exists and is a file (not a directory)
   *
   * @param filePath - Path to validate
   * @returns True if file exists and is a file
   * @throws Error if path is invalid, doesn't exist, or is a directory
   */
  async validateFilePath(filePath: string): Promise<boolean> {
    if (!filePath || filePath.trim() === '') {
      throw new Error('Invalid file path: path cannot be empty')
    }

    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }

    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`)
    }

    return true
  }

  /**
   * Ensures a directory exists, creating it if necessary
   *
   * @param dirPath - Directory path to ensure
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath)
  }

  /**
   * Copies a file from source to destination
   * Creates destination directory if it doesn't exist
   *
   * @param sourcePath - Source file path
   * @param destPath - Destination file path
   * @throws Error if source file doesn't exist
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`Source file does not exist: ${sourcePath}`)
    }

    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    await fs.ensureDir(destDir)

    // Copy file
    await fs.copy(sourcePath, destPath, { overwrite: true })
  }

  /**
   * Deletes a file
   * Does nothing if file doesn't exist
   *
   * @param filePath - Path to file to delete
   * @throws Error if path is a directory
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!await fs.pathExists(filePath)) {
      return // File doesn't exist, nothing to do
    }

    const stats = await fs.stat(filePath)
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`)
    }

    await fs.remove(filePath)
  }

  /**
   * Deletes a directory and all its contents
   * Does nothing if directory doesn't exist
   *
   * @param dirPath - Path to directory to delete
   * @throws Error if path is not a directory
   */
  async deleteDirectory(dirPath: string): Promise<void> {
    if (!await fs.pathExists(dirPath)) {
      return // Directory doesn't exist, nothing to do
    }

    const stats = await fs.stat(dirPath)
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`)
    }

    await fs.remove(dirPath)
  }

  /**
   * Reads and parses a JSON file
   *
   * @param filePath - Path to JSON file
   * @returns Parsed JSON object
   * @throws Error if file doesn't exist or contains invalid JSON
   */
  async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }

    try {
      return await fs.readJson(filePath)
    } catch (error) {
      throw new Error(`Invalid JSON in file: ${filePath}. ${error}`)
    }
  }

  /**
   * Writes an object to a JSON file
   * Creates directory if it doesn't exist
   * Formats JSON with 2-space indentation
   *
   * @param filePath - Path to JSON file
   * @param data - Data to write
   */
  async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.ensureDir(dir)

    // Write JSON with formatting
    await fs.writeJson(filePath, data, { spaces: 2 })
  }

  /**
   * Gets the size of a file in bytes
   *
   * @param filePath - Path to file
   * @returns File size in bytes
   * @throws Error if file doesn't exist
   */
  async getFileSize(filePath: string): Promise<number> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }

    const stats = await fs.stat(filePath)
    return stats.size
  }

  /**
   * Sanitizes a file name by removing invalid characters
   * and trimming whitespace
   *
   * @param fileName - File name to sanitize
   * @returns Sanitized file name
   */
  sanitizeFileName(fileName: string): string {
    // Remove invalid characters for Windows and Unix
    let sanitized = fileName.replace(/[<>:"/\\|?*]/g, '')

    // Trim whitespace
    sanitized = sanitized.trim()

    return sanitized
  }

  /**
   * Checks if a file name is valid (doesn't contain invalid characters)
   *
   * @param fileName - File name to validate
   * @returns True if valid, false otherwise
   */
  private isValidFileName(fileName: string): boolean {
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/
    return !invalidChars.test(fileName)
  }
}
