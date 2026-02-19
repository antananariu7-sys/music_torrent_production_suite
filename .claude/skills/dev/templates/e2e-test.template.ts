// tests/e2e/{{FEATURE_NAME}}-flow.spec.ts

import { test, expect, _electron as electron } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'

/**
 * E2E tests for {{FEATURE_DESCRIPTION}}
 *
 * User Journey:
 * 1. {{STEP_1}}
 * 2. {{STEP_2}}
 * 3. {{STEP_3}}
 * 4. {{STEP_4}}
 */

test.describe('{{FEATURE_NAME}} Flow', () => {
  let electronApp: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })

    // Get the first window
    window = await electronApp.firstWindow()

    // Wait for app to be ready
    await window.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp.close()
  })

  test.beforeEach(async () => {
    // Reset app state before each test
    await window.evaluate(() => {
      // Clear storage
      localStorage.clear()
      sessionStorage.clear()
    })

    // Navigate to starting page
    await window.click('[data-testid="nav-{{FEATURE_NAME}}"]')
  })

  test('should complete {{FEATURE_NAME}} flow successfully', async () => {
    // Step 1: {{STEP_1_DESCRIPTION}}
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INPUT_1_VALUE}}')
    await window.fill('[data-testid="{{INPUT_2}}"]', '{{INPUT_2_VALUE}}')

    // Verify input is filled
    await expect(window.locator('[data-testid="{{INPUT_1}}"]'))
      .toHaveValue('{{INPUT_1_VALUE}}')

    // Step 2: {{STEP_2_DESCRIPTION}}
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Wait for loading state
    await expect(window.locator('[data-testid="loading-indicator"]'))
      .toBeVisible()

    // Step 3: {{STEP_3_DESCRIPTION}}
    await window.waitForSelector('[data-testid="{{RESULTS_CONTAINER}}"]', {
      timeout: 10000
    })

    // Verify results are displayed
    const results = await window.locator('[data-testid="{{RESULT_ITEM}}"]')
    expect(await results.count()).toBeGreaterThan(0)

    // Step 4: {{STEP_4_DESCRIPTION}}
    await window.click('[data-testid="{{RESULT_ITEM}}"] >> nth=0')

    // Verify {{FINAL_STATE}}
    await expect(window.locator('[data-testid="{{SUCCESS_INDICATOR}}"]'))
      .toBeVisible()
  })

  test('should handle empty state', async () => {
    // Navigate to {{FEATURE_NAME}} page
    await window.click('[data-testid="nav-{{FEATURE_NAME}}"]')

    // Verify empty state message
    await expect(window.locator('[data-testid="empty-state"]'))
      .toBeVisible()

    await expect(window.locator('[data-testid="empty-state"]'))
      .toContainText('{{EMPTY_MESSAGE}}')
  })

  test('should handle errors gracefully', async () => {
    // Mock API error
    await window.evaluate(() => {
      window.api.{{API_METHOD}} = () =>
        Promise.reject(new Error('{{ERROR_MESSAGE}}'))
    })

    // Trigger action
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INPUT_1_VALUE}}')
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Verify error dialog appears
    await expect(window.locator('[data-testid="error-dialog"]'))
      .toBeVisible({ timeout: 5000 })

    // Verify error message
    await expect(window.locator('[data-testid="error-message"]'))
      .toContainText('{{ERROR_MESSAGE}}')

    // Close error dialog
    await window.click('[data-testid="error-dialog-close"]')

    await expect(window.locator('[data-testid="error-dialog"]'))
      .not.toBeVisible()
  })

  test('should allow retry after error', async () => {
    let attemptCount = 0

    // Mock API to fail first, then succeed
    await window.evaluate(() => {
      let count = 0
      const original = window.api.{{API_METHOD}}

      window.api.{{API_METHOD}} = async (data) => {
        count++
        if (count === 1) {
          throw new Error('Network error')
        }
        return original(data)
      }
    })

    // First attempt - should fail
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INPUT_1_VALUE}}')
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Error dialog appears
    await expect(window.locator('[data-testid="error-dialog"]'))
      .toBeVisible()

    // Click retry
    await window.click('[data-testid="error-retry-button"]')

    // Second attempt - should succeed
    await expect(window.locator('[data-testid="{{SUCCESS_INDICATOR}}"]'))
      .toBeVisible({ timeout: 10000 })
  })

  test('should validate input before submission', async () => {
    // Try to submit with invalid input
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INVALID_VALUE}}')
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Verify validation error
    await expect(window.locator('[data-testid="validation-error"]'))
      .toBeVisible()

    await expect(window.locator('[data-testid="validation-error"]'))
      .toContainText('{{VALIDATION_ERROR_MESSAGE}}')

    // Verify action was not executed
    await expect(window.locator('[data-testid="{{RESULTS_CONTAINER}}"]'))
      .not.toBeVisible()
  })

  test('should persist state across page navigation', async () => {
    // Perform action
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INPUT_1_VALUE}}')
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Wait for completion
    await window.waitForSelector('[data-testid="{{SUCCESS_INDICATOR}}"]')

    // Navigate away
    await window.click('[data-testid="nav-settings"]')
    await expect(window.locator('[data-testid="settings-page"]'))
      .toBeVisible()

    // Navigate back
    await window.click('[data-testid="nav-{{FEATURE_NAME}}"]')

    // Verify state persisted
    await expect(window.locator('[data-testid="{{SUCCESS_INDICATOR}}"]'))
      .toBeVisible()
  })

  test('should show progress during long operations', async () => {
    // Start long operation
    await window.fill('[data-testid="{{INPUT_1}}"]', '{{INPUT_1_VALUE}}')
    await window.click('[data-testid="{{ACTION_BUTTON}}"]')

    // Verify progress indicator appears
    await expect(window.locator('[data-testid="progress-bar"]'))
      .toBeVisible()

    // Verify progress updates
    await window.waitForFunction(() => {
      const progressText = document.querySelector('[data-testid="progress-text"]')?.textContent
      return progressText && parseInt(progressText) > 0
    })

    // Wait for completion
    await window.waitForSelector('[data-testid="{{SUCCESS_INDICATOR}}"]', {
      timeout: 30000
    })
  })
})
