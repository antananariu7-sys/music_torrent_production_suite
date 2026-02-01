import { test as base, type Page, type ElectronApplication } from '@playwright/test';
import { launchElectronApp, closeElectronApp } from './electron-helpers';

/**
 * Custom fixtures for Electron testing
 */
type ElectronFixtures = {
  electronApp: ElectronApplication;
  window: Page;
};

/**
 * Extended test with Electron fixtures
 *
 * Usage:
 * import { test, expect } from './fixtures';
 *
 * test('my electron test', async ({ window, electronApp }) => {
 *   // window is the main Electron window
 *   // electronApp is the Electron application
 * });
 */
export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Launch Electron app before each test
    const { electronApp, window: _window } = await launchElectronApp();

    // Provide the app to the test
    await use(electronApp);

    // Close the app after the test
    await closeElectronApp(electronApp);
  },

  window: async ({ electronApp }, use) => {
    // Get the main window
    const window = await electronApp.firstWindow();

    // Provide the window to the test
    await use(window);
  },
});

export { expect } from '@playwright/test';
