# TDD Workflow Example

This example demonstrates implementing a new feature using Test-Driven Development: **Export Search Results to CSV**.

## Feature Requirements

- User can export search results to a CSV file
- Include columns: title, url, torrentUrl, size, seeders, leechers
- Allow choosing save location
- Show success/error notifications

## TDD Implementation Steps

### Step 1: Write the Service Test (RED)

```typescript
// tests/unit/services/export.service.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExportService } from '../../../src/main/services/export.service'
import type { SearchResult } from '../../../src/shared/types/search.types'

describe('ExportService', () => {
  let exportService: ExportService
  let mockLogger: any
  let mockDialog: any
  let mockFs: any

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn()
    }
    mockDialog = {
      showSaveDialog: vi.fn()
    }
    mockFs = {
      writeFile: vi.fn()
    }

    exportService = new ExportService(mockLogger, mockDialog, mockFs)
  })

  describe('exportToCSV', () => {
    it('should convert search results to CSV and save to file', async () => {
      // Arrange
      const results: SearchResult[] = [
        {
          id: '1',
          title: 'Track 1',
          url: 'http://example.com/1',
          torrentUrl: 'magnet:1',
          size: '100MB',
          seeders: 10,
          leechers: 2,
          uploadDate: '2024-01-01'
        },
        {
          id: '2',
          title: 'Track 2',
          url: 'http://example.com/2',
          torrentUrl: 'magnet:2',
          size: '150MB',
          seeders: 20,
          leechers: 5,
          uploadDate: '2024-01-02'
        }
      ]

      const savePath = '/path/to/export.csv'
      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: savePath
      })
      mockFs.writeFile.mockResolvedValue(undefined)

      // Act
      const result = await exportService.exportToCSV(results)

      // Assert
      expect(mockDialog.showSaveDialog).toHaveBeenCalledWith({
        title: 'Export Search Results',
        defaultPath: 'search-results.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        savePath,
        expect.stringContaining('title,url,torrentUrl,size,seeders,leechers'),
        'utf-8'
      )

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        savePath,
        expect.stringContaining('Track 1'),
        'utf-8'
      )

      expect(result).toEqual({
        success: true,
        filePath: savePath,
        rowCount: 2
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Exported 2 results')
      )
    })

    it('should return canceled when user cancels dialog', async () => {
      // Arrange
      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: true
      })

      // Act
      const result = await exportService.exportToCSV([])

      // Assert
      expect(result).toEqual({
        success: false,
        canceled: true
      })
      expect(mockFs.writeFile).not.toHaveBeenCalled()
    })

    it('should handle file write errors', async () => {
      // Arrange
      const results: SearchResult[] = [
        {
          id: '1',
          title: 'Track 1',
          url: 'http://example.com/1',
          torrentUrl: 'magnet:1',
          size: '100MB',
          seeders: 10,
          leechers: 2,
          uploadDate: '2024-01-01'
        }
      ]

      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/path/to/export.csv'
      })

      const error = new Error('Permission denied')
      mockFs.writeFile.mockRejectedValue(error)

      // Act & Assert
      await expect(exportService.exportToCSV(results)).rejects.toThrow(
        'Permission denied'
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to export')
      )
    })

    it('should escape CSV special characters', async () => {
      // Arrange
      const results: SearchResult[] = [
        {
          id: '1',
          title: 'Track with "quotes" and, commas',
          url: 'http://example.com/1',
          torrentUrl: 'magnet:1',
          size: '100MB',
          seeders: 10,
          leechers: 2,
          uploadDate: '2024-01-01'
        }
      ]

      mockDialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/path/to/export.csv'
      })
      mockFs.writeFile.mockResolvedValue(undefined)

      // Act
      await exportService.exportToCSV(results)

      // Assert - should wrap in quotes when contains special chars
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/export.csv',
        expect.stringContaining('"Track with ""quotes"" and, commas"'),
        'utf-8'
      )
    })
  })
})
```

### Step 2: Implement the Service (GREEN)

```typescript
// src/main/services/export.service.ts
import { dialog } from 'electron'
import * as fs from 'fs/promises'
import type { SearchResult } from '../../shared/types/search.types'
import { LoggerService } from './logger.service'

export interface ExportResult {
  success: boolean
  filePath?: string
  rowCount?: number
  canceled?: boolean
}

export class ExportService {
  constructor(
    private logger: LoggerService,
    private dialogService = dialog,
    private fsService = fs
  ) {}

  async exportToCSV(results: SearchResult[]): Promise<ExportResult> {
    try {
      // Show save dialog
      const { canceled, filePath } = await this.dialogService.showSaveDialog({
        title: 'Export Search Results',
        defaultPath: 'search-results.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      })

      if (canceled || !filePath) {
        return { success: false, canceled: true }
      }

      // Convert to CSV
      const csv = this.convertToCSV(results)

      // Write to file
      await this.fsService.writeFile(filePath, csv, 'utf-8')

      this.logger.info(`Exported ${results.length} results to ${filePath}`)

      return {
        success: true,
        filePath,
        rowCount: results.length
      }
    } catch (error) {
      this.logger.error(`Failed to export results: ${error.message}`)
      throw error
    }
  }

  private convertToCSV(results: SearchResult[]): string {
    // CSV header
    const header = 'title,url,torrentUrl,size,seeders,leechers'

    // CSV rows
    const rows = results.map((result) => {
      return [
        this.escapeCSV(result.title),
        this.escapeCSV(result.url),
        this.escapeCSV(result.torrentUrl),
        this.escapeCSV(result.size),
        result.seeders.toString(),
        result.leechers.toString()
      ].join(',')
    })

    return [header, ...rows].join('\n')
  }

  private escapeCSV(value: string): string {
    // If contains quotes, commas, or newlines, wrap in quotes and escape quotes
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }
}
```

