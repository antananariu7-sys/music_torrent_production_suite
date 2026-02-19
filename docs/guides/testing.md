# Testing Guidelines

This document provides pragmatic testing guidelines for the Music Production Suite, focusing on testing business logic where it matters most.

---

## Testing Philosophy

### Core Principles

1. **Test Business Logic Only**: Write tests for services, utilities, and core algorithms
2. **Skip UI Tests Unless Necessary**: Don't test simple presentational components
3. **Pragmatic Approach**: Test only when it provides real value
4. **Efficiency**: Minimize test maintenance burden
5. **Focus on Risk**: Test critical paths and complex logic

### When to Write Tests

**✅ Always Test:**
- Business logic in services
- Data transformation and processing
- Complex algorithms and calculations
- Utilities and validators
- Critical IPC handlers with complex logic

**⚠️ Sometimes Test:**
- Zustand stores with complex business logic
- Components with critical business rules
- Complex form validation
- Integration points with multiple services

**❌ Don't Test:**
- Simple presentational components
- Basic UI layouts
- Simple state setters/getters
- Trivial utility functions
- Type definitions

---

## Testing Strategy Overview

### Pragmatic Testing Approach

**Core Principle**: Write tests for business logic; UI tests only when necessary.

### Test Focus

```
        /\
       /  \      E2E Tests (Rare)
      /----\     - Critical user workflows only
     /      \
    /--------\   Integration Tests (Selective)
   /          \  - IPC communication when complex
  /------------\ - Service layer interactions
 /______________\ Unit Tests (Business Logic Only)
                 - Services and business logic
                 - Utilities and pure functions
                 - Complex algorithms
```

### Testing Goals
1. **Pragmatic Coverage**: Test what matters - business logic and critical paths
2. **Efficiency**: Don't waste time testing simple UI components
3. **Maintainability**: Less test code to maintain means faster iteration
4. **Confidence**: Tests where they provide the most value
5. **Speed**: Fast test suite focusing on core functionality

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

### Unit Test Scope - Business Logic Only

**Test These:**
- **Services** (Main Process): Business logic, data transformations, calculations
- **Utilities**: Pure functions, helpers, validators, formatters
- **Complex Algorithms**: Data processing, parsing, transformation logic
- **Zustand Stores**: Only when they contain complex business logic

**Skip These (unless necessary):**
- **Simple React Components**: Presentational components, basic UI
- **Simple Zustand Stores**: Basic state setters and getters
- **UI Interactions**: Button clicks, form inputs (unless critical business logic)
- **Styling and Layout**: Visual presentation

**When UI Testing IS Necessary:**
- Complex state management logic in components
- Critical user workflows with business implications
- Complex form validation with multiple rules
- Dynamic UI behavior based on complex conditions

### React Component Testing (When Necessary)

**⚠️ IMPORTANT**: Only write component tests when they contain business logic or critical workflows.

**Skip component tests for:**
- Simple presentational components
- Components that just display data
- Basic layout components
- Simple forms without complex validation

**Write component tests only when:**
- Component contains complex business logic
- Component has critical state management
- Component has complex conditional rendering based on business rules
- Testing prevents high-risk bugs

**Testing Library Setup** (when needed):
```tsx
// Jest globals (describe, it, expect, beforeEach, etc.) are available without import
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
```

**Minimal Test Template**:
```tsx
describe('ComponentName', () => {
  it('should handle critical business logic', async () => {
    const user = userEvent.setup()
    render(<ComponentName criticalProp="value" />)

    // Test only the critical business logic
    const button = screen.getByTestId('action-button')
    await user.click(button)

    expect(screen.getByTestId('result')).toHaveTextContent('Expected Result')
  })
})
```

**Note**: If you need component tests, wrap with `ChakraProvider` and use the TestWrapper pattern.

### Zustand Store Testing (Optional)

**⚠️ Skip store tests unless they contain complex business logic.**

Simple stores with basic getters/setters don't need tests:
```tsx
// ❌ Don't test this - too simple
set({ theme: 'dark' })
set({ count: count + 1 })
```

**Only test stores with:**
- Complex computed values or derived state
- Business logic in actions
- Complex state transformations
- Side effects

