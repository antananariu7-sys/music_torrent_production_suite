# ProjectLauncher Refactoring Plan

**Date:** 2026-02-02
**Status:** ✅ Completed — ProjectLauncher split into 6 components, all under 400 lines
**Target:** Split ProjectLauncher page (631 lines) into smaller, maintainable components
**Goal:** Reduce main page to ~100-150 lines while maintaining testability and following project conventions

---

## Executive Summary

The ProjectLauncher page is 631 lines with 534 lines of JSX, exceeding the project guideline of 400-500 lines per component. This plan extracts 6-7 components, reducing the main page by ~80% while improving testability and maintainability.

---

## 1. Components to Extract

### High Priority (Highest Complexity Reduction)

#### 1.1 CreateProjectCard

**Lines:** 252-432 (~180 lines)
**Complexity:** VERY HIGH
**Impact:** Largest reduction, isolates complex form logic

**Responsibilities:**

- Display create new project card
- Manage form visibility toggle (collapsed/expanded state)
- Handle all form inputs (name, description, location)
- Validate form data before submission
- Trigger folder selection dialog
- Submit project creation request

**Location:** `ProjectLauncher/components/CreateProjectCard.tsx`

---

#### 1.2 RecentProjectsSection

**Lines:** 509-597 (~90 lines)
**Complexity:** MEDIUM
**Impact:** Significant reduction, enables testing project list display

**Responsibilities:**

- Display "Recent Projects" section header
- Render grid of recent project cards
- Handle empty state (when no recent projects exist)

**Location:** `ProjectLauncher/components/RecentProjectsSection.tsx`

**Sub-component:** Extract individual project cards to:

- `RecentProjectCard.tsx` - Single project card with click handler

---

### Medium Priority (Moderate Complexity)

#### 1.3 ErrorAlert

**Lines:** 185-228 (~45 lines)
**Complexity:** LOW-MEDIUM
**Impact:** Adds reusability across pages

**Responsibilities:**

- Display error message with icon
- Provide close/dismiss button
- Support consistent error styling

**Location:** `src/renderer/components/common/ErrorAlert.tsx` ⚠️ **SHARED COMPONENT**

**Reasoning:** Error display pattern will be needed in Settings, Mixer, and other pages

---

#### 1.4 OpenProjectCard

**Lines:** 434-503 (~70 lines)
**Complexity:** LOW-MEDIUM
**Impact:** Clean separation from CreateProjectCard

**Responsibilities:**

- Display open existing project card
- Handle browse button click
- Trigger directory selection dialog

**Location:** `ProjectLauncher/components/OpenProjectCard.tsx`

---

### Low Priority (Organizational Improvements)

#### 1.5 LauncherHeader

**Lines:** 116-182 (~66 lines)
**Complexity:** LOW
**Impact:** Improves organization, easy to test

**Responsibilities:**

- Display "PROJECT SYSTEM" label
- Render main heading with gradient effect
- Show description text

**Location:** `ProjectLauncher/components/LauncherHeader.tsx`

---

#### 1.6 LauncherFooter

**Lines:** 600-627 (~28 lines)
**Complexity:** LOW
**Impact:** Minor but clean separation

**Responsibilities:**

- Display app version information
- Show platform and architecture
- Render status indicator

**Location:** `ProjectLauncher/components/LauncherFooter.tsx`

---

## 2. File Structure

```
src/renderer/pages/ProjectLauncher/
├── index.tsx                              # Main page (orchestrator) - ~100-150 lines
├── ProjectLauncher.styles.tsx             # Existing styles (keep as-is)
├── ProjectLauncher.test.tsx               # Page-level integration tests
└── components/
    ├── CreateProjectCard.tsx              # ~200 lines (with tests)
    ├── CreateProjectCard.test.tsx
    ├── OpenProjectCard.tsx                # ~80 lines (with tests)
    ├── OpenProjectCard.test.tsx
    ├── RecentProjectsSection.tsx          # ~60 lines (with tests)
    ├── RecentProjectsSection.test.tsx
    ├── RecentProjectCard.tsx              # ~70 lines (with tests)
    ├── RecentProjectCard.test.tsx
    ├── LauncherHeader.tsx                 # ~70 lines (with tests)
    ├── LauncherHeader.test.tsx
    ├── LauncherFooter.tsx                 # ~40 lines (with tests)
    └── LauncherFooter.test.tsx

src/renderer/components/common/
├── ErrorAlert.tsx                         # ~60 lines (with tests)
├── ErrorAlert.test.tsx                    # New reusable component
├── Layout.tsx                             # Already exists
├── FrequencyBars.tsx                      # Already exists
└── Waveform.tsx                           # Already exists
```

