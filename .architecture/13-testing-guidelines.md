# Testing Guidelines

This document provides comprehensive testing guidelines for the Music Production Suite, including testing strategies, best practices, and standards for unit, integration, and end-to-end tests.

---

## Testing Strategy Overview

### Test Pyramid
```
        /\
       /  \      E2E Tests (Few)
      /----\     - Critical user workflows
     /      \    - Cross-process integration
    /--------\   Integration Tests (Some)
   /          \  - IPC communication
  /------------\ - Service layer interactions
 /______________\ Unit Tests (Many)
                 - Components, stores, utilities
                 - Business logic
                 - Pure functions
```

### Testing Goals
1. **Reliability**: Ensure application behaves correctly across all scenarios
2. **Confidence**: Safe refactoring and feature additions
3. **Documentation**: Tests serve as living documentation
4. **Speed**: Fast feedback loop for developers
5. **Maintainability**: Tests should be easy to read and update

---

## Test Locator Standards

### Use `data-testid` for All Test Locators

**Why `data-testid`?**
- **Stable**: Not affected by text changes, styling, or refactoring
- **Explicit**: Clear intent that element is meant for testing
- **Separation of Concerns**: Testing infrastructure separate from production code
- **Accessibility**: Doesn't conflict with ARIA attributes
- **Refactor-Safe**: Can change classes, text, or structure without breaking tests

### Naming Convention for `data-testid`

Follow this pattern: `{feature}-{element-type}-{descriptor}`

**Examples**:
```tsx
// Page/Section identifiers
data-testid="settings-heading"
data-testid="dashboard-container"
data-testid="search-results-section"

// Interactive elements
data-testid="login-button"
data-testid="theme-switch"
data-testid="project-name-input"
data-testid="back-button"

// Display elements
data-testid="current-theme-value"
data-testid="download-progress-bar"
data-testid="search-result-card"

// List items (use index or unique id)
data-testid="torrent-item-0"
data-testid="project-card-{projectId}"
```

### Implementation Guidelines

**1. Add to All Interactive Elements**
```tsx
// Buttons
<Button data-testid="submit-button">Submit</Button>

// Inputs
<Input data-testid="email-input" type="email" />

// Switches/Checkboxes
<Switch data-testid="dark-mode-switch" />

// Links
<Link data-testid="home-link" to="/">Home</Link>
```

**2. Add to Container/Section Elements**
```tsx
// Sections
<Box data-testid="search-results-container">
  {/* content */}
</Box>

// Cards
<Card data-testid="project-card">
  {/* content */}
</Card>
```

**3. Add to Display Elements When Testing Content**
```tsx
// When you need to verify specific content
<Text data-testid="status-message">{status}</Text>
<Heading data-testid="page-title">{title}</Heading>
```

**4. List Items with Unique Identifiers**
```tsx
// Prefer unique IDs over indices when possible
{projects.map(project => (
  <ProjectCard
    key={project.id}
    data-testid={`project-card-${project.id}`}
  />
))}

// Use index only for static or test-controlled lists
{items.map((item, index) => (
  <Item
    key={item.id}
    data-testid={`list-item-${index}`}
  />
))}
```

### What NOT to Use

❌ **Avoid these locator strategies**:
```tsx
// Text content (brittle, breaks with i18n)
screen.getByText('Submit')

// CSS classes (breaks with styling changes)
screen.getByClassName('submit-btn')

// CSS selectors (tightly coupled to structure)
document.querySelector('.form > .button')

// Tag names (too generic)
screen.getByRole('button')  // OK for quick tests, but prefer data-testid
```

✅ **Always prefer**:
```tsx
screen.getByTestId('submit-button')
```

---

## Unit Testing

### Unit Test Scope
- **React Components**: Rendering, user interactions, conditional logic
- **Zustand Stores**: State management, actions, selectors
- **Utilities**: Pure functions, helpers, validators
- **Services** (Main Process): Business logic, data transformations

### React Component Testing

**Testing Library Setup**:
```tsx
// Jest globals (describe, it, expect, beforeEach, etc.) are available without import
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
```

**Test Template**:
```tsx
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup: Reset mocks, stores, etc.
  })

  it('should render with required props', () => {
    render(<ComponentName requiredProp="value" />)
    expect(screen.getByTestId('component-container')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    render(<ComponentName />)

    const button = screen.getByTestId('action-button')
    await user.click(button)

    expect(screen.getByTestId('result')).toHaveTextContent('Expected Result')
  })
})
```