**Example of store worth testing**:
```tsx
import { useCalculationStore } from './useCalculationStore'

describe('useCalculationStore', () => {
  it('should calculate complex derived values correctly', () => {
    const { setValues, calculateResult } = useCalculationStore.getState()
    setValues({ a: 10, b: 20, c: 30 })

    const result = calculateResult() // Complex business logic
    expect(result).toBe(/* expected complex calculation */)
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
│   │   │   ├── Button.spec.tsx           # ✅ Test next to component
│   │   │   ├── Input.tsx
│   │   │   └── Input.spec.tsx
│   │   └── features/
│   │       └── ProjectManager/
│   │           ├── ProjectCard.tsx
│   │           ├── ProjectCard.spec.tsx  # ✅ Test next to component
│   │           ├── ProjectList.tsx
│   │           └── ProjectList.spec.tsx
│   ├── store/
│   │   ├── useThemeStore.ts
│   │   ├── useThemeStore.spec.ts         # ✅ Test next to store
│   │   ├── useProjectStore.ts
│   │   └── useProjectStore.spec.ts
│   ├── hooks/
│   │   ├── useSearch.ts
│   │   ├── useSearch.spec.ts             # ✅ Test next to hook
│   │   ├── useAuth.ts
│   │   └── useAuth.spec.ts
│   └── pages/
│       ├── Welcome/
│       │   ├── index.tsx
│       │   └── Welcome.spec.tsx          # ✅ Test next to page
│       └── Settings/
│           ├── index.tsx
│           └── Settings.spec.tsx
├── main/
│   ├── services/
│   │   ├── ProjectService.ts
│   │   ├── ProjectService.spec.ts        # ✅ Test next to service
│   │   ├── AuthService.ts
│   │   └── AuthService.spec.ts
│   └── utils/
│       ├── validators.ts
│       └── validators.spec.ts            # ✅ Test next to utility
└── shared/
    └── utils/
        ├── formatters.ts
        └── formatters.spec.ts            # ✅ Test next to utility
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
- **Unit tests**: `serviceName.spec.ts` (colocated with business logic — **always `.spec.ts`, never `.test.ts`**)
- **Integration tests**: `feature-name.integration.spec.ts` (in `tests/integration/` - only when necessary)
- **E2E tests**: `workflow-name.spec.ts` (in `tests/e2e/` - rare)

### Test File Organization

**Colocate tests with business logic**:
- Place test files next to the services/utilities they test
- Makes tests easy to find and maintain
- Tests move and delete with the code they test

**Example**:
```
src/main/services/
├── ConfigService.ts
├── ConfigService.spec.ts       ✅ Test next to service
├── ProjectService.ts
└── ProjectService.spec.ts      ✅ Test next to service
```

**Skip creating test files for**:
- Simple React components in `src/renderer/components/`
- Simple Zustand stores in `src/renderer/store/`
- Basic utilities unless they have complex logic

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

### Pragmatic Coverage Approach

**Don't chase coverage percentages** - focus on testing what matters.

### What to Test (High Priority)
1. **Business Logic**: Services, utilities, validators, calculations
2. **Critical Services**: Authentication, data processing, file operations
3. **Complex Algorithms**: Data transformations, parsing, computations
4. **Error Handling**: Error states in business logic, validation rules

### What to Skip (Low/No Priority)
- Simple presentational components
- Basic UI components without logic
- Simple Zustand stores (getters/setters)
- Generated/boilerplate code
- Type definitions
- Third-party library code
- Trivial utility functions

### Coverage Targets
- **Services/Business Logic**: Aim for 70-80% coverage
- **UI Components**: 0-20% coverage (only when necessary)
- **Integration Tests**: Test complex IPC channels only
- **E2E Tests**: Only critical user workflows

---

## Continuous Integration

### Test Scripts (from package.json)
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:main": "jest --config jest.config.main.ts",
    "test:main:watch": "jest --config jest.config.main.ts --watch",
    "test:main:coverage": "jest --config jest.config.main.ts --coverage",
    "test:all": "jest && jest --config jest.config.main.ts",
    "test:e2e": "playwright test"
  }
}
```

> **Note**: Renderer tests use `jest.config.ts`, main process tests use `jest.config.main.ts`. Run `yarn test:all` to execute both.

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

**Last Updated**: 2026-02-19
**Related**: [10-development-plan.md](../architecture/10-development-plan.md), [AGENTS.md](../../AGENTS.md)