---

## 3. Props Interfaces

### 3.1 CreateProjectCard

```typescript
interface CreateProjectCardProps {
  /**
   * Callback when user submits the create project form
   * @param name - Project name (required, trimmed)
   * @param location - Full directory path (required)
   * @param description - Optional project description
   */
  onCreateProject: (
    name: string,
    location: string,
    description?: string
  ) => Promise<void>

  /**
   * Whether project creation is in progress
   * Used to disable form during submission
   */
  isLoading?: boolean
}
```

**State Management (Internal):**

- `projectName: string` - Form input value
- `projectDescription: string` - Form input value
- `projectLocation: string` - Selected directory path
- `showCreateForm: boolean` - Toggle collapsed/expanded state

**Key Decision:** Form state stays INSIDE the component. Parent only receives final submission data.

---

### 3.2 OpenProjectCard

```typescript
interface OpenProjectCardProps {
  /**
   * Callback when user clicks browse button
   * Opens directory picker and handles project loading
   */
  onBrowseProject: () => Promise<void>

  /**
   * Whether a project is being opened
   */
  isLoading?: boolean
}
```

**State Management:** No internal state needed (stateless component)

---

### 3.3 RecentProjectsSection

```typescript
import type { RecentProject } from '@shared/types/project.types'

interface RecentProjectsSectionProps {
  /**
   * List of recent projects from store
   */
  projects: RecentProject[]

  /**
   * Callback when user clicks a project card
   * @param projectDirectory - Full path to project directory
   */
  onOpenProject: (projectDirectory: string) => Promise<void>

  /**
   * Whether loading is in progress (optional)
   */
  isLoading?: boolean
}
```

**State Management:** No internal state needed (stateless component)

**Composition:** Renders multiple `RecentProjectCard` components

---

### 3.4 RecentProjectCard

```typescript
import type { RecentProject } from '@shared/types/project.types'

interface RecentProjectCardProps {
  /**
   * Single recent project data
   */
  project: RecentProject

  /**
   * Callback when card is clicked
   */
  onOpenProject: (projectDirectory: string) => Promise<void>
}
```

**State Management:** No internal state needed (stateless component)

**Helper Functions (Internal):**

- `formatDate(date: Date): string` - Format last opened date

---

### 3.5 ErrorAlert (Common Component)

```typescript
interface ErrorAlertProps {
  /**
   * Error message to display
   * If null/empty, component returns null (not rendered)
   */
  error: string | null

  /**
   * Callback when user clicks close button
   */
  onClose: () => void

  /**
   * Optional custom title (defaults to "ERROR")
   */
  title?: string

  /**
   * Optional data-testid prefix
   */
  testId?: string
}
```

**State Management:** No internal state needed (controlled component)

**Usage in other pages:** Settings errors, download errors, mixer errors, etc.

---

### 3.6 LauncherHeader

```typescript
interface LauncherHeaderProps {
  // No props needed - pure presentation
  // All content is static for this page
}
```

**State Management:** No state needed (pure presentational)

---

### 3.7 LauncherFooter

```typescript
import type { AppInfo } from '@shared/types/app.types'

interface LauncherFooterProps {
  /**
   * Application information from main process
   * If null, footer is not rendered
   */
  appInfo: AppInfo | null
}
```

**State Management:** No state needed (pure presentational)

---

## 4. State Management Strategy

### What Stays in Parent (index.tsx)

**Zustand Store State:**

```typescript
const {
  currentProject, // Keep - used for navigation effect
  recentProjects, // Keep - passed to RecentProjectsSection
  isLoading, // Keep - passed to multiple components
  error, // Keep - passed to ErrorAlert
  loadRecentProjects, // Keep - called in useEffect
  createProject, // Keep - wrapped in handler
  openProject, // Keep - wrapped in handler
  clearError, // Keep - passed to ErrorAlert
} = useProjectStore()
```

**Props:**

```typescript
{ appInfo }: ProjectLauncherProps  // Keep - passed to LauncherFooter
```

**Effects:**

```typescript
// Keep in parent - side effects and navigation
useEffect(() => {
  loadRecentProjects()
}, [loadRecentProjects])

useEffect(() => {
  if (currentProject) {
    // TODO: Navigate to main project view
  }
}, [currentProject])
```

