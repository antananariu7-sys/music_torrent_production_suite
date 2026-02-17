# Development Guidelines

This document provides comprehensive development guidelines for the Music Production Suite, covering code quality standards, architecture patterns, security best practices, and development workflows.

---

## Table of Contents

1. [Code Quality Standards](#code-quality-standards)
2. [Architecture Patterns](#architecture-patterns)
3. [Component Development](#component-development)
4. [State Management](#state-management)
5. [IPC Communication](#ipc-communication)
6. [Security Best Practices](#security-best-practices)
7. [Performance Guidelines](#performance-guidelines)
8. [Error Handling](#error-handling)
9. [TypeScript Guidelines](#typescript-guidelines)
10. [File Organization](#file-organization)

---

## Code Quality Standards

### General Principles

**Write Clean, Readable Code**
- Code is read more often than written
- Prioritize clarity over cleverness
- Use meaningful variable and function names
- Keep functions small and focused (single responsibility)

**Follow Existing Patterns**
- Consistency is more important than personal preference
- Match the style of the surrounding code
- Use established patterns from the codebase

**Comment Complex Logic**
- Explain **why**, not **what** (code shows what)
- Document non-obvious decisions and trade-offs
- Add JSDoc comments for public APIs
- Remove commented-out code (Git preserves history)

### Code Review Checklist

Before committing code, verify:
- [ ] Code follows project conventions
- [ ] No unnecessary console.log statements in production code
- [ ] No commented-out code
- [ ] TypeScript types are explicit (no `any`)
- [ ] Error handling is implemented
- [ ] Tests are written and passing
- [ ] No security vulnerabilities introduced
- [ ] Performance impact considered

---

## Architecture Patterns

### Process Separation

**Main Process** (Node.js environment):
```typescript
// ✅ Good: Business logic in main process
// src/main/services/ProjectService.ts
export class ProjectService {
  async createProject(name: string): Promise<Project> {
    // File system operations
    // Database access
    // Business logic
    return project
  }
}
```

**Renderer Process** (Browser environment):
```tsx
// ✅ Good: UI and presentation logic
// src/renderer/pages/Dashboard.tsx
export function Dashboard() {
  const projects = useProjectStore(state => state.projects)
  return <ProjectList projects={projects} />
}
```

**Preload Script** (Secure bridge):
```typescript
// ✅ Good: Minimal, secure API exposure
// src/preload/index.ts
contextBridge.exposeInMainWorld('api', {
  createProject: (name: string) => ipcRenderer.invoke('project:create', name)
})
```

### Service Layer Pattern

**Separate business logic from IPC handlers**:

```typescript
// ✅ Good: Service contains business logic
// src/main/services/search.service.ts
export class SearchService {
  constructor(
    private scraperService: ScraperService,
    private authService: AuthService
  ) {}

  async search(request: SearchRequest): Promise<SearchResponse> {
    const isAuthenticated = await this.authService.isAuthenticated()
    if (!isAuthenticated) {
      throw new Error('Authentication required')
    }
    return this.scraperService.search(request)
  }
}

// IPC handler is thin wrapper
// src/main/ipc/searchHandlers.ts
ipcMain.handle(IPC_CHANNELS.SEARCH_START, async (_event, request: SearchRequest) => {
  return searchService.search(request)
})
```

### Dependency Injection

**Use constructor injection for testability**:

```typescript
// ✅ Good: Dependencies injected
export class TorrentService {
  constructor(
    private downloadService: DownloadService,
    private fileService: FileService
  ) {}
}

// Easy to test with mocks
const mockDownloadService = createMock<DownloadService>()
const torrentService = new TorrentService(mockDownloadService, fileService)
```

---

## Component Development

### Component Structure

**Functional Components with Hooks**:
```tsx
// ✅ Good: Clear structure
import { useState, useEffect } from 'react'
import { Box, Button } from '@chakra-ui/react'

interface ProjectCardProps {
  project: Project
  onSelect: (id: string) => void
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    await onSelect(project.id)
    setIsLoading(false)
  }

  return (
    <Box data-testid={`project-card-${project.id}`}>
      <Button
        data-testid="select-button"
        onClick={handleClick}
        loading={isLoading}
      >
        Select Project
      </Button>
    </Box>
  )
}
```

### Component Organization

**Feature-based grouping with colocated tests**:
```
src/renderer/components/features/ProjectManager/
├── ProjectList.tsx               # Container component
├── ProjectList.test.tsx          # Unit test (colocated)
├── ProjectCard.tsx               # Presentational component
├── ProjectCard.test.tsx          # Unit test (colocated)
├── CreateProjectDialog.tsx       # Modal component
├── CreateProjectDialog.test.tsx  # Unit test (colocated)
├── ProjectSettings.tsx           # Settings component
├── ProjectSettings.test.tsx      # Unit test (colocated)
├── index.ts                      # Public exports
└── types.ts                      # Component-specific types
```

**Why colocate tests?**
- Tests are always next to the code they test
- When you refactor/move a component, its test moves with it
- When you delete a component, you naturally delete its test
- No need to mirror directory structures in a separate test folder

### Props Guidelines

**Define explicit prop interfaces**:
```tsx
// ✅ Good: Explicit interface
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

// ❌ Bad: Using 'any' or no types
function Button(props: any) { }
```

**Keep props minimal**:
```tsx
// ✅ Good: Pass only what's needed
<UserProfile name={user.name} avatar={user.avatar} />

// ❌ Bad: Passing entire object when only need parts
<UserProfile user={user} />
```

### Custom Hooks

**Extract reusable logic into hooks**:
```tsx
// src/renderer/hooks/useSearch.ts
export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const search = async (query: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await window.api.search.start(query)
      setResults(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }

  return { results, isLoading, error, search }
}
```

### Component Best Practices

1. **Single Responsibility**: One component, one purpose
2. **Composition over Inheritance**: Build complex UIs from simple components
3. **Keep Components Pure**: Same props = same output
4. **Lift State Up**: Share state by lifting to common ancestor
5. **Use Keys in Lists**: Always provide unique keys for list items
6. **Memoization**: Use `useMemo` and `useCallback` for expensive operations
7. **Test-Driven Development**: Write tests alongside components (colocated)

---

## State Management

### Zustand Store Structure

**Store organization**:
```typescript
// src/renderer/store/useProjectStore.ts
import { create } from 'zustand'

interface ProjectState {
  // State
  currentProject: Project | null
  projects: Project[]
  isLoading: boolean

  // Actions
  setCurrentProject: (project: Project) => void
  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  currentProject: null,
  projects: [],
  isLoading: false,

  // Actions
  setCurrentProject: (project) => set({ currentProject: project }),

  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await window.api.loadProjects()
      set({ projects, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createProject: async (name: string) => {
    const project = await window.api.createProject(name)
    set((state) => ({
      projects: [...state.projects, project],
      currentProject: project
    }))
  }
}))
```

### Store Usage in Components

**Select only needed state**:
```tsx
// ✅ Good: Select specific state
function ProjectList() {
  const projects = useProjectStore(state => state.projects)
  return <List items={projects} />
}

// ❌ Bad: Select entire store (causes unnecessary re-renders)
function ProjectList() {
  const store = useProjectStore()
  return <List items={store.projects} />
}
```

### State Management Best Practices

1. **One Store per Domain**: Separate stores for projects, auth, torrents, etc.
2. **Keep State Minimal**: Derive values instead of storing duplicates
3. **Async Actions in Store**: Encapsulate API calls in store actions
4. **Avoid Deep Nesting**: Flatten state structure when possible
5. **Reset State**: Provide reset actions for clean state management

---

## IPC Communication

### Channel Naming Convention

**Pattern**: `domain:action[:event]`

```typescript
// Commands (handle)
'project:create'
'project:load'
'project:save'
'search:start'
'search:cancel'
'torrent:add'
'torrent:pause'

// Events (on/send)
'search:progress'
'download:progress'
'auth:status-changed'
```

### Type-Safe IPC

**Define types in shared directory**:
```typescript
// src/shared/types/ipc.types.ts
export interface IpcAPI {
  // Projects
  createProject: (request: CreateProjectRequest) => Promise<ApiResponse<Project>>
  openProject: (request: OpenProjectRequest) => Promise<ApiResponse<Project>>

  // Search (namespaced)
  search: {
    start: (request: SearchRequest) => Promise<SearchResponse>
    onProgress: (callback: (progress: SearchProgressEvent) => void) => () => void
  }
}

// Extend Window interface
declare global {
  interface Window {
    api: IpcAPI
  }
}
```

**Implement in preload**:
```typescript
// src/preload/index.ts
const api: IpcAPI = {
  createProject: (name: string) =>
    ipcRenderer.invoke('project:create', name),

  onSearchProgress: (callback) => {
    ipcRenderer.on('search:progress', (_, data) => callback(data))
  }
}

contextBridge.exposeInMainWorld('api', api)
```

**Handle in main process**:
```typescript
// src/main/ipc/project-handlers.ts
import { ipcMain } from 'electron'
import { projectService } from '../services/project.service'

export function registerProjectHandlers() {
  ipcMain.handle('project:create', async (event, name: string) => {
    // Validate input
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid project name')
    }

    // Call service
    return projectService.createProject(name)
  })
}
```

### IPC Best Practices

1. **Validate All Input**: Never trust renderer process data
2. **Use `handle` for Request-Response**: Async operations with return values
3. **Use `send`/`on` for Events**: One-way notifications, progress updates
4. **No Synchronous IPC**: Avoid `sendSync` (blocks renderer)
5. **Error Handling**: Always catch and handle errors in handlers
6. **Type Safety**: Use TypeScript interfaces for all IPC messages

---

## Security Best Practices

### Context Isolation

**Always enable context isolation**:
```typescript
// src/main/window.ts
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,        // ✅ Always true
    nodeIntegration: false,         // ✅ Always false
    sandbox: true,                  // ✅ Enable sandbox
    webSecurity: true               // ✅ Enable web security
  }
})
```

### Minimal API Exposure

**Only expose necessary APIs**:
```typescript
// ✅ Good: Expose specific functions
contextBridge.exposeInMainWorld('api', {
  createProject: (name: string) => ipcRenderer.invoke('project:create', name)
})

// ❌ Bad: Expose entire ipcRenderer
contextBridge.exposeInMainWorld('ipc', ipcRenderer)
```

### Input Validation

**Validate all IPC input**:
```typescript
// ✅ Good: Use Zod schemas
import { z } from 'zod'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional()
})

ipcMain.handle('project:create', async (event, data) => {
  const validated = CreateProjectSchema.parse(data)
  return projectService.createProject(validated)
})
```

### Credential Storage

**Use secure storage for credentials**:
```typescript
// ✅ Good: Use safeStorage or keytar
import { safeStorage } from 'electron'

export class CredentialService {
  async store(key: string, value: string): Promise<void> {
    const encrypted = safeStorage.encryptString(value)
    await storage.set(key, encrypted.toString('base64'))
  }

  async retrieve(key: string): Promise<string | null> {
    const encrypted = await storage.get(key)
    if (!encrypted) return null
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }
}

// ❌ Bad: Plain text storage
fs.writeFileSync('credentials.json', JSON.stringify({ password }))
```

### Security Checklist

- [ ] Context isolation enabled
- [ ] Node integration disabled
- [ ] Sandbox enabled
- [ ] All IPC input validated
- [ ] Credentials encrypted
- [ ] CSP headers configured
- [ ] External content sanitized
- [ ] No `eval()` or similar dynamic code execution

---

## Performance Guidelines

### Renderer Performance

**Optimize re-renders**:
```tsx
// ✅ Good: Memoize expensive computations
const sortedProjects = useMemo(() => {
  return projects.sort((a, b) => a.name.localeCompare(b.name))
}, [projects])

// ✅ Good: Memoize callbacks
const handleClick = useCallback(() => {
  onSelect(project.id)
}, [project.id, onSelect])
```

**Lazy load components**:
```tsx
// ✅ Good: Lazy load heavy components
const MixerInterface = lazy(() => import('./components/Mixer/MixerInterface'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MixerInterface />
    </Suspense>
  )
}
```

### Main Process Performance

**Avoid blocking operations**:
```typescript
// ✅ Good: Async operations
async function processLargeFile(filePath: string) {
  const stream = fs.createReadStream(filePath)
  // Process in chunks
}

// ❌ Bad: Synchronous blocking
function processLargeFile(filePath: string) {
  const content = fs.readFileSync(filePath) // Blocks event loop
}
```

**Use workers for CPU-intensive tasks**:
```typescript
// ✅ Good: Use worker threads
import { Worker } from 'worker_threads'

function processAudio(audioData: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./audio-processor.worker.js')
    worker.postMessage(audioData)
    worker.on('message', resolve)
    worker.on('error', reject)
  })
}
```

### Performance Best Practices

1. **Debounce User Input**: Delay expensive operations on input changes
2. **Virtualize Long Lists**: Use react-window for large lists
3. **Code Splitting**: Split bundles by route or feature
4. **Optimize Images**: Use appropriate formats and sizes
5. **Monitor Memory**: Watch for memory leaks, especially with WebTorrent
6. **Profile Performance**: Use React DevTools and Chrome DevTools

---

## Error Handling

### Error Handling Strategy

**Three-tier error handling**:

1. **Service Layer**: Catch and transform errors
2. **IPC Layer**: Handle and format errors for renderer
3. **UI Layer**: Display user-friendly error messages

### Service Layer Errors

```typescript
// ✅ Good: Custom error classes
export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project not found: ${projectId}`)
    this.name = 'ProjectNotFoundError'
  }
}

export class ProjectService {
  async loadProject(id: string): Promise<Project> {
    try {
      const project = await this.repository.findById(id)
      if (!project) {
        throw new ProjectNotFoundError(id)
      }
      return project
    } catch (error) {
      logger.error('Failed to load project', { id, error })
      throw error
    }
  }
}
```

### IPC Error Handling

```typescript
// ✅ Good: Handle errors in IPC handlers
ipcMain.handle('project:load', async (event, id: string) => {
  try {
    return await projectService.loadProject(id)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      throw { code: 'PROJECT_NOT_FOUND', message: error.message }
    }
    throw { code: 'UNKNOWN_ERROR', message: 'Failed to load project' }
  }
})
```

### UI Error Handling

```tsx
// ✅ Good: Display user-friendly errors
function ProjectLoader({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null)

  const loadProject = async () => {
    try {
      const project = await window.api.loadProject(projectId)
      setCurrentProject(project)
    } catch (error: any) {
      if (error.code === 'PROJECT_NOT_FOUND') {
        setError('Project not found. It may have been deleted.')
      } else {
        setError('Failed to load project. Please try again.')
      }
    }
  }

  if (error) {
    return <ErrorMessage data-testid="error-message">{error}</ErrorMessage>
  }

  return <ProjectView />
}
```

### Error Handling Best Practices

1. **Never Swallow Errors**: At minimum, log them
2. **User-Friendly Messages**: Don't expose technical details to users
3. **Log Errors**: Use `console.error()` for error logging
4. **Validate Early**: Catch errors at system boundaries
5. **Graceful Degradation**: App should remain usable after errors
6. **Retry Logic**: Implement retry for transient failures

---

## TypeScript Guidelines

### Type Definitions

**Explicit types for public APIs**:
```typescript
// ✅ Good: Explicit return type
export function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ⚠️ Acceptable: Type inference for simple cases
const sum = 1 + 2  // inferred as number
```

**Avoid `any`**:
```typescript
// ✅ Good: Use proper types
function processData(data: SearchResult): void { }

// ✅ Good: Use unknown if type is truly unknown
function processData(data: unknown): void {
  if (isSearchResult(data)) {
    // Type guard
  }
}

// ❌ Bad: Using any
function processData(data: any): void { }
```

### Type Organization

**Share types across processes**:
```typescript
// src/shared/types/project.types.ts
export interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateProjectDTO {
  name: string
  description?: string
}
```

### Type Best Practices

1. **Prefer Interfaces over Types**: For object shapes
2. **Use Type for Unions**: `type Status = 'pending' | 'active' | 'completed'`
3. **Strict Mode**: Enable all strict TypeScript options
4. **No Implicit Any**: Set `noImplicitAny: true`
5. **Generic Constraints**: Use `extends` to constrain generics
6. **Utility Types**: Leverage `Partial`, `Pick`, `Omit`, `Record`, etc.

---

## File Organization

### Import Order

**Consistent import organization**:
```typescript
// 1. Node.js built-in modules
import fs from 'fs'
import path from 'path'

// 2. External dependencies
import { app, BrowserWindow } from 'electron'
import { create } from 'zustand'

// 3. Internal modules (absolute imports)
import { Project } from '@/shared/types/project.types'
import { projectService } from '@/main/services/project.service'

// 4. Relative imports
import { ProjectCard } from './ProjectCard'
import { useProjectStore } from '../store/useProjectStore'

// 5. Styles
import './styles.css'
```

### Absolute vs Relative Imports

**Prefer absolute imports when possible** for better maintainability:

```typescript
// ✅ Good: Absolute imports (easier to refactor and move files)
import { Project } from '@/shared/types/project.types'
import { projectService } from '@/main/services/project.service'
import { SearchResults } from '@/renderer/components/common/SearchResults'

// ⚠️ Acceptable: Relative imports for nearby files (same directory or parent)
import { ProjectCard } from './ProjectCard'
import { useProjectStore } from '../store/useProjectStore'

// ❌ Bad: Deep relative imports (hard to maintain, breaks when refactoring)
import { Project } from '../../../shared/types/project.types'
import { Button } from '../../components/common/Button'
```

**Benefits of absolute imports**:
- Files can be moved without updating imports
- Easier to understand where dependencies come from
- Better IDE autocomplete and refactoring support
- Cleaner, more readable code

**When to use relative imports**:
- Files in the same directory (e.g., `./ProjectCard`)
- Files in parent directory (e.g., `../store/useProjectStore`)
- Component-specific files (tests, styles next to components)

### Naming Conventions

**Files**:
- Components: `PascalCase.tsx` (e.g., `ProjectCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `validators.ts`)
- Hooks: `useCamelCase.ts` (e.g., `useAuth.ts`)
- Stores: `useCamelCase.ts` (e.g., `useProjectStore.ts`)
- Services: `PascalCase.ts` (e.g., `ProjectService.ts`)

**Directories**:
- Use `kebab-case` or `camelCase` consistently
- Feature folders: `PascalCase` (e.g., `ProjectManager/`)

**Code**:
- Constants: `UPPER_SNAKE_CASE`
- Classes: `PascalCase`
- Functions/Variables: `camelCase`
- Interfaces/Types: `PascalCase`
- Private members: prefix with `_` (e.g., `_privateMethod`)

### Module Exports

**Use named exports**:
```typescript
// ✅ Good: Named exports
export function ProjectCard() { }
export function ProjectList() { }

// ✅ Good: Barrel exports (index.ts)
export { ProjectCard } from './ProjectCard'
export { ProjectList } from './ProjectList'

// ⚠️ Use sparingly: Default exports (components only)
export default function ProjectCard() { }
```

---

## Development Workflow

### Before Starting Work

1. **Pull latest changes**: `git pull origin main`
2. **Check current state**: `git status`
3. **Create feature branch**: `git checkout -b feature/feature-name`
4. **Review related architecture docs**: Check `docs/architecture/` folder

### During Development

1. **Create test file alongside code**: When creating `Button.tsx`, also create `Button.test.tsx`
2. **Write tests first** (TDD when possible)
3. **Add `data-testid` attributes** to new UI elements
4. **Run tests frequently**: `npm test` or `npm test Button.test.tsx`
5. **Commit often**: Small, focused commits (include both code and test)
6. **Follow commit message format**: See [agents.md](../agents.md)

**Example workflow**:
```bash
# Create component and test together
touch src/renderer/components/Button.tsx
touch src/renderer/components/Button.test.tsx

# Develop with tests running in watch mode
npm test -- --watch Button.test.tsx
```

### Before Committing

1. **Run all tests**: `npm test`
2. **Run linter**: `npm run lint`
3. **Build project**: `npm run build`
4. **Review changes**: `git diff`
5. **Stage files**: `git add [specific-files]`
6. **Write descriptive commit message**

### Code Review

**As Author**:
- Provide context in PR description
- Link related issues
- Highlight important changes
- Respond to feedback promptly

**As Reviewer**:
- Check for security issues
- Verify tests exist and pass
- Ensure code follows conventions
- Look for edge cases
- Suggest improvements

---

## Documentation

### Code Documentation

**JSDoc for public APIs**:
```typescript
/**
 * Creates a new project with the given name.
 *
 * @param name - The project name (1-100 characters)
 * @param options - Optional project configuration
 * @returns The created project
 * @throws {ValidationError} If name is invalid
 *
 * @example
 * ```ts
 * const project = await createProject('My Music Project')
 * ```
 */
export async function createProject(
  name: string,
  options?: ProjectOptions
): Promise<Project> {
  // Implementation
}
```

### README Files

**Every feature folder should have a README** (optional but recommended):
```markdown
# Project Manager

Component suite for managing music production projects.

## Components

- `ProjectList` - Displays all projects
- `ProjectCard` - Individual project display
- `CreateProjectDialog` - Modal for creating projects

## Usage

\`\`\`tsx
import { ProjectList } from '@/components/features/ProjectManager'

function Dashboard() {
  return <ProjectList />
}
\`\`\`
```

---

## Resources

### Related Documentation
- [Testing Guidelines](13-testing-guidelines.md) - Testing standards and practices
- [Architecture Overview](01-overview.md) - Application architecture
- [IPC Communication](03-ipc-communication.md) - IPC patterns and examples
- [Security](05-security.md) - Security architecture
- [agents.md](../agents.md) - Project rules and conventions

### External Resources
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Best Practices](https://react.dev/learn)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

**Last Updated**: 2026-02-01
**Maintained By**: Development Team