**Wrapper Pattern for Providers**:

**IMPORTANT**: All component tests require wrapping with `ChakraProvider` because the application uses Chakra UI components throughout.

```tsx
// TestWrapper for Chakra UI and Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <ChakraProvider value={system}>
      {children}
    </ChakraProvider>
  </MemoryRouter>
)

// Usage
render(
  <TestWrapper>
    <ComponentUnderTest />
  </TestWrapper>
)
```

**See Example**: [src/renderer/pages/Welcome/Welcome.test.tsx](src/renderer/pages/Welcome/Welcome.test.tsx) for a complete example of the TestWrapper pattern with Chakra provider and router setup.

### Zustand Store Testing

**Direct State Testing**:
```tsx
import { useThemeStore } from './useThemeStore'

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: 'dark' })
  })

  it('should toggle mode', () => {
    const { toggleMode } = useThemeStore.getState()
    toggleMode()
    expect(useThemeStore.getState().mode).toBe('light')
  })
})
```

### Service/Utility Testing

**Pure Function Testing**:
```tsx
import { validateProjectName } from './validators'

describe('validateProjectName', () => {
  it('should accept valid project names', () => {
    expect(validateProjectName('My Project')).toBe(true)
  })

  it('should reject empty names', () => {
    expect(validateProjectName('')).toBe(false)
  })

  it('should reject names with invalid characters', () => {
    expect(validateProjectName('Project/Name')).toBe(false)
  })
})
```

---

## Integration Testing

### Integration Test Scope
- **IPC Communication**: Main ↔ Renderer communication
- **Service Integration**: Multiple services working together
- **State + API**: Store operations triggering IPC calls
- **Multi-Component**: Feature-level component interactions

### IPC Testing Pattern

**Setup Test IPC**:
```tsx
// Mock window.api
const mockApi = {
  createProject: jest.fn(),
  loadProject: jest.fn(),
  saveProject: jest.fn(),
}

// In test setup
beforeEach(() => {
  window.api = mockApi
})
```

**Test IPC Flow**:
```tsx
it('should create project via IPC', async () => {
  mockApi.createProject.mockResolvedValue({
    id: '123',
    name: 'Test Project'
  })

  const user = userEvent.setup()
  render(<ProjectCreator />)

  await user.type(screen.getByTestId('project-name-input'), 'Test Project')
  await user.click(screen.getByTestId('create-button'))

  expect(mockApi.createProject).toHaveBeenCalledWith('Test Project')
  expect(screen.getByTestId('success-message')).toBeInTheDocument()
})
```

### Multi-Component Integration

**Feature Testing**:
```tsx
describe('Search Feature', () => {
  it('should perform search and display results', async () => {
    const mockResults = [
      { id: '1', title: 'Track 1' },
      { id: '2', title: 'Track 2' },
    ]

    mockApi.searchTorrents.mockResolvedValue(mockResults)

    render(<SearchPage />)

    await user.type(screen.getByTestId('search-input'), 'music')
    await user.click(screen.getByTestId('search-button'))

    await waitFor(() => {
      expect(screen.getByTestId('result-item-1')).toBeInTheDocument()
      expect(screen.getByTestId('result-item-2')).toBeInTheDocument()
    })
  })
})
```

---

## End-to-End Testing

### E2E Test Scope
- **Critical User Workflows**: Login → Search → Download → Mix
- **Cross-Process Functionality**: Full Electron app testing
- **Real Browser Automation**: Puppeteer interactions
- **Data Persistence**: Project save/load cycles

### Playwright Configuration

**Test File Location**: `e2e/tests/`

**Example E2E Test**:
```typescript
import { test, expect } from '@playwright/test'

test.describe('Project Workflow', () => {
  test('should create and save a project', async ({ page }) => {
    await page.goto('/')

    // Create project
    await page.getByTestId('create-project-button').click()
    await page.getByTestId('project-name-input').fill('My Music Project')
    await page.getByTestId('submit-button').click()

    // Verify project created
    await expect(page.getByTestId('project-title')).toHaveText('My Music Project')

    // Navigate to search
    await page.getByTestId('search-nav-link').click()
    await expect(page.getByTestId('search-page-heading')).toBeVisible()
  })
})
```

### E2E Testing Best Practices