**Handler Functions (Created in Parent):**

```typescript
const handleCreateProject = async (
  name: string,
  location: string,
  description?: string
) => {
  await createProject(name, location, description)
}

const handleOpenRecent = async (projectDirectory: string) => {
  const filePath = `${projectDirectory}/project.json`
  await openProject(filePath)
}

const handleBrowseProject = async () => {
  const directory = await window.api.selectDirectory()
  if (directory) {
    const filePath = `${directory}/project.json`
    await openProject(filePath)
  }
}
```

---

### What Moves to Components

**CreateProjectCard (Internal State):**

```typescript
// These stay INSIDE CreateProjectCard component
const [projectName, setProjectName] = useState('')
const [projectDescription, setProjectDescription] = useState('')
const [projectLocation, setProjectLocation] = useState('')
const [showCreateForm, setShowCreateForm] = useState(false)

// Internal handler
const handleSelectLocation = async () => {
  const directory = await window.api.selectDirectory()
  if (directory) {
    setProjectLocation(directory)
  }
}
```

**Reasoning:**

- Form state is an internal UI concern
- Component manages its own form lifecycle
- Parent only needs final submission data
- Makes component fully self-contained and testable
- Follows React best practice: "Lift state only when sharing is needed"

**All Other Components:**

- No internal state needed
- Pure presentational components
- Receive data via props, emit events via callbacks

---

## 5. Order of Implementation

### Phase 1: Highest Impact (Do First) 🔥

**Goal:** Reduce complexity by ~50% in first phase

1. **CreateProjectCard** (~180 lines extracted)
   - Isolates complex form logic
   - Moves 4 state variables into component
   - Enables isolated testing of form validation
   - **Estimated Time:** 2-3 hours (implementation + tests)

2. **RecentProjectsSection + RecentProjectCard** (~90 lines extracted)
   - Separates project list display logic
   - Enables testing of empty state and card interactions
   - **Estimated Time:** 1.5-2 hours (both components + tests)

**After Phase 1:** Main page reduced from 631 → ~360 lines (~43% reduction)

---

### Phase 2: Medium Impact 🎯

**Goal:** Add reusability and clean up remaining complexity

3. **ErrorAlert** to `common/` (~45 lines extracted)
   - Creates reusable error display component
   - Benefits future pages (Settings, Mixer, etc.)
   - **Estimated Time:** 1 hour (component + tests)

4. **OpenProjectCard** (~70 lines extracted)
   - Completes action cards section extraction
   - Balances component sizes
   - **Estimated Time:** 1 hour (component + tests)

**After Phase 2:** Main page reduced from ~360 → ~245 lines (~61% total reduction)

---

### Phase 3: Polish & Organization ✨

**Goal:** Achieve <150 line main page, maximum testability

5. **LauncherHeader** (~66 lines extracted)
   - Cleans up page header section
   - Easy to test gradient effects and animations
   - **Estimated Time:** 45 minutes (component + tests)

6. **LauncherFooter** (~28 lines extracted)
   - Final organizational improvement
   - Completes component extraction
   - **Estimated Time:** 30 minutes (component + tests)

**After Phase 3:** Main page reduced from ~245 → ~100-150 lines (~80% total reduction)

---

### Implementation Workflow (Per Component)

Follow TDD approach from `dev` skill:

```
1. RED: Write component test first
   - Test component rendering
   - Test prop variations
   - Test user interactions

2. GREEN: Implement component
   - Extract JSX from index.tsx
   - Add props interface
   - Implement event handlers

3. REFACTOR: Optimize and clean
   - Improve prop naming
   - Add JSDoc comments
   - Optimize re-renders if needed

4. INTEGRATE: Update parent
   - Import new component
   - Pass props and handlers
   - Update parent tests
   - Verify page still works

5. COMMIT: Small, focused commit
   - One component per commit
   - Follow commit message conventions
```

---

## 6. Trade-offs and Architectural Decisions

### Decision 1: Form State Location ✅

**Options:**

- **A:** Keep form state in parent, pass as props (controlled externally)
- **B:** Move form state into CreateProjectCard (self-contained)

**Chosen:** Option B

**Rationale:**

- Form state is internal UI concern, not business logic
- Parent only needs to know about submission, not form lifecycle
- Makes CreateProjectCard independently testable
- Follows React best practice: lift state only when needed
- Reduces props drilling (4 fewer state variables to pass)

