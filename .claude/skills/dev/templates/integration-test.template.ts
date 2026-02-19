// tests/integration/ipc/{{FEATURE_NAME}}-handlers.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ipcMain } from 'electron'
import '../../../src/main/ipc/{{FEATURE_NAME}}-handlers'
import { services } from '../../../src/main/services'

/**
 * Integration tests for {{FEATURE_NAME}} IPC handlers
 *
 * Tests:
 * - IPC channel registration
 * - Input validation
 * - Service integration
 * - Event emission
 * - Error handling
 */

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}))

describe('{{FEATURE_NAME}} IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('{{CHANNEL_NAME}}:{{ACTION}}', () => {
    it('should handle request and return result', async () => {
      // Get the registered handler
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:{{ACTION}}'
      )
      expect(handleCall).toBeDefined()

      const handler = handleCall[1]
      const mockEvent = {
        sender: {
          send: vi.fn()
        }
      }

      // Arrange
      const {{INPUT_NAME}} = {
        {{PROPERTY_1}}: {{VALUE_1}},
        {{PROPERTY_2}}: {{VALUE_2}}
      }

      const {{EXPECTED_RESULT}} = {
        {{RESULT_PROPERTY_1}}: {{RESULT_VALUE_1}},
        {{RESULT_PROPERTY_2}}: {{RESULT_VALUE_2}}
      }

      vi.spyOn(services.{{SERVICE_NAME}}, '{{METHOD_NAME}}')
        .mockResolvedValue({{EXPECTED_RESULT}})

      // Act
      const result = await handler(mockEvent, {{INPUT_NAME}})

      // Assert
      expect(services.{{SERVICE_NAME}}.{{METHOD_NAME}})
        .toHaveBeenCalledWith({{INPUT_NAME}})
      expect(result).toEqual({{EXPECTED_RESULT}})
    })

    it('should validate input and reject invalid data', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:{{ACTION}}'
      )
      const handler = handleCall[1]
      const mockEvent = { sender: { send: vi.fn() } }

      // Invalid input (missing required fields)
      const {{INVALID_INPUT}} = {
        {{INVALID_PROPERTY}}: {{INVALID_VALUE}}
      }

      // Act & Assert
      await expect(handler(mockEvent, {{INVALID_INPUT}}))
        .rejects
        .toThrow()
    })

    it('should handle service errors', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:{{ACTION}}'
      )
      const handler = handleCall[1]
      const mockEvent = { sender: { send: vi.fn() } }

      const {{INPUT_NAME}} = {
        {{PROPERTY_1}}: {{VALUE_1}}
      }

      const error = new Error('{{SERVICE_ERROR_MESSAGE}}')
      vi.spyOn(services.{{SERVICE_NAME}}, '{{METHOD_NAME}}')
        .mockRejectedValue(error)

      // Act & Assert
      await expect(handler(mockEvent, {{INPUT_NAME}}))
        .rejects
        .toThrow('{{SERVICE_ERROR_MESSAGE}}')
    })
  })

  describe('{{CHANNEL_NAME}}:{{ACTION_WITH_EVENTS}}', () => {
    it('should emit progress events', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:{{ACTION_WITH_EVENTS}}'
      )
      const handler = handleCall[1]
      const mockEvent = {
        sender: {
          send: vi.fn()
        }
      }

      const {{INPUT_NAME}} = {
        {{PROPERTY_1}}: {{VALUE_1}}
      }

      // Mock service to emit progress
      vi.spyOn(services.{{SERVICE_NAME}}, '{{METHOD_WITH_PROGRESS}}')
        .mockImplementation(async (data, onProgress) => {
          // Simulate progress updates
          onProgress({ current: 1, total: 3 })
          onProgress({ current: 2, total: 3 })
          onProgress({ current: 3, total: 3 })

          return { success: true }
        })

      // Act
      const result = await handler(mockEvent, {{INPUT_NAME}})

      // Assert
      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        '{{CHANNEL_NAME}}:progress',
        expect.objectContaining({ current: 1, total: 3 })
      )
      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        '{{CHANNEL_NAME}}:progress',
        expect.objectContaining({ current: 2, total: 3 })
      )
      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        '{{CHANNEL_NAME}}:complete',
        expect.objectContaining({ success: true })
      )
    })

    it('should emit error events on failure', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:{{ACTION_WITH_EVENTS}}'
      )
      const handler = handleCall[1]
      const mockEvent = {
        sender: {
          send: vi.fn()
        }
      }

      const error = new Error('{{ERROR_MESSAGE}}')
      vi.spyOn(services.{{SERVICE_NAME}}, '{{METHOD_WITH_PROGRESS}}')
        .mockRejectedValue(error)

      // Act & Assert
      await expect(handler(mockEvent, {}))
        .rejects
        .toThrow('{{ERROR_MESSAGE}}')

      expect(mockEvent.sender.send).toHaveBeenCalledWith(
        '{{CHANNEL_NAME}}:error',
        expect.objectContaining({
          message: '{{ERROR_MESSAGE}}'
        })
      )
    })
  })

  describe('{{CHANNEL_NAME}}:get', () => {
    it('should return all items', async () => {
      const handleCall = (ipcMain.handle as any).mock.calls.find(
        (call) => call[0] === '{{CHANNEL_NAME}}:get'
      )
      const handler = handleCall[1]
      const mockEvent = { sender: { send: vi.fn() } }

      const {{ITEMS}} = [
        { id: '1', {{PROPERTY}}: {{VALUE_1}} },
        { id: '2', {{PROPERTY}}: {{VALUE_2}} }
      ]

      vi.spyOn(services.{{SERVICE_NAME}}, 'getAll')
        .mockResolvedValue({{ITEMS}})

      // Act
      const result = await handler(mockEvent)

      // Assert
      expect(result).toEqual({{ITEMS}})
      expect(services.{{SERVICE_NAME}}.getAll).toHaveBeenCalled()
    })
  })
})