1. **Test Critical Paths Only**: Don't replicate unit tests
2. **Use data-testid**: Consistent with unit/integration tests
3. **Wait for State**: Use `waitFor` and Playwright's auto-waiting
4. **Clean State**: Reset app state between tests
5. **Test Real Interactions**: Click, type, navigate like a user
6. **Verify Visual State**: Check element visibility, text content

---

## Test Organization

### File Structure

**Unit Tests**: Colocated with the code they test

```
src/
├── renderer/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx           # ✅ Test next to component
│   │   │   ├── Input.tsx
│   │   │   └── Input.test.tsx
│   │   └── features/
│   │       └── ProjectManager/
│   │           ├── ProjectCard.tsx
│   │           ├── ProjectCard.test.tsx  # ✅ Test next to component
│   │           ├── ProjectList.tsx
│   │           └── ProjectList.test.tsx
│   ├── store/
│   │   ├── useThemeStore.ts
│   │   ├── useThemeStore.test.ts         # ✅ Test next to store
│   │   ├── useProjectStore.ts
│   │   └── useProjectStore.test.ts
│   ├── hooks/
│   │   ├── useSearch.ts
│   │   ├── useSearch.test.ts             # ✅ Test next to hook
│   │   ├── useAuth.ts
│   │   └── useAuth.test.ts
│   └── pages/
│       ├── Welcome/
│       │   ├── index.tsx
│       │   └── Welcome.test.tsx          # ✅ Test next to page
│       └── Settings/
│           ├── index.tsx
│           └── Settings.test.tsx
├── main/
│   ├── services/
│   │   ├── project.service.ts
│   │   ├── project.service.test.ts       # ✅ Test next to service
│   │   ├── auth.service.ts
│   │   └── auth.service.test.ts
│   └── utils/
│       ├── validators.ts
│       └── validators.test.ts            # ✅ Test next to utility
└── shared/
    └── utils/
        ├── formatters.ts
        └── formatters.test.ts            # ✅ Test next to utility
```

**Integration & E2E Tests**: Centralized test directories

```
tests/
├── integration/
│   ├── ipc/
│   │   ├── project-ipc.integration.test.ts
│   │   └── search-ipc.integration.test.ts
│   ├── features/
│   │   ├── search-workflow.integration.test.ts
│   │   └── download-workflow.integration.test.ts
│   └── services/
│       └── project-service.integration.test.ts
└── e2e/
    ├── tests/
    │   ├── auth.spec.ts
    │   ├── search.spec.ts
    │   └── download.spec.ts
    └── fixtures/
        └── test-data.json
```

### File Naming Convention
- **Unit tests**: `ComponentName.test.tsx` or `serviceName.test.ts` (colocated)
- **Integration tests**: `feature-name.integration.test.ts` (in `tests/integration/`)
- **E2E tests**: `workflow-name.spec.ts` (in `tests/e2e/`)

### Why Colocate Unit Tests?

**Benefits of colocated tests**:
1. **Easy to Find**: Test is always next to the code it tests
2. **Move Together**: Refactoring components automatically includes tests
3. **Delete Together**: Removing a component won't leave orphaned tests
4. **Clear Ownership**: Obvious which test belongs to which component
5. **Faster Development**: No context switching between distant directories

**Why separate integration/e2e tests?**:
- Integration tests span multiple modules (no single owner)
- E2E tests test entire workflows (cross-cutting concerns)
- Centralized location makes them easier to run as a suite

### Test Naming Convention
```tsx
// Pattern: "should [expected behavior] when [condition]"

it('should display error message when validation fails', () => {})
it('should save project when all fields are valid', () => {})
it('should toggle theme when switch is clicked', () => {})

// For simple tests without conditions
it('should render the header', () => {})
it('should call API with correct parameters', () => {})
```

---

## Mocking Strategies

### Mock IPC API
```tsx
const mockApi = {
  // Projects
  createProject: jest.fn(),
  loadProject: jest.fn(),
  saveProject: jest.fn(),

  // Search
  searchTorrents: jest.fn(),

  // Downloads
  addDownload: jest.fn(),
  pauseDownload: jest.fn(),
}

beforeEach(() => {
  window.api = mockApi
  jest.clearAllMocks()
})
```

### Mock React Router
```tsx
const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))
```

### Mock Zustand Stores
```tsx
// Reset store state
beforeEach(() => {
  useProjectStore.setState(initialState)
})

// Mock specific store
jest.mock('@/store/useProjectStore', () => ({
  useProjectStore: jest.fn(() => mockStoreState)
}))
```