**Implementation Note:**

```typescript
// ❌ BAD: Parent controls form state
<CreateProjectCard
  projectName={projectName}
  onProjectNameChange={setProjectName}
  projectDescription={projectDescription}
  onProjectDescriptionChange={setProjectDescription}
  projectLocation={projectLocation}
  onProjectLocationChange={setProjectLocation}
  showCreateForm={showCreateForm}
  onToggleForm={setShowCreateForm}
  onCreateProject={handleCreateProject}
/>

// ✅ GOOD: Component manages form state
<CreateProjectCard
  onCreateProject={handleCreateProject}
  isLoading={isLoading}
/>
```

---

### Decision 2: Component Granularity ✅

**Options:**

- **A:** Only extract high-complexity components (CreateProjectCard, RecentProjects)
- **B:** Extract all logical sections including simple ones (Header, Footer)

**Chosen:** Option B

**Rationale:**

- Better testability - each component tested in isolation
- Follows project guideline: "Keep components small" (400-500 lines max)
- Easier to understand and modify individual pieces
- Reduces cognitive load when reading main page
- Sets good precedent for other pages

**Counter-argument Considered:**
"Extracting simple components adds unnecessary files"

**Response:**

- File count vs readability trade-off favors readability
- Modern IDEs handle navigation easily
- Co-located tests make each component discoverable
- Follows established pattern (Settings page structure)

---

### Decision 3: RecentProjectCard Extraction ✅

**Options:**

- **A:** Keep project cards inline in RecentProjectsSection
- **B:** Extract to separate RecentProjectCard component

**Chosen:** Option B

**Rationale:**

- Each project card is ~40-50 lines of JSX
- Enables isolated testing of card interactions (hover, click)
- Cleaner separation: Section handles layout, Card handles display
- Follows component composition best practices
- Makes future enhancements easier (e.g., context menu, drag-drop)

**Component Hierarchy:**

```
RecentProjectsSection
└── RecentProjectCard (repeated for each project)
    ├── Project name and directory
    ├── Song count badge
    ├── Last opened date
    └── Click handler
```

---

### Decision 4: ErrorAlert Location ✅

**Options:**

- **A:** Keep as `ProjectLauncher/components/ErrorAlert.tsx`
- **B:** Move to `components/common/ErrorAlert.tsx`

**Chosen:** Option B

**Rationale:**

- Error display pattern needed across multiple pages:
  - Settings page errors (config save failures)
  - Download page errors (network failures)
  - Mixer page errors (audio processing errors)
- Component has no page-specific logic or styling
- Generic enough to be reused (message + close button)
- Follows project pattern: "Move common UI patterns to shared components"

**Future Usage:**

```typescript
// Settings page
<ErrorAlert error={settingsError} onClose={clearSettingsError} />

// Download page
<ErrorAlert error={downloadError} onClose={clearDownloadError} />

// Mixer page
<ErrorAlert error={mixerError} onClose={clearMixerError} />
```

---

### Decision 5: Styling Strategy ✅

**Options:**

- **A:** Keep all styles in `ProjectLauncher.styles.tsx`
- **B:** Split styles per component (CreateProjectCard.styles.tsx, etc.)
- **C:** Use Chakra inline styles only (keep styles.tsx for animations)

**Chosen:** Option C

**Rationale:**

- Current `ProjectLauncher.styles.tsx` contains only:
  - CSS animations (@keyframes)
  - Hover effects and transitions
  - Global animation classes
- Most styling already inline with Chakra props
- No component-specific style conflicts to worry about
- Avoids style file proliferation

**Keep in ProjectLauncher.styles.tsx:**

- `@keyframes fade-in-up`
- `@keyframes glow-pulse`
- `@keyframes card-entrance`
- `.action-card`, `.project-card`, `.emoji-icon` hover effects

**Inline with Chakra:**

- Layout props (spacing, sizing)
- Color schemes
- Typography
- Border and radius

---

### Decision 6: Loading State Display ✅

**Options:**

- **A:** Extract LoadingState component
- **B:** Keep inline in main page

**Chosen:** Option B (Keep inline)

**Rationale:**

- Only 15 lines of simple JSX
- Not complex enough to justify extraction
- Used only once in this page
- Clear and readable as-is
- Follows "avoid premature abstraction" principle

**Implementation:**

