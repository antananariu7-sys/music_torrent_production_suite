import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'path';

/**
 * Launch Electron application for testing
 * @param executablePath - Path to the Electron executable or app entry point
 * @returns Object containing the Electron app and first window
 */
export async function launchElectronApp(
  executablePath: string = 'path/to/your/electron/main.js'
): Promise<{ electronApp: ElectronApplication; window: Page }> {
  const electronApp = await electron.launch({
    args: [executablePath],
    // Uncomment for debugging:
    // executablePath: require('electron'),
  });

  // Wait for the first window to open
  const window = await electronApp.firstWindow();

  // Wait for the app to be ready
  await window.waitForLoadState('domcontentloaded');

  return { electronApp, window };
}

/**
 * Close Electron application gracefully
 */
export async function closeElectronApp(electronApp: ElectronApplication): Promise<void> {
  await electronApp.close();
}

/**
 * Get app version from Electron app
 */
export async function getAppVersion(electronApp: ElectronApplication): Promise<string> {
  return await electronApp.evaluate(async ({ app }) => {
    return app.getVersion();
  });
}

/**
 * Get app path from Electron app
 */
export async function getAppPath(electronApp: ElectronApplication): Promise<string> {
  return await electronApp.evaluate(async ({ app }) => {
    return app.getAppPath();
  });
}

/**
 * Handle file dialog interactions
 * @param window - Playwright page object
 * @param filePath - Path to file for dialog
 */
export async function handleFileDialog(window: Page, filePath: string): Promise<void> {
  // Listen for file chooser event
  const [fileChooser] = await Promise.all([
    window.waitForEvent('filechooser'),
    // Trigger file dialog (this depends on your app's implementation)
    // window.click('button#open-file'),
  ]);

  await fileChooser.setFiles(filePath);
}

/**
 * Wait for IPC event from main process
 */
export async function waitForIPC(
  electronApp: ElectronApplication,
  channel: string,
  timeout: number = 5000
): Promise<any> {
  return await electronApp.evaluate(
    ({ ipcMain }, { channel, timeout }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout waiting for IPC event: ${channel}`));
        }, timeout);

        ipcMain.once(channel, (event, ...args) => {
          clearTimeout(timer);
          resolve(args);
        });
      });
    },
    { channel, timeout }
  );
}

/**
 * Take screenshot with custom name
 */
export async function takeScreenshot(
  window: Page,
  name: string,
  options?: { fullPage?: boolean }
): Promise<void> {
  await window.screenshot({
    path: `screenshots/${name}.png`,
    fullPage: options?.fullPage ?? false,
  });
}
