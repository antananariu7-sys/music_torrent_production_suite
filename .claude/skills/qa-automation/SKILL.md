---
name: qa-automation
description: Comprehensive Playwright-based e2e testing for Electron applications. Use when setting up test infrastructure, writing e2e tests for authentication, file operations, navigation, or forms, debugging failing tests, or when the user explicitly requests testing assistance. Specialized for Electron desktop applications with best practices for reliable, maintainable test automation.
---

# QA Automation - E2E Testing with Playwright for Electron

Guide for creating and maintaining e2e tests for Electron applications using Playwright.

## When to Use This Skill

- Setting up Playwright test infrastructure for Electron apps
- Writing new e2e tests for user flows (authentication, file operations, navigation, forms)
- Debugging flaky or failing tests
- Refactoring or improving existing test suites
- User explicitly requests "qa-automation" or testing help

## Quick Start

### 1. Setup Test Infrastructure

For a new project without Playwright:

1. Install dependencies:
   ```bash
   npm install --save-dev @playwright/test playwright
   ```

2. Copy configuration template from [assets/playwright.config.ts](assets/playwright.config.ts) to project root

3. Copy test utilities from [assets/utils/](assets/utils/) to your test directory:
   - `electron-helpers.ts` - Electron-specific utilities
   - `test-helpers.ts` - General test helpers
   - `fixtures.ts` - Custom Playwright fixtures

4. Create `e2e/` directory for test files

5. Update `package.json`:
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui",
       "test:e2e:debug": "playwright test --debug"
     }
   }
   ```

### 2. Write Tests

Use the provided examples as templates:

- **Authentication flows**: See [assets/examples/auth.spec.ts](assets/examples/auth.spec.ts)
- **File operations**: See [assets/examples/file-operations.spec.ts](assets/examples/file-operations.spec.ts)
- **Navigation patterns**: See [assets/examples/navigation.spec.ts](assets/examples/navigation.spec.ts)
- **Form testing**: See [assets/examples/forms.spec.ts](assets/examples/forms.spec.ts)

Basic test structure:
```typescript
import { test, expect } from '../utils/fixtures';

test.describe('Feature Name', () => {
  test('should do something', async ({ window, electronApp }) => {
    // window is the main Electron window
    // electronApp is the Electron application instance

    await window.click('[data-testid="button"]');
    await expect(window.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

### 3. Run Tests

```bash
# Run all tests
npm run test:e2e

# Run in UI mode (recommended for development)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test auth.spec.ts
```

## Core Principles

### Use Test IDs

Add `data-testid` attributes to elements you need to test:

```html
<button data-testid="submit-button">Submit</button>
<div data-testid="error-message">Error text</div>
```

Then select them in tests:
```typescript
await window.click('[data-testid="submit-button"]');
await expect(window.locator('[data-testid="error-message"]')).toBeVisible();
```

### Leverage Auto-Waiting

Playwright automatically waits for elements to be actionable. Avoid manual waits:

```typescript
// Good - Playwright waits automatically
await window.click('button');

// Bad - Unnecessary manual wait
await window.waitForTimeout(1000);
```

### Keep Tests Independent

Each test should set up its own state and clean up after itself:

```typescript
test('should edit item', async ({ window }) => {
  // Setup
  const itemId = await createTestItem();

  // Test
  await window.goto(`/items/${itemId}`);
  // ... test logic

  // Cleanup
  await deleteTestItem(itemId);
});
```

## Detailed References

For in-depth information, read the reference guides:

### Playwright with Electron
See [references/playwright-electron.md](references/playwright-electron.md) for:
- Launching Electron apps
- Working with multiple windows
- IPC communication
- File dialogs
- Main process testing
- Debugging techniques

### Best Practices
See [references/best-practices.md](references/best-practices.md) for:
- Test organization strategies
- Writing reliable, non-flaky tests
- Selector strategies
- Test data management
- Performance optimization
- Maintenance guidelines

## Common Patterns

### Custom Fixtures

Use the provided fixtures for automatic Electron app setup:

```typescript
import { test, expect } from './utils/fixtures';

test('my test', async ({ window, electronApp }) => {
  // App is automatically launched and window is provided
  // App is automatically closed after the test
});
```

### Helper Functions

Use provided helpers from `test-helpers.ts`:

```typescript
import { fillField, clickElement, waitForText } from './utils/test-helpers';

await fillField(window, 'input[name="email"]', 'user@example.com');
await clickElement(window, 'button[type="submit"]');
await waitForText(window, 'Welcome');
```

### Electron-Specific Helpers

Use Electron helpers from `electron-helpers.ts`:

```typescript
import { launchElectronApp, handleFileDialog, getAppVersion } from './utils/electron-helpers';

const version = await getAppVersion(electronApp);
await handleFileDialog(window, '/path/to/file.txt');
```

## Writing New Tests

1. **Identify the user flow** - What is the user trying to accomplish?

2. **Choose the appropriate example** - Start with the most similar example file

3. **Add test IDs to your app** - Add `data-testid` attributes to elements you'll interact with

4. **Write the test**:
   ```typescript
   test('should complete user flow', async ({ window }) => {
     // Navigate
     await window.goto('/feature');

     // Interact
     await window.click('[data-testid="action-button"]');

     // Assert
     await expect(window.locator('[data-testid="result"]')).toBeVisible();
   });
   ```

5. **Run and debug** - Use `--ui` mode for interactive debugging

6. **Make it reliable** - Remove manual waits, use proper selectors, handle edge cases

## Debugging Failing Tests

### Use Playwright UI Mode

```bash
npm run test:e2e:ui
```

This provides:
- Visual step-through debugging
- Time travel through test execution
- Screenshot and video playback
- Network inspection

### Enable Verbose Logging

```typescript
// Add console listeners to see app logs
window.on('console', (msg) => console.log('Browser:', msg.text()));
window.on('pageerror', (err) => console.error('Error:', err.message));
```

### Take Screenshots

```typescript
// Take screenshot at specific point
await window.screenshot({ path: 'debug.png' });

// Take screenshot on failure (add to test)
test('my test', async ({ window }, testInfo) => {
  try {
    // Test steps
  } catch (error) {
    await window.screenshot({
      path: `failures/${testInfo.title}.png`,
    });
    throw error;
  }
});
```

### Use Debug Mode

```bash
npx playwright test --debug
```

Opens Playwright Inspector for step-by-step execution.

## Configuration Updates

The provided `playwright.config.ts` template includes sensible defaults. Customize as needed:

- **Test directory**: Change `testDir` if tests are not in `./e2e`
- **Timeout**: Adjust `timeout` for slower operations
- **Retries**: Increase `retries` for CI environments
- **Viewport**: Change viewport size to match your app's window size
- **Video/Screenshots**: Configure capture settings for debugging

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

## Tips for Success

1. **Start small** - Write tests for critical user flows first
2. **Use the examples** - Copy and adapt the provided example tests
3. **Add test IDs early** - It's easier than retrofitting selectors later
4. **Run tests frequently** - Catch issues early during development
5. **Keep tests focused** - One test should verify one behavior
6. **Review best practices** - Read [best-practices.md](references/best-practices.md) regularly
7. **Debug systematically** - Use UI mode and screenshots to understand failures
