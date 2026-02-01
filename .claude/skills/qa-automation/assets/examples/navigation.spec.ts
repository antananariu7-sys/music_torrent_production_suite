import { test, expect } from '../utils/fixtures';
import { clickElement, waitForElement } from '../utils/test-helpers';

/**
 * Navigation and Window Management Tests
 *
 * This example demonstrates testing navigation flows and window management in Electron
 */

test.describe('Navigation', () => {
  test('should navigate between pages using menu', async ({ window }) => {
    // Start on home page
    await expect(window.locator('[data-testid="home-page"]')).toBeVisible();

    // Navigate to settings via menu
    await clickElement(window, '[data-testid="menu-settings"]');

    // Verify navigation
    await expect(window.locator('[data-testid="settings-page"]')).toBeVisible();
    await expect(window).toHaveURL(/.*settings/);
  });

  test('should navigate using breadcrumbs', async ({ window }) => {
    // Navigate to nested page
    await clickElement(window, '[data-testid="menu-projects"]');
    await clickElement(window, '[data-testid="project-1"]');
    await clickElement(window, '[data-testid="details-tab"]');

    // Use breadcrumbs to go back
    await clickElement(window, '[data-testid="breadcrumb-projects"]');

    // Verify we're back at projects page
    await expect(window.locator('[data-testid="projects-page"]')).toBeVisible();
  });

  test('should use browser back/forward navigation', async ({ window }) => {
    // Navigate forward through pages
    await clickElement(window, '[data-testid="menu-about"]');
    await expect(window.locator('[data-testid="about-page"]')).toBeVisible();

    await clickElement(window, '[data-testid="menu-help"]');
    await expect(window.locator('[data-testid="help-page"]')).toBeVisible();

    // Go back
    await window.goBack();
    await expect(window.locator('[data-testid="about-page"]')).toBeVisible();

    // Go forward
    await window.goForward();
    await expect(window.locator('[data-testid="help-page"]')).toBeVisible();
  });

  test('should open external link in new window', async ({ electronApp, window }) => {
    // Click link that opens in new window
    const [newWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      clickElement(window, '[data-testid="open-docs"]'),
    ]);

    // Verify new window opened
    await newWindow.waitForLoadState();
    await expect(newWindow).toHaveTitle(/Documentation/);

    // Close new window
    await newWindow.close();

    // Original window should still be open
    await expect(window.locator('[data-testid="home-page"]')).toBeVisible();
  });

  test('should handle deep linking', async ({ window }) => {
    // Navigate directly to deep link
    await window.goto('/projects/123/details');

    // Verify correct page loaded
    await expect(window.locator('[data-testid="project-details"]')).toBeVisible();
    await expect(
      window.locator('[data-testid="project-id"]')
    ).toContainText('123');
  });

  test('should maintain state during navigation', async ({ window }) => {
    // Set some state (e.g., fill a form)
    await clickElement(window, '[data-testid="menu-settings"]');
    await window.locator('[data-testid="theme-select"]').selectOption('dark');

    // Navigate away
    await clickElement(window, '[data-testid="menu-home"]');

    // Navigate back
    await clickElement(window, '[data-testid="menu-settings"]');

    // Verify state was maintained
    await expect(window.locator('[data-testid="theme-select"]')).toHaveValue(
      'dark'
    );
  });

  test('should handle navigation guard (confirm dialog)', async ({ window }) => {
    // Make changes that trigger unsaved warning
    await clickElement(window, '[data-testid="menu-editor"]');
    await window.locator('[data-testid="text-editor"]').fill('Unsaved content');

    // Try to navigate away
    const dialogPromise = window.waitForEvent('dialog');
    await clickElement(window, '[data-testid="menu-home"]');

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('unsaved changes');

    // Cancel navigation
    await dialog.dismiss();

    // Verify still on editor page
    await expect(window.locator('[data-testid="editor-page"]')).toBeVisible();
  });

  test('should handle keyboard shortcuts for navigation', async ({ window }) => {
    // Use keyboard shortcut to navigate
    await window.keyboard.press('Control+1'); // Go to first tab
    await expect(window.locator('[data-testid="tab-1"]')).toBeVisible();

    await window.keyboard.press('Control+2'); // Go to second tab
    await expect(window.locator('[data-testid="tab-2"]')).toBeVisible();

    await window.keyboard.press('Control+Tab'); // Next tab
    await expect(window.locator('[data-testid="tab-3"]')).toBeVisible();

    await window.keyboard.press('Control+Shift+Tab'); // Previous tab
    await expect(window.locator('[data-testid="tab-2"]')).toBeVisible();
  });

  test('should show loading state during navigation', async ({ window }) => {
    // Click link that takes time to load
    await clickElement(window, '[data-testid="menu-dashboard"]');

    // Should show loading indicator
    await expect(window.locator('[data-testid="loading"]')).toBeVisible();

    // Wait for page to load
    await window.waitForLoadState('networkidle');

    // Loading should be hidden
    await expect(window.locator('[data-testid="loading"]')).not.toBeVisible();
    await expect(window.locator('[data-testid="dashboard-page"]')).toBeVisible();
  });

  test('should handle 404/not found routes', async ({ window }) => {
    // Navigate to non-existent route
    await window.goto('/non-existent-page');

    // Should show 404 page
    await expect(window.locator('[data-testid="not-found"]')).toBeVisible();
    await expect(window.locator('text=Page Not Found')).toBeVisible();

    // Should have link back to home
    await clickElement(window, '[data-testid="back-to-home"]');
    await expect(window.locator('[data-testid="home-page"]')).toBeVisible();
  });
});
