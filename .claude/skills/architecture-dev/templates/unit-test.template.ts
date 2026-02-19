// tests/unit/{{TEST_PATH}}/{{FILE_NAME}}.spec.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { {{CLASS_NAME}} } from '../../../src/{{SOURCE_PATH}}/{{FILE_NAME}}'

/**
 * Unit tests for {{CLASS_NAME}}
 *
 * Tests:
 * - {{TEST_SCENARIO_1}}
 * - {{TEST_SCENARIO_2}}
 * - {{TEST_SCENARIO_3}}
 */

describe('{{CLASS_NAME}}', () => {
  let {{INSTANCE_NAME}}: {{CLASS_NAME}}
  let {{MOCK_DEPENDENCY_1}}: any
  let {{MOCK_DEPENDENCY_2}}: any

  beforeEach(() => {
    // Setup mocks
    {{MOCK_DEPENDENCY_1}} = {
      {{METHOD_NAME}}: vi.fn()
    }

    {{MOCK_DEPENDENCY_2}} = {
      {{METHOD_NAME}}: vi.fn()
    }

    // Create instance with mocked dependencies
    {{INSTANCE_NAME}} = new {{CLASS_NAME}}(
      {{MOCK_DEPENDENCY_1}},
      {{MOCK_DEPENDENCY_2}}
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('{{METHOD_NAME}}', () => {
    it('should {{EXPECTED_BEHAVIOR}}', async () => {
      // Arrange
      const {{INPUT_NAME}} = {{INPUT_VALUE}}
      const {{EXPECTED_OUTPUT}} = {{EXPECTED_VALUE}}

      {{MOCK_DEPENDENCY_1}}.{{METHOD_NAME}}.mockResolvedValue({{EXPECTED_OUTPUT}})

      // Act
      const result = await {{INSTANCE_NAME}}.{{METHOD_NAME}}({{INPUT_NAME}})

      // Assert
      expect(result).toEqual({{EXPECTED_OUTPUT}})
      expect({{MOCK_DEPENDENCY_1}}.{{METHOD_NAME}}).toHaveBeenCalledWith({{INPUT_NAME}})
      expect({{MOCK_DEPENDENCY_1}}.{{METHOD_NAME}}).toHaveBeenCalledTimes(1)
    })

    it('should handle errors when {{ERROR_SCENARIO}}', async () => {
      // Arrange
      const {{INPUT_NAME}} = {{INPUT_VALUE}}
      const error = new Error('{{ERROR_MESSAGE}}')

      {{MOCK_DEPENDENCY_1}}.{{METHOD_NAME}}.mockRejectedValue(error)

      // Act & Assert
      await expect({{INSTANCE_NAME}}.{{METHOD_NAME}}({{INPUT_NAME}}))
        .rejects
        .toThrow('{{ERROR_MESSAGE}}')

      expect({{MOCK_DEPENDENCY_2}}.{{ERROR_LOG_METHOD}})
        .toHaveBeenCalledWith(expect.stringContaining('{{ERROR_MESSAGE}}'))
    })

    it('should validate input and reject invalid data', async () => {
      // Arrange
      const {{INVALID_INPUT}} = {{INVALID_VALUE}}

      // Act & Assert
      await expect({{INSTANCE_NAME}}.{{METHOD_NAME}}({{INVALID_INPUT}}))
        .rejects
        .toThrow()
    })
  })

  describe('{{ANOTHER_METHOD}}', () => {
    it('should {{EXPECTED_BEHAVIOR}}', () => {
      // Arrange
      const {{INPUT_NAME}} = {{INPUT_VALUE}}

      // Act
      const result = {{INSTANCE_NAME}}.{{ANOTHER_METHOD}}({{INPUT_NAME}})

      // Assert
      expect(result).toBe({{EXPECTED_VALUE}})
    })
  })

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const result = await {{INSTANCE_NAME}}.{{METHOD_NAME}}([])
      expect(result).toEqual([])
    })

    it('should handle null values', async () => {
      const result = await {{INSTANCE_NAME}}.{{METHOD_NAME}}(null)
      expect(result).toBeNull()
    })

    it('should handle large datasets', async () => {
      const largeInput = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
      const result = await {{INSTANCE_NAME}}.{{METHOD_NAME}}(largeInput)
      expect(result).toHaveLength(1000)
    })
  })
})
