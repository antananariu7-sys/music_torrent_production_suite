# E2E Testing Best Practices

## Table of Contents

1. [Test Organization](#test-organization)
2. [Writing Reliable Tests](#writing-reliable-tests)
3. [Selector Strategies](#selector-strategies)
4. [Test Data Management](#test-data-management)
5. [Assertions](#assertions)
6. [Error Handling](#error-handling)
7. [Performance](#performance)
8. [Maintenance](#maintenance)

## Test Organization

### File Structure

```
e2e/
├── fixtures/          # Custom fixtures and test setup
├── utils/             # Helper functions
├── tests/             # Test files organized by feature
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── logout.spec.ts
│   ├── forms/
│   │   └── user-form.spec.ts
│   └── navigation/
│       └── menu.spec.ts
└── playwright.config.ts
```

### Naming Conventions

- **Test files**: `feature-name.spec.ts` or `feature-name.test.ts`
- **Test descriptions**: Use clear, descriptive names that explain what is being tested
- **Variables**: Use meaningful names that describe the element or data

```typescript
// Good
test('should display error message when login fails', async ({ window }) => {
  // ...
});

// Bad
test('test1', async ({ window }) => {
  // ...
});
```

### Group Related Tests

```typescript
test.describe('User Authentication', () => {
  test.beforeEach(async ({ window }) => {
    // Common setup for all auth tests
    await window.goto('/login');
  });

  test('should login with valid credentials', async ({ window }) => {
    // ...
  });

  test('should show error with invalid credentials', async ({ window }) => {
    // ...
  });
});
```

## Writing Reliable Tests

### Use Playwright's Auto-Waiting

Playwright automatically waits for elements to be actionable. Don't add unnecessary waits.

```typescript
// Good - Playwright waits automatically
await window.click('button#submit');

// Bad - Unnecessary manual wait
await window.waitForTimeout(3000);
await window.click('button#submit');
```

### Wait for Specific Conditions

When you do need to wait, wait for specific conditions, not arbitrary timeouts.

```typescript
// Good
await window.waitForSelector('[data-testid="results"]');
await window.waitForLoadState('networkidle');

// Bad
await window.waitForTimeout(5000);
```

### Avoid Test Interdependence

Each test should be independent and not rely on other tests.

```typescript
// Bad - Tests depend on execution order
test('create user', async ({ window }) => {
  // Creates user with ID 123
});

test('edit user', async ({ window }) => {
  // Assumes user 123 exists from previous test
});

// Good - Each test is independent
test('create user', async ({ window }) => {
  const userId = await createTestUser();
  // Test with this user
  await deleteTestUser(userId);
});

test('edit user', async ({ window }) => {
  const userId = await createTestUser();
  // Test editing this user
  await deleteTestUser(userId);
});
```

### Handle Flaky Tests

Flaky tests undermine confidence in your test suite.

```typescript
// Use retry-until-success pattern for flaky operations
async function waitForStableElement(page: Page, selector: string) {
  await page.waitForSelector(selector);
  // Wait for element to stop moving (for animations)
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const rect1 = el.getBoundingClientRect();
      return new Promise((resolve) => {
        setTimeout(() => {
          const rect2 = el.getBoundingClientRect();
          resolve(rect1.top === rect2.top && rect1.left === rect2.left);
        }, 100);
      });
    },
    selector
  );
}
```

## Selector Strategies

### Priority Order for Selectors

1. **data-testid attributes** (best for testing)
2. **Role and accessible name** (good for accessibility)
3. **Text content** (readable but can be fragile)
4. **CSS selectors** (fragile, avoid IDs and classes that might change)
5. **XPath** (last resort, very fragile)

### Use data-testid Attributes

```typescript
// Best - Explicit test identifiers
await window.click('[data-testid="submit-button"]');

// Good - Role-based selectors
await window.click('button:has-text("Submit")');

// Acceptable - Semantic selectors
await window.click('button[type="submit"]');

// Avoid - Brittle selectors
await window.click('#btn-123');
await window.click('.btn.btn-primary.active');
```

### Make Selectors Resilient

```typescript
// Good - Flexible text matching
await window.click('button:has-text("Save")');

// Better - Regex for flexibility
await window.click('button:text-matches("Save|Saving...")');

// Best - Test ID
await window.click('[data-testid="save-button"]');
```

## Test Data Management

### Use Factories for Test Data

```typescript
// Create reusable test data factories
function createUserData(overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
    ...overrides,
  };
}

test('should create user', async ({ window }) => {
  const userData = createUserData({ firstName: 'John' });
  // Use userData in test
});
```

### Clean Up Test Data

```typescript
test('should handle user deletion', async ({ window }) => {
  // Setup
  const userId = await createTestUser();

  try {
    // Test
    await window.goto(`/users/${userId}`);
    await window.click('[data-testid="delete-user"]');
    await expect(window.locator('[data-testid="user-deleted"]')).toBeVisible();
  } finally {
    // Cleanup - runs even if test fails
    await deleteTestUser(userId);
  }
});
```

### Use Unique Identifiers

```typescript
// Good - Unique email for each test run
const email = `test-${Date.now()}@example.com`;

// Better - Use UUID for guaranteed uniqueness
import { v4 as uuidv4 } from 'uuid';
const email = `test-${uuidv4()}@example.com`;
```

## Assertions

### Use Specific Assertions

```typescript
// Good - Specific assertion
await expect(window.locator('[data-testid="error"]')).toHaveText(
  'Invalid credentials'
);

// Bad - Generic assertion
await expect(window.locator('[data-testid="error"]')).toBeVisible();
```

### Assert on Multiple Conditions

```typescript
// Check multiple aspects
const submitButton = window.locator('button[type="submit"]');
await expect(submitButton).toBeVisible();
await expect(submitButton).toBeEnabled();
await expect(submitButton).toHaveText('Submit');
```

### Use Soft Assertions for Non-Critical Checks

```typescript
test('should display user profile', async ({ window }) => {
  // Hard assertion - test fails immediately if this fails
  await expect(window.locator('[data-testid="profile"]')).toBeVisible();

  // Soft assertions - test continues even if these fail
  await expect.soft(window.locator('[data-testid="avatar"]')).toBeVisible();
  await expect.soft(window.locator('[data-testid="bio"]')).toContainText(
    'Biography'
  );

  // Test continues and reports all failures at the end
});
```

## Error Handling

### Capture Debugging Information on Failure

```typescript
test('should complete checkout', async ({ window }, testInfo) => {
  try {
    // Test steps
    await window.click('[data-testid="checkout"]');
    await expect(window.locator('[data-testid="success"]')).toBeVisible();
  } catch (error) {
    // Capture screenshot on failure
    await window.screenshot({
      path: `screenshots/${testInfo.title}.png`,
    });
    throw error;
  }
});
```

### Handle Expected Errors

```typescript
test('should show validation error', async ({ window }) => {
  await window.click('button[type="submit"]');

  // Expect an error to appear
  const error = window.locator('[data-testid="error"]');
  await expect(error).toBeVisible({ timeout: 5000 });
  await expect(error).toContainText('Required field');
});
```

## Performance

### Parallelize Tests

```typescript
// In playwright.config.ts
export default defineConfig({
  // Run tests in parallel
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
});
```

### Group Sequential Operations

```typescript
// Good - Group operations that must run sequentially
await Promise.all([
  window.waitForLoadState('networkidle'),
  window.click('button#submit'),
]);

// Bad - Unnecessary sequential waits
await window.click('button#submit');
await window.waitForLoadState('networkidle');
```

### Reuse Expensive Setup

```typescript
// Use beforeAll for expensive setup that can be shared
test.describe('Dashboard tests', () => {
  let authToken: string;

  test.beforeAll(async () => {
    // Expensive operation - do once for all tests
    authToken = await loginAndGetToken();
  });

  test('should display widgets', async ({ window }) => {
    await window.goto('/', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // Test...
  });
});
```

## Maintenance

### Keep Tests Simple and Focused

Each test should verify one behavior or feature.

```typescript
// Good - Single responsibility
test('should validate email format', async ({ window }) => {
  await fillField(window, 'input[name="email"]', 'invalid-email');
  await window.click('button[type="submit"]');
  await expect(window.locator('.error')).toContainText('valid email');
});

// Bad - Testing multiple unrelated things
test('should handle form', async ({ window }) => {
  // Tests validation, submission, navigation, etc.
  // Too much in one test
});
```

### Extract Common Operations into Helpers

```typescript
// Extract repeated patterns
async function loginAsUser(window: Page, email: string, password: string) {
  await window.goto('/login');
  await fillField(window, 'input[name="email"]', email);
  await fillField(window, 'input[name="password"]', password);
  await window.click('button[type="submit"]');
  await window.waitForLoadState('networkidle');
}

test('should access dashboard after login', async ({ window }) => {
  await loginAsUser(window, 'user@example.com', 'password');
  await expect(window.locator('[data-testid="dashboard"]')).toBeVisible();
});
```

### Document Complex Test Logic

```typescript
test('should handle complex workflow', async ({ window }) => {
  // Step 1: Create a draft
  // This requires navigating to the editor and filling a specific field
  await window.goto('/editor');
  await window.fill('[data-testid="title"]', 'Draft Title');

  // Step 2: Save as draft
  // The save button triggers an auto-save after 2 seconds
  await window.click('[data-testid="save-draft"]');
  await window.waitForSelector('[data-testid="draft-saved"]');

  // Step 3: Verify draft appears in list
  await window.goto('/drafts');
  await expect(window.locator('text=Draft Title')).toBeVisible();
});
```

### Regular Test Review

- Remove obsolete tests for removed features
- Update tests when UI changes significantly
- Consolidate duplicate tests
- Improve flaky tests rather than increasing retries