### Mock Electron APIs (for Main Process Tests)
```tsx
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path'),
  },
  ipcMain: {
    handle: jest.fn(),
  },
}))
```

---

## Testing Checklist

### Before Writing Tests
- [ ] Identify what behavior to test (not implementation)
- [ ] Determine appropriate test level (unit/integration/e2e)
- [ ] Add `data-testid` attributes to relevant elements
- [ ] Plan test cases (happy path, edge cases, errors)

### Writing Tests
- [ ] Use descriptive test names
- [ ] Follow AAA pattern (Arrange, Act, Assert)
- [ ] Test one behavior per test
- [ ] Use `data-testid` for all element queries
- [ ] Mock external dependencies
- [ ] Clean up after tests (reset state, clear mocks)

### After Writing Tests
- [ ] Tests pass consistently
- [ ] Tests run quickly (unit tests < 100ms)
- [ ] Tests are readable and maintainable
- [ ] No test interdependencies
- [ ] Coverage for edge cases and errors

---

## Common Testing Patterns

### Testing Async Operations
```tsx
it('should load data asynchronously', async () => {
  mockApi.fetchData.mockResolvedValue({ data: 'test' })

  render(<DataComponent />)

  // Wait for async operation
  await waitFor(() => {
    expect(screen.getByTestId('data-display')).toHaveTextContent('test')
  })
})
```

### Testing Error States
```tsx
it('should display error when API fails', async () => {
  mockApi.fetchData.mockRejectedValue(new Error('API Error'))

  render(<DataComponent />)

  await waitFor(() => {
    expect(screen.getByTestId('error-message')).toHaveTextContent('API Error')
  })
})
```

### Testing Form Submission
```tsx
it('should submit form with valid data', async () => {
  const user = userEvent.setup()
  const handleSubmit = jest.fn()

  render(<Form onSubmit={handleSubmit} />)

  await user.type(screen.getByTestId('name-input'), 'John Doe')
  await user.type(screen.getByTestId('email-input'), 'john@example.com')
  await user.click(screen.getByTestId('submit-button'))

  expect(handleSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com'
  })
})
```

### Testing Conditional Rendering
```tsx
it('should show loading state when fetching', () => {
  render(<DataComponent isLoading={true} />)
  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
})

it('should show data when loaded', () => {
  render(<DataComponent isLoading={false} data="test" />)
  expect(screen.getByTestId('data-display')).toHaveTextContent('test')
  expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
})
```

---

## Code Coverage Goals

### Target Coverage
- **Unit Tests**: 80%+ coverage for business logic
- **Integration Tests**: Cover all IPC channels
- **E2E Tests**: Cover critical user workflows (login, search, download)

### What to Prioritize
1. **Business Logic**: Services, utilities, validators
2. **Complex Components**: Multi-state components, forms
3. **Critical Paths**: Authentication, project management, search
4. **Error Handling**: Error states, validation, edge cases

### What to Skip
- Third-party library code
- Simple presentational components
- Generated/boilerplate code
- Type definitions

---

## Continuous Integration

### Running Tests in CI
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "test:ci": "jest --ci --coverage && playwright test"
  }
}
```

### CI Requirements
- All tests must pass before merge
- Code coverage must not decrease
- E2E tests run on Windows and macOS
- Performance budgets for test execution time

---

## Troubleshooting Common Issues

### "Element not found" Errors
```tsx
// ❌ Bad: Element might not be rendered yet
const button = screen.getByTestId('button')

// ✅ Good: Wait for element
const button = await screen.findByTestId('button')

// ✅ Good: Use waitFor
await waitFor(() => {
  expect(screen.getByTestId('button')).toBeInTheDocument()
})
```

### Timing Issues
```tsx
// ❌ Bad: Arbitrary waits
await new Promise(resolve => setTimeout(resolve, 1000))

// ✅ Good: Wait for specific condition
await waitFor(() => {
  expect(screen.getByTestId('result')).toBeInTheDocument()
}, { timeout: 3000 })
```

### Flaky Tests
- Use `waitFor` instead of fixed timeouts
- Avoid testing implementation details
- Ensure clean state between tests
- Mock time-dependent functionality
- Use `data-testid` instead of fragile selectors

---

**Last Updated**: 2026-02-01
**Related**: [10-development-plan.md](10-development-plan.md), [agents.md](../agents.md)
