import { test, expect } from '../utils/fixtures';
import { fillField, clickElement, selectOption, clearForm } from '../utils/test-helpers';

/**
 * Form Input and Validation Tests
 *
 * This example demonstrates testing forms, input validation, and data entry in Electron
 */

test.describe('Forms', () => {
  test('should submit form with valid data', async ({ window }) => {
    // Fill out form fields
    await fillField(window, 'input[name="firstName"]', 'John');
    await fillField(window, 'input[name="lastName"]', 'Doe');
    await fillField(window, 'input[name="email"]', 'john.doe@example.com');
    await fillField(window, 'input[name="phone"]', '555-1234');

    // Select dropdown
    await selectOption(window, 'select[name="country"]', 'USA');

    // Check checkbox
    await clickElement(window, 'input[name="agreeToTerms"]');

    // Submit form
    await clickElement(window, 'button[type="submit"]');

    // Verify success message
    await expect(window.locator('.success-message')).toBeVisible();
    await expect(window.locator('.success-message')).toContainText(
      'Form submitted successfully'
    );
  });

  test('should validate required fields', async ({ window }) => {
    // Try to submit empty form
    await clickElement(window, 'button[type="submit"]');

    // Check for validation errors
    await expect(window.locator('input[name="firstName"]:invalid')).toBeVisible();
    await expect(window.locator('input[name="email"]:invalid')).toBeVisible();

    // Error messages should be displayed
    await expect(
      window.locator('[data-testid="error-firstName"]')
    ).toContainText('First name is required');
  });

  test('should validate email format', async ({ window }) => {
    // Enter invalid email
    await fillField(window, 'input[name="email"]', 'invalid-email');
    await clickElement(window, 'button[type="submit"]');

    // Check for email validation error
    await expect(window.locator('[data-testid="error-email"]')).toBeVisible();
    await expect(window.locator('[data-testid="error-email"]')).toContainText(
      'Please enter a valid email'
    );

    // Fix email
    await fillField(window, 'input[name="email"]', 'valid@example.com');
    await expect(
      window.locator('[data-testid="error-email"]')
    ).not.toBeVisible();
  });

  test('should validate phone number format', async ({ window }) => {
    const phoneInput = window.locator('input[name="phone"]');

    // Test invalid formats
    await fillField(window, 'input[name="phone"]', '123');
    await phoneInput.blur();
    await expect(window.locator('[data-testid="error-phone"]')).toBeVisible();

    // Test valid format
    await fillField(window, 'input[name="phone"]', '555-123-4567');
    await phoneInput.blur();
    await expect(
      window.locator('[data-testid="error-phone"]')
    ).not.toBeVisible();
  });

  test('should handle auto-complete suggestions', async ({ window }) => {
    const addressInput = window.locator('input[name="address"]');

    // Type to trigger autocomplete
    await addressInput.fill('123 Main');

    // Wait for suggestions
    await expect(window.locator('[data-testid="autocomplete-list"]')).toBeVisible();

    // Select suggestion
    await clickElement(window, '[data-testid="suggestion-0"]');

    // Verify selection
    await expect(addressInput).toHaveValue('123 Main Street');
  });

  test('should clear form on reset', async ({ window }) => {
    // Fill form
    await fillField(window, 'input[name="firstName"]', 'John');
    await fillField(window, 'input[name="lastName"]', 'Doe');
    await fillField(window, 'input[name="email"]', 'john@example.com');

    // Reset form
    await clickElement(window, 'button[type="reset"]');

    // Verify all fields are cleared
    await expect(window.locator('input[name="firstName"]')).toHaveValue('');
    await expect(window.locator('input[name="lastName"]')).toHaveValue('');
    await expect(window.locator('input[name="email"]')).toHaveValue('');
  });

  test('should handle multi-step form', async ({ window }) => {
    // Step 1: Personal info
    await fillField(window, 'input[name="firstName"]', 'Jane');
    await fillField(window, 'input[name="lastName"]', 'Smith');
    await clickElement(window, 'button[data-testid="next-step"]');

    // Step 2: Contact info
    await expect(window.locator('[data-testid="step-2"]')).toBeVisible();
    await fillField(window, 'input[name="email"]', 'jane@example.com');
    await fillField(window, 'input[name="phone"]', '555-9876');
    await clickElement(window, 'button[data-testid="next-step"]');

    // Step 3: Review
    await expect(window.locator('[data-testid="step-3"]')).toBeVisible();
    await expect(window.locator('[data-testid="review-name"]')).toContainText(
      'Jane Smith'
    );

    // Go back to edit
    await clickElement(window, 'button[data-testid="back-step"]');
    await expect(window.locator('[data-testid="step-2"]')).toBeVisible();
  });

  test('should handle dynamic form fields', async ({ window }) => {
    // Add additional field
    await clickElement(window, 'button[data-testid="add-field"]');

    // New field should appear
    await expect(window.locator('input[name="dynamicField1"]')).toBeVisible();

    // Fill dynamic field
    await fillField(window, 'input[name="dynamicField1"]', 'Dynamic value');

    // Remove field
    await clickElement(window, 'button[data-testid="remove-field-1"]');

    // Field should be gone
    await expect(
      window.locator('input[name="dynamicField1"]')
    ).not.toBeVisible();
  });

  test('should save draft automatically', async ({ window }) => {
    // Fill form partially
    await fillField(window, 'input[name="title"]', 'My Draft');
    await fillField(window, 'textarea[name="content"]', 'Draft content');

    // Wait for auto-save
    await expect(window.locator('[data-testid="saved-indicator"]')).toBeVisible({
      timeout: 10000,
    });

    // Refresh page
    await window.reload();

    // Verify draft was restored
    await expect(window.locator('input[name="title"]')).toHaveValue('My Draft');
    await expect(window.locator('textarea[name="content"]')).toHaveValue(
      'Draft content'
    );
  });

  test('should handle file upload in form', async ({ window }) => {
    const testFilePath = './test-data/upload.txt';

    // Trigger file upload
    const [fileChooser] = await Promise.all([
      window.waitForEvent('filechooser'),
      clickElement(window, 'button[data-testid="upload-button"]'),
    ]);

    await fileChooser.setFiles(testFilePath);

    // Verify file name is displayed
    await expect(window.locator('[data-testid="file-name"]')).toContainText(
      'upload.txt'
    );

    // Submit form
    await clickElement(window, 'button[type="submit"]');

    // Verify file was uploaded
    await expect(window.locator('.success-message')).toContainText(
      'File uploaded successfully'
    );
  });

  test('should handle textarea character limit', async ({ window }) => {
    const textarea = window.locator('textarea[name="bio"]');
    const charCounter = window.locator('[data-testid="char-count"]');

    // Type content
    const content = 'A'.repeat(100);
    await textarea.fill(content);

    // Verify character count
    await expect(charCounter).toContainText('100 / 500');

    // Try to exceed limit
    const tooLong = 'A'.repeat(600);
    await textarea.fill(tooLong);

    // Should be truncated
    await expect(textarea).toHaveValue('A'.repeat(500));
    await expect(charCounter).toContainText('500 / 500');
  });

  test('should validate dependent fields', async ({ window }) => {
    // Select "Other" option
    await selectOption(window, 'select[name="category"]', 'other');

    // "Other" text field should appear and be required
    await expect(window.locator('input[name="otherCategory"]')).toBeVisible();

    // Try to submit without filling "other"
    await clickElement(window, 'button[type="submit"]');
    await expect(
      window.locator('[data-testid="error-otherCategory"]')
    ).toBeVisible();

    // Fill the dependent field
    await fillField(window, 'input[name="otherCategory"]', 'Custom category');

    // Error should clear
    await expect(
      window.locator('[data-testid="error-otherCategory"]')
    ).not.toBeVisible();
  });
});
