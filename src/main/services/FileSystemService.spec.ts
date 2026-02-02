import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { FileSystemService } from './FileSystemService'

describe('FileSystemService', () => {
  let fileSystemService: FileSystemService
  let testDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    testDir = path.join(os.tmpdir(), `music-suite-test-${Date.now()}`)
    await fs.ensureDir(testDir)

    fileSystemService = new FileSystemService()
  })

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir)
    }
  })

  describe('createProjectDirectory', () => {
    it('should create project directory with all required subdirectories', async () => {
      const projectName = 'TestProject'
      const projectDir = await fileSystemService.createProjectDirectory(testDir, projectName)

      // Verify main directory exists
      expect(await fs.pathExists(projectDir)).toBe(true)
      expect(path.basename(projectDir)).toBe(projectName)

      // Verify subdirectories exist
      const assetsDir = path.join(projectDir, 'assets')
      const coversDir = path.join(projectDir, 'assets', 'covers')
      const audioDir = path.join(projectDir, 'assets', 'audio')

      expect(await fs.pathExists(assetsDir)).toBe(true)
      expect(await fs.pathExists(coversDir)).toBe(true)
      expect(await fs.pathExists(audioDir)).toBe(true)
    })

    it('should return absolute path to project directory', async () => {
      const projectDir = await fileSystemService.createProjectDirectory(testDir, 'TestProject')

      expect(path.isAbsolute(projectDir)).toBe(true)
    })

    it('should throw error if parent directory does not exist', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent', 'path')

      await expect(
        fileSystemService.createProjectDirectory(nonExistentDir, 'TestProject')
      ).rejects.toThrow()
    })

    it('should throw error if project directory already exists', async () => {
      const projectName = 'ExistingProject'
      await fileSystemService.createProjectDirectory(testDir, projectName)

      await expect(
        fileSystemService.createProjectDirectory(testDir, projectName)
      ).rejects.toThrow(/already exists/i)
    })

    it('should sanitize project name to prevent invalid characters', async () => {
      const invalidName = 'Test<Project>Name'

      await expect(
        fileSystemService.createProjectDirectory(testDir, invalidName)
      ).rejects.toThrow(/invalid/i)
    })
  })

  describe('validateFilePath', () => {
    it('should return true for existing file', async () => {
      const testFile = path.join(testDir, 'test.txt')
      await fs.writeFile(testFile, 'test content')

      const result = await fileSystemService.validateFilePath(testFile)
      expect(result).toBe(true)
    })

    it('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt')

      await expect(
        fileSystemService.validateFilePath(nonExistentFile)
      ).rejects.toThrow(/does not exist/i)
    })

    it('should throw error for directory path', async () => {
      await expect(
        fileSystemService.validateFilePath(testDir)
      ).rejects.toThrow(/not a file/i)
    })

    it('should throw error for empty path', async () => {
      await expect(
        fileSystemService.validateFilePath('')
      ).rejects.toThrow(/invalid/i)
    })
  })

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'new-directory')

      await fileSystemService.ensureDirectory(newDir)

      expect(await fs.pathExists(newDir)).toBe(true)
      const stats = await fs.stat(newDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should not throw error if directory already exists', async () => {
      const existingDir = path.join(testDir, 'existing')
      await fs.ensureDir(existingDir)

      await expect(
        fileSystemService.ensureDirectory(existingDir)
      ).resolves.not.toThrow()
    })

    it('should create nested directories', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3')

      await fileSystemService.ensureDirectory(nestedDir)

      expect(await fs.pathExists(nestedDir)).toBe(true)
    })
  })

  describe('copyFile', () => {
    it('should copy file to destination', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destFile = path.join(testDir, 'dest.txt')
      const content = 'test content'

      await fs.writeFile(sourceFile, content)
      await fileSystemService.copyFile(sourceFile, destFile)

      expect(await fs.pathExists(destFile)).toBe(true)
      const copiedContent = await fs.readFile(destFile, 'utf-8')
      expect(copiedContent).toBe(content)
    })

    it('should create destination directory if it does not exist', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destDir = path.join(testDir, 'new-dir')
      const destFile = path.join(destDir, 'dest.txt')

      await fs.writeFile(sourceFile, 'content')
      await fileSystemService.copyFile(sourceFile, destFile)

      expect(await fs.pathExists(destFile)).toBe(true)
    })

    it('should throw error if source file does not exist', async () => {
      const sourceFile = path.join(testDir, 'nonexistent.txt')
      const destFile = path.join(testDir, 'dest.txt')

      await expect(
        fileSystemService.copyFile(sourceFile, destFile)
      ).rejects.toThrow()
    })

    it('should overwrite destination file if it exists', async () => {
      const sourceFile = path.join(testDir, 'source.txt')
      const destFile = path.join(testDir, 'dest.txt')

      await fs.writeFile(sourceFile, 'new content')
      await fs.writeFile(destFile, 'old content')

      await fileSystemService.copyFile(sourceFile, destFile)

      const content = await fs.readFile(destFile, 'utf-8')
      expect(content).toBe('new content')
    })
  })

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const testFile = path.join(testDir, 'to-delete.txt')
      await fs.writeFile(testFile, 'content')

      await fileSystemService.deleteFile(testFile)

      expect(await fs.pathExists(testFile)).toBe(false)
    })

    it('should not throw error if file does not exist', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt')

      await expect(
        fileSystemService.deleteFile(nonExistentFile)
      ).resolves.not.toThrow()
    })

    it('should throw error when trying to delete directory', async () => {
      const dirPath = path.join(testDir, 'directory')
      await fs.ensureDir(dirPath)

      await expect(
        fileSystemService.deleteFile(dirPath)
      ).rejects.toThrow(/not a file/i)
    })
  })

  describe('readJsonFile', () => {
    it('should read and parse JSON file', async () => {
      const jsonFile = path.join(testDir, 'data.json')
      const data = { name: 'Test', value: 123 }
      await fs.writeJson(jsonFile, data)

      const result = await fileSystemService.readJsonFile(jsonFile)

      expect(result).toEqual(data)
    })

    it('should throw error for invalid JSON', async () => {
      const jsonFile = path.join(testDir, 'invalid.json')
      await fs.writeFile(jsonFile, 'invalid json content')

      await expect(
        fileSystemService.readJsonFile(jsonFile)
      ).rejects.toThrow()
    })

    it('should throw error for non-existent file', async () => {
      const jsonFile = path.join(testDir, 'nonexistent.json')

      await expect(
        fileSystemService.readJsonFile(jsonFile)
      ).rejects.toThrow()
    })
  })

  describe('writeJsonFile', () => {
    it('should write object as JSON file', async () => {
      const jsonFile = path.join(testDir, 'output.json')
      const data = { name: 'Test', value: 456 }

      await fileSystemService.writeJsonFile(jsonFile, data)

      expect(await fs.pathExists(jsonFile)).toBe(true)
      const content = await fs.readJson(jsonFile)
      expect(content).toEqual(data)
    })

    it('should create directory if it does not exist', async () => {
      const newDir = path.join(testDir, 'new-dir')
      const jsonFile = path.join(newDir, 'output.json')
      const data = { test: true }

      await fileSystemService.writeJsonFile(jsonFile, data)

      expect(await fs.pathExists(jsonFile)).toBe(true)
    })

    it('should format JSON with indentation', async () => {
      const jsonFile = path.join(testDir, 'formatted.json')
      const data = { name: 'Test', nested: { value: 123 } }

      await fileSystemService.writeJsonFile(jsonFile, data)

      const rawContent = await fs.readFile(jsonFile, 'utf-8')
      expect(rawContent).toContain('  ') // Should have indentation
    })

    it('should overwrite existing file', async () => {
      const jsonFile = path.join(testDir, 'overwrite.json')
      await fs.writeJson(jsonFile, { old: 'data' })

      const newData = { new: 'data' }
      await fileSystemService.writeJsonFile(jsonFile, newData)

      const content = await fs.readJson(jsonFile)
      expect(content).toEqual(newData)
    })
  })

  describe('getFileSize', () => {
    it('should return file size in bytes', async () => {
      const testFile = path.join(testDir, 'sizefile.txt')
      const content = 'test content'
      await fs.writeFile(testFile, content)

      const size = await fileSystemService.getFileSize(testFile)

      expect(size).toBe(Buffer.byteLength(content))
    })

    it('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.txt')

      await expect(
        fileSystemService.getFileSize(nonExistentFile)
      ).rejects.toThrow()
    })
  })

  describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
      const invalidName = 'file<name>with:invalid|chars'
      const sanitized = fileSystemService.sanitizeFileName(invalidName)

      expect(sanitized).not.toMatch(/[<>:"|?*]/)
    })

    it('should preserve valid characters', () => {
      const validName = 'ValidFileName123_-'
      const sanitized = fileSystemService.sanitizeFileName(validName)

      expect(sanitized).toBe(validName)
    })

    it('should handle empty string', () => {
      const sanitized = fileSystemService.sanitizeFileName('')

      expect(sanitized).toBe('')
    })

    it('should remove leading and trailing spaces', () => {
      const name = '  filename  '
      const sanitized = fileSystemService.sanitizeFileName(name)

      expect(sanitized).toBe('filename')
    })
  })
})