```typescript
{isLoading && (
  <Box textAlign="center" py={16}>
    <VStack gap={4}>
      <Spinner size="xl" color="brand.500" />
      <Text fontSize="sm" fontFamily="monospace">
        LOADING PROJECTS...
      </Text>
    </VStack>
  </Box>
)}
```

---

## 7. Testing Strategy

### Test Coverage Goals

- **Unit Tests:** Each component tested in isolation
- **Integration Tests:** Parent page tests component composition
- **Snapshot Tests:** Visual regression prevention
- **Interaction Tests:** User actions and callbacks

---

### CreateProjectCard Tests

**File:** `CreateProjectCard.test.tsx`

```typescript
describe('CreateProjectCard', () => {
  // Rendering Tests
  it('renders collapsed state initially')
  it('shows action label and description when collapsed')

  // Interaction Tests
  it('expands form when "New Project" button clicked')
  it('collapses form when "Cancel" button clicked')
  it('handles project name input changes')
  it('handles project description input changes')
  it('updates location when folder selected')

  // Validation Tests
  it('disables create button when name is empty')
  it('disables create button when location is empty')
  it('enables create button when required fields filled')
  it('trims whitespace from project name')

  // Submission Tests
  it('calls onCreateProject with correct data')
  it('calls onCreateProject with description when provided')
  it('calls onCreateProject without description when omitted')
  it('resets form after successful submission')
  it('maintains form data if submission fails')

  // Loading State Tests
  it('disables form inputs when isLoading is true')
  it('shows loading indicator on create button when submitting')

  // Integration Tests
  it('full flow: expand → fill form → submit → reset')
})
```

---

### RecentProjectsSection Tests

**File:** `RecentProjectsSection.test.tsx`

```typescript
describe('RecentProjectsSection', () => {
  // Rendering Tests
  it('renders section header with icon')
  it('renders grid of project cards')
  it('renders correct number of project cards')

  // Data Flow Tests
  it('passes project data to RecentProjectCard components')
  it('passes onOpenProject handler to child cards')

  // Edge Cases
  it('handles empty projects array gracefully')
  it('renders no cards when projects array is empty')
})
```

---

### RecentProjectCard Tests

**File:** `RecentProjectCard.test.tsx`

```typescript
describe('RecentProjectCard', () => {
  // Rendering Tests
  it('renders project name correctly')
  it('renders project directory path')
  it('renders formatted last opened date')
  it('renders song count badge when count > 0')
  it('hides song count badge when count is 0')

  // Interaction Tests
  it('calls onOpenProject with correct directory when clicked')
  it('card has pointer cursor')

  // Styling Tests
  it('applies hover effects on mouse over')
  it('applies correct card styling classes')

  // Date Formatting Tests
  it('formats date in MM/DD/YYYY format')
  it('handles different date values correctly')
})
```

---

### ErrorAlert Tests (Common Component)

**File:** `components/common/ErrorAlert.test.tsx`

```typescript
describe('ErrorAlert', () => {
  // Rendering Tests
  it('renders error message when error provided')
  it('renders with default "ERROR" title')
  it('renders with custom title when provided')
  it('does not render when error is null')
  it('does not render when error is empty string')

  // Interaction Tests
  it('calls onClose when close button clicked')
  it('close button has correct aria-label')

  // Styling Tests
  it('applies error color scheme')
  it('displays warning icon')
  it('applies correct border and background styles')

  // Accessibility Tests
  it('close button is keyboard accessible')
  it('uses semantic HTML structure')

  // Test ID Tests
  it('applies default test IDs when not provided')
  it('applies custom testId prefix when provided')
})
```

---

### OpenProjectCard Tests

**File:** `OpenProjectCard.test.tsx`

```typescript
describe('OpenProjectCard', () => {
  // Rendering Tests
  it('renders card with heading and description')
  it('renders browse button with folder icon')
  it('shows action label "ACTION_02"')

  // Interaction Tests
  it('calls onBrowseProject when browse button clicked')
  it('disables button when isLoading is true')

  // Loading State Tests
  it('shows loading indicator when isLoading is true')
})
```

---

### LauncherHeader Tests

**File:** `LauncherHeader.test.tsx`

```typescript
describe('LauncherHeader', () => {
  // Rendering Tests
  it('renders system label "PROJECT SYSTEM"')
  it('renders main heading "Choose Your Project"')
  it('renders description text')
  it('applies gradient effect to "Project" text')

  // Styling Tests
  it('applies correct font styles')
  it('applies glow animation class')

  // Snapshot Tests
  it('matches snapshot')
})
```

