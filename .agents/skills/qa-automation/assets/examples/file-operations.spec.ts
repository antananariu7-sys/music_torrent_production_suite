import { test, expect } from '../utils/fixtures';
import { clickElement, waitForText } from '../utils/test-helpers';
import path from 'path';
import fs from 'fs/promises';

/**
 * File Operations Tests
 *
 * This example demonstrates testing file dialogs and file operations in Electron
 */

test.describe('File Operations', () => {
  test('should open file dialog and load file', async ({ window }) => {
    // Create a test file
    const testFilePath = path.join(__dirname, 'test-data', 'sample.txt');
    await fs.mkdir(path.dirname(testFilePath), { recursive: true });
    await fs.writeFile(testFilePath, 'Test content');

    // Click button that triggers file dialog
    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="open-file"]'),
    ]);

    // Select the test file
    await fileChooser.setFiles(testFilePath);

    // Verify file was loaded
    await waitForText(window, 'sample.txt');
    await expect(window.locator('[data-testid="file-content"]')).toContainText(
      'Test content'
    );

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should save file with save dialog', async ({ window }) => {
    const testContent = 'Content to save';
    const savePath = path.join(__dirname, 'test-output', 'saved-file.txt');

    // Enter content to save
    await window.locator('[data-testid="editor"]').fill(testContent);

    // Trigger save dialog
    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="save-file"]'),
    ]);

    await fileChooser.setFiles(savePath);

    // Wait for save confirmation
    await waitForText(window, 'File saved successfully');

    // Verify file was created
    const savedContent = await fs.readFile(savePath, 'utf-8');
    expect(savedContent).toBe(testContent);

    // Cleanup
    await fs.unlink(savePath);
  });

  test('should handle drag and drop file', async ({ window }) => {
    const testFilePath = path.join(__dirname, 'test-data', 'dropped.txt');
    await fs.mkdir(path.dirname(testFilePath), { recursive: true });
    await fs.writeFile(testFilePath, 'Dropped content');

    // Get the drop zone element
    const dropZone = window.locator('[data-testid="drop-zone"]');

    // Read file for drag-drop simulation
    const buffer = await fs.readFile(testFilePath);
    const dataTransfer = await window.evaluateHandle((data) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array(data)], 'dropped.txt', {
        type: 'text/plain',
      });
      dt.items.add(file);
      return dt;
    }, Array.from(buffer));

    // Trigger drop event
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // Verify file was processed
    await waitForText(window, 'dropped.txt');

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should handle multiple file selection', async ({ window }) => {
    // Create multiple test files
    const files = ['file1.txt', 'file2.txt', 'file3.txt'];
    const filePaths = await Promise.all(
      files.map(async (name) => {
        const filePath = path.join(__dirname, 'test-data', name);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, `Content of ${name}`);
        return filePath;
      })
    );

    // Open file dialog with multiple selection
    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="open-multiple"]'),
    ]);

    await fileChooser.setFiles(filePaths);

    // Verify all files were loaded
    for (const fileName of files) {
      await expect(window.locator(`text=${fileName}`)).toBeVisible();
    }

    // Cleanup
    await Promise.all(filePaths.map((fp) => fs.unlink(fp)));
  });

  test('should show error for unsupported file type', async ({ window }) => {
    const testFilePath = path.join(__dirname, 'test-data', 'invalid.exe');
    await fs.mkdir(path.dirname(testFilePath), { recursive: true });
    await fs.writeFile(testFilePath, 'fake exe content');

    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="open-file"]'),
    ]);

    await fileChooser.setFiles(testFilePath);

    // Should show error message
    await expect(window.locator('.error-message')).toBeVisible();
    await expect(window.locator('.error-message')).toContainText(
      'Unsupported file type'
    );

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should handle file path with spaces and special characters', async ({
    window,
  }) => {
    const fileName = 'test file (with spaces & special).txt';
    const testFilePath = path.join(__dirname, 'test-data', fileName);
    await fs.mkdir(path.dirname(testFilePath), { recursive: true });
    await fs.writeFile(testFilePath, 'Content with special path');

    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="open-file"]'),
    ]);

    await fileChooser.setFiles(testFilePath);

    // Verify file was loaded correctly
    await waitForText(window, fileName);

    // Cleanup
    await fs.unlink(testFilePath);
  });
});
