import { test, expect } from '../utils/fixtures';
import { fillField, clickElement, waitForText } from '../utils/test-helpers';

/**
 * Authentication Flow Tests
 *
 * This example demonstrates testing user authentication flows in an Electron app
 */

test.describe('Authentication', () => {
  test('should login with valid credentials', async ({ window }) => {
    // Navigate to login page (adjust selector based on your app)
    await window.goto('/'); // or specific route if applicable

    // Fill in credentials
    await fillField(window, 'input[name="username"]', 'testuser');
    await fillField(window, 'input[name="password"]', 'password123');

    // Click login button
    await clickElement(window, 'button[type="submit"]');

    // Verify successful login - check for welcome message or dashboard
    await waitForText(window, 'Welcome', 10000);

    // Alternatively, check for URL change or specific element
    await expect(window.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ window }) => {
    await window.goto('/');

    // Fill in invalid credentials
    await fillField(window, 'input[name="username"]', 'invaliduser');
    await fillField(window, 'input[name="password"]', 'wrongpassword');

    // Submit form
    await clickElement(window, 'button[type="submit"]');

    // Check for error message
    await expect(window.locator('.error-message')).toBeVisible();
    await expect(window.locator('.error-message')).toContainText(
      'Invalid credentials'
    );
  });

  test('should logout successfully', async ({ window }) => {
    // First login
    await window.goto('/');
    await fillField(window, 'input[name="username"]', 'testuser');
    await fillField(window, 'input[name="password"]', 'password123');
    await clickElement(window, 'button[type="submit"]');
    await waitForText(window, 'Welcome');

    // Then logout
    await clickElement(window, 'button[data-testid="logout"]');

    // Verify returned to login page
    await expect(window.locator('input[name="username"]')).toBeVisible();
  });

  test('should persist session on app restart', async ({ electronApp }) => {
    // Login
    const window = await electronApp.firstWindow();
    await window.goto('/');
    await fillField(window, 'input[name="username"]', 'testuser');
    await fillField(window, 'input[name="password"]', 'password123');

    // Check "Remember me" option
    await clickElement(window, 'input[name="rememberMe"]');
    await clickElement(window, 'button[type="submit"]');

    // Close and reopen app (this depends on your test setup)
    // For this example, we'll just reload the window
    await window.reload();

    // Should still be logged in
    await expect(window.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should validate required fields', async ({ window }) => {
    await window.goto('/');

    // Try to submit without filling fields
    await clickElement(window, 'button[type="submit"]');

    // Check for validation messages
    await expect(window.locator('input[name="username"]:invalid')).toBeVisible();
    await expect(window.locator('input[name="password"]:invalid')).toBeVisible();
  });

  test('should handle password visibility toggle', async ({ window }) => {
    await window.goto('/');

    const passwordInput = window.locator('input[name="password"]');
    const toggleButton = window.locator('button[data-testid="toggle-password"]');

    // Password should be hidden by default
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