---

### LauncherFooter Tests

**File:** `LauncherFooter.test.tsx`

```typescript
describe('LauncherFooter', () => {
  // Rendering Tests
  it('renders version information')
  it('renders platform and architecture')
  it('renders status indicator dot')
  it('does not render when appInfo is null')

  // Data Tests
  it('displays correct version from appInfo')
  it('displays correct platform from appInfo')
  it('displays correct architecture from appInfo')
  it('formats platform text as uppercase')
  it('formats architecture text as uppercase')

  // Snapshot Tests
  it('matches snapshot with appInfo')
  it('matches snapshot with null appInfo')
})
```

---

### Updated ProjectLauncher (Parent) Tests

**File:** `ProjectLauncher.test.tsx`

Update existing tests to account for component extraction:

```typescript
describe('ProjectLauncher', () => {
  // Integration Tests - Component Composition
  it('renders LauncherHeader component')
  it('renders CreateProjectCard component')
  it('renders OpenProjectCard component')
  it('renders RecentProjectsSection when projects exist')
  it('renders LauncherFooter when appInfo provided')
  it('renders ErrorAlert when error exists')

  // State Management Tests
  it('loads recent projects on mount')
  it('passes store state to child components correctly')
  it('passes handler functions to child components')

  // Navigation Tests
  it('navigates to project view when currentProject is set')

  // Handler Tests
  it('handleCreateProject calls store.createProject with correct args')
  it('handleOpenRecent constructs correct file path')
  it('handleBrowseProject opens directory picker and loads project')

  // Loading State Tests
  it('shows loading spinner when isLoading is true')
  it('hides action cards when isLoading is true')

  // Error Handling Tests
  it('displays ErrorAlert when error exists')
  it('passes clearError to ErrorAlert')

  // Conditional Rendering Tests
  it('hides RecentProjectsSection when no recent projects')
  it('hides LauncherFooter when appInfo is null')
})
```

---

## 8. Benefits After Refactoring

### Quantitative Improvements

| Metric                | Before    | After                 | Improvement      |
| --------------------- | --------- | --------------------- | ---------------- |
| Main file LOC         | 631 lines | ~100-150 lines        | 76-84% reduction |
| JSX lines             | 534 lines | ~80-100 lines         | 81-85% reduction |
| Largest component     | 631 lines | ~200 lines            | 68% reduction    |
| Testable units        | 1 page    | 7 components          | 700% increase    |
| Component reusability | 0 shared  | 1 shared (ErrorAlert) | ∞                |

---

### Qualitative Improvements

#### 1. Maintainability ✅

- **Easier to find code:** Each feature in its own file
- **Smaller cognitive load:** Understand one component at a time
- **Clearer responsibilities:** Each component has single purpose
- **Better git diffs:** Changes isolated to specific components

**Example:** To modify create form validation, only edit `CreateProjectCard.tsx` instead of navigating 631-line file.

---

#### 2. Testability ✅

- **Isolated testing:** Each component tested without parent dependencies
- **Faster test execution:** Smaller components = faster renders
- **Better test coverage:** Each component has dedicated test file
- **Easier mocking:** Clear prop interfaces reduce mock complexity

**Example:** Test form validation in `CreateProjectCard.test.tsx` without loading entire page and store.

---

#### 3. Reusability ✅

- **ErrorAlert in common/:** Can be used in Settings, Mixer, Download pages
- **Pattern established:** Other pages can follow same extraction pattern
- **Consistent UX:** Shared components ensure consistent behavior

**Example:** Settings page can import `ErrorAlert` instead of duplicating error display logic.

---

#### 4. Readability ✅

- **Clear component hierarchy:** Parent orchestrates, children specialize
- **Self-documenting structure:** File names describe responsibilities
- **Less scrolling:** Find what you need faster
- **Better code reviews:** Reviewers focus on specific components

**Before:** "Where's the create form logic?" → Search 631 lines
**After:** "Where's the create form logic?" → Open `CreateProjectCard.tsx`

---

#### 5. Compliance ✅

- **Follows project guideline:** "Keep components small" (400-500 lines max)
- **Matches existing patterns:** Same structure as Settings page
- **Adheres to architecture:** Components in `components/` subdirectory
- **Uses established conventions:** TypeScript interfaces, test co-location