**Run Tests → All tests pass ✅**

### Step 3: Refactor (if needed)

The code is clean and follows SOLID principles. No refactoring needed.

### Step 4: Write IPC Handler Test (RED)

```typescript
// tests/integration/ipc/export-handlers.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ipcMain } from 'electron'
import '../../../src/main/ipc/export-handlers'
import { services } from '../../../src/main/services'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}))

describe('Export IPC Handlers', () => {
  describe('export:csv', () => {
    it('should export results to CSV', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === 'export:csv'
      )
      const handler = handleCall[1]
      const mockEvent = { sender: { send: vi.fn() } }

      const results = [
        {
          id: '1',
          title: 'Track 1',
          url: 'http://ex.com/1',
          torrentUrl: 'magnet:1',
          size: '100MB',
          seeders: 10,
          leechers: 2,
          uploadDate: '2024-01-01'
        }
      ]

      vi.spyOn(services.export, 'exportToCSV').mockResolvedValue({
        success: true,
        filePath: '/path/to/export.csv',
        rowCount: 1
      })

      const result = await handler(mockEvent, { results })

      expect(services.export.exportToCSV).toHaveBeenCalledWith(results)
      expect(result.success).toBe(true)
    })
  })
})
```

### Step 5: Implement IPC Handler (GREEN)

```typescript
// src/main/ipc/export-handlers.ts
import { ipcMain } from 'electron'
import { services } from '../services'
import { z } from 'zod'
import { SearchResultSchema } from '../../shared/schemas/search.schema'

const ExportRequestSchema = z.object({
  results: z.array(SearchResultSchema)
})

ipcMain.handle('export:csv', async (event, data) => {
  const validated = ExportRequestSchema.parse(data)
  return await services.export.exportToCSV(validated.results)
})
```

**Run Tests → All tests pass ✅**

### Step 6: Write Component Test (RED)

```typescript
// tests/unit/components/ExportButton.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ExportButton } from '../../../src/renderer/components/features/SearchResults/ExportButton'

describe('ExportButton', () => {
  it('should export results when clicked', async () => {
    const results = [
      {
        id: '1',
        title: 'Track 1',
        url: 'http://ex.com/1',
        torrentUrl: 'magnet:1',
        size: '100MB',
        seeders: 10,
        leechers: 2,
        uploadDate: '2024-01-01'
      }
    ]

    const mockExport = vi.fn().mockResolvedValue({
      success: true,
      filePath: '/path/to/export.csv',
      rowCount: 1
    })

    window.api = {
      exportToCSV: mockExport
    }

    render(<ExportButton results={results} />)

    const button = screen.getByRole('button', { name: /export to csv/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockExport).toHaveBeenCalledWith({ results })
    })

    expect(screen.getByText(/exported successfully/i)).toBeInTheDocument()
  })

  it('should show error message on failure', async () => {
    const results = [{ id: '1', title: 'Track 1' }]

    window.api = {
      exportToCSV: vi.fn().mockRejectedValue(new Error('Export failed'))
    }

    render(<ExportButton results={results} />)

    const button = screen.getByRole('button', { name: /export to csv/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/export failed/i)).toBeInTheDocument()
    })
  })

  it('should be disabled when no results', () => {
    render(<ExportButton results={[]} />)

    const button = screen.getByRole('button', { name: /export to csv/i })
    expect(button).toBeDisabled()
  })
})
```

### Step 7: Implement Component (GREEN)

```typescript
// src/renderer/components/features/SearchResults/ExportButton.tsx
import { useState } from 'react'
import type { SearchResult } from '../../../../shared/types/search.types'

interface ExportButtonProps {
  results: SearchResult[]
}

export function ExportButton({ results }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setMessage(null)

    try {
      const result = await window.api.exportToCSV({ results })

      if (result.success) {
        setMessage(`Exported successfully to ${result.filePath}`)
      } else if (result.canceled) {
        setMessage(null)
      }
    } catch (error) {
      setMessage(`Export failed: ${error.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleExport}
        disabled={results.length === 0 || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export to CSV'}
      </button>

      {message && <p className="export-message">{message}</p>}
    </div>
  )
}
```

**Run Tests → All tests pass ✅**

### Step 8: Add to Preload Script

```typescript
// src/preload/index.ts
const api = {
  // ... other APIs

  exportToCSV: (data: { results: SearchResult[] }) =>
    ipcRenderer.invoke('export:csv', data)
}
```

## TDD Benefits Demonstrated

1. **Tests guide implementation**: Tests define the API before code exists
2. **Confidence**: 100% test coverage because tests came first
3. **Better design**: Dependency injection makes testing easy
4. **Documentation**: Tests serve as usage examples
5. **Regression prevention**: Future changes won't break this feature

## Summary

This TDD workflow demonstrates:
- Writing tests first (RED)
- Implementing minimal code to pass (GREEN)
- Refactoring while tests stay green
- Layer-by-layer testing (Service → IPC → Component)
- Complete test coverage from the start