---

#### 6. Developer Experience ✅

- **Easier onboarding:** New developers understand smaller components faster
- **Faster iteration:** Modify single component without touching others
- **Better IDE support:** Faster intellisense and go-to-definition
- **Clearer errors:** Stack traces point to specific components

---

## 9. Migration Safety Checklist

Before starting implementation, ensure:

- [ ] All existing tests pass (`yarn test`)
- [ ] No uncommitted changes in ProjectLauncher page
- [ ] Create feature branch: `refactor/project-launcher-components`
- [ ] Review current page functionality to preserve behavior

During implementation:

- [ ] Extract one component at a time
- [ ] Write tests before extraction (TDD approach)
- [ ] Verify page still works after each extraction
- [ ] Commit after each successful extraction
- [ ] Keep existing test-ids for E2E test compatibility

After completion:

- [ ] All existing tests still pass
- [ ] New component tests added and passing
- [ ] Visual review in dev environment
- [ ] Code review by team
- [ ] Update architecture documentation if needed

---

## 10. Success Criteria

### Must Have (Definition of Done)

- ✅ Main `index.tsx` reduced to ≤150 lines
- ✅ All 6-7 components extracted and functional
- ✅ All components have test files with >80% coverage
- ✅ No breaking changes to existing functionality
- ✅ All existing test-ids preserved
- ✅ ErrorAlert component moved to `common/` and reusable

### Nice to Have (Stretch Goals)

- ✅ Snapshot tests for all components
- ✅ Storybook stories for each component (future)
- ✅ JSDoc comments on all props interfaces
- ✅ Update architecture documentation with new structure
- ✅ Apply same pattern to other large pages

---

## 11. Rollout Plan

### Phase 1: Foundation (Week 1)

- Extract CreateProjectCard (highest impact)
- Extract RecentProjectsSection + RecentProjectCard
- **Deliverable:** Main page reduced by ~43%

### Phase 2: Reusability (Week 1)

- Extract ErrorAlert to common/
- Extract OpenProjectCard
- **Deliverable:** Main page reduced by ~61%, reusable component added

### Phase 3: Polish (Week 2)

- Extract LauncherHeader
- Extract LauncherFooter
- **Deliverable:** Main page reduced by ~80%, all components extracted

### Phase 4: Documentation (Week 2)

- Update architecture docs
- Add JSDoc comments
- Create component README if needed
- **Deliverable:** Complete documentation

---

## 12. Future Enhancements

After refactoring is complete, consider:

1. **Form Validation Library**
   - Add Zod schema validation to CreateProjectCard
   - Provide inline error messages for invalid inputs

2. **Recent Projects Features**
   - Add context menu (rename, delete, open in explorer)
   - Add drag-and-drop reordering
   - Add project thumbnail/preview

3. **Empty States**
   - Add EmptyState component for no recent projects
   - Show onboarding message for first-time users

4. **Performance Optimization**
   - Memoize RecentProjectCard components
   - Use React.memo for pure components
   - Lazy load components if page load time increases

5. **Apply Pattern to Other Pages**
   - Refactor Settings page (already has components/ directory)
   - Apply to future Mixer, Download, Search pages
   - Create shared component library

---

## 13. Questions & Decisions Log

### Q1: Should we extract LoadingState component?

**Decision:** No, keep inline (only 15 lines, not complex enough)

### Q2: Where should ErrorAlert component live?

**Decision:** Move to `components/common/` for reusability

### Q3: Should form state stay in parent or move to CreateProjectCard?

**Decision:** Move to CreateProjectCard (self-contained component)

### Q4: Should we split project card into separate component?

**Decision:** Yes, extract to RecentProjectCard

### Q5: Should we create separate style files for each component?

**Decision:** No, keep Chakra inline styles + shared animations in ProjectLauncher.styles.tsx

---

## 14. References

- **Project Guidelines:** `AGENTS.md` - "Keep components small" (400-500 lines max)
- **Architecture Patterns:** `.architecture/` - Component structure and organization
- **Example Structure:** `src/renderer/pages/Settings/` - Components subdirectory pattern
- **Shared Components:** `src/renderer/components/common/` - Reusable component location
- **Testing Patterns:** Existing test files for guidance on test structure

---

**Plan Approved By:** _[To be filled]_
**Implementation Start Date:** _[To be filled]_
**Target Completion Date:** _[To be filled]_

---
