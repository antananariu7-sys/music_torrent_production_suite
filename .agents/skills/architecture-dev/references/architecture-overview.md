# Architecture Documentation Overview

This document serves as a navigation guide to the project's architecture documentation located in `.architecture/`.

## Documentation Structure

The architecture is organized into 12 comprehensive documents:

### Core Architecture (Read First)

1. **[01-overview.md](/.architecture/01-overview.md)** - Application overview and component architecture
   - Project purpose and target users
   - Three main components: Search, Download, Mixer
   - Project-based workflow
   - Technical requirements

2. **[02-process-architecture.md](/.architecture/02-process-architecture.md)** - Electron process architecture
   - Main process responsibilities
   - Renderer process responsibilities
   - Preload script patterns
   - Process separation strategy

3. **[03-ipc-communication.md](/.architecture/03-ipc-communication.md)** - Inter-Process Communication
   - IPC channel definitions
   - Request-response patterns
   - Event streaming patterns
   - Type-safe IPC implementation

### Implementation Details

4. **[04-web-automation.md](/.architecture/04-web-automation.md)** - Web automation with Puppeteer
   - RuTracker scraping patterns
   - Session management
   - Pagination handling
   - Browser lifecycle

5. **[05-security.md](/.architecture/05-security.md)** - Security guidelines
   - Context isolation requirements
   - Credential storage with safeStorage
   - Sandboxing configuration
   - Security best practices

6. **[06-directory-structure.md](/.architecture/06-directory-structure.md)** - Project structure
   - Complete directory layout
   - Module organization
   - File naming conventions
   - Feature-based organization

7. **[07-data-models.md](/.architecture/07-data-models.md)** - Data structures and types
   - TypeScript interfaces
   - Zod validation schemas
   - State management models
   - Database schemas

8. **[08-ui-architecture.md](/.architecture/08-ui-architecture.md)** - UI/UX patterns
   - React component structure
   - Zustand state management
   - Page navigation
   - UI component hierarchy

### Project Setup

9. **[09-dependencies.md](/.architecture/09-dependencies.md)** - Dependencies and tools
   - NPM packages
   - Development tools
   - Build configuration
   - Version requirements

10. **[10-development-plan.md](/.architecture/10-development-plan.md)** - Development roadmap
    - Implementation phases
    - Task breakdown
    - Priority order
    - Milestones

11. **[11-risks-and-success.md](/.architecture/11-risks-and-success.md)** - Risk assessment
    - Technical risks
    - Mitigation strategies
    - Success criteria
    - Quality metrics

### Reference Implementation

12. **[12-implementation-guide.md](/.architecture/12-implementation-guide.md)** - Specific examples
    - RuTracker login flow
    - Search execution
    - Error handling
    - Real-time logging
    - CSS selector configuration

## When to Consult Each Document

### For New Feature Implementation

**Start here:**
1. Read [01-overview.md](/.architecture/01-overview.md) to understand which component the feature belongs to
2. Check [06-directory-structure.md](/.architecture/06-directory-structure.md) to know where to create files
3. Review [07-data-models.md](/.architecture/07-data-models.md) for type definitions
4. Consult [12-implementation-guide.md](/.architecture/12-implementation-guide.md) for similar patterns

**For specific concerns:**
- **IPC communication**: Read [03-ipc-communication.md](/.architecture/03-ipc-communication.md)
- **Web scraping**: Read [04-web-automation.md](/.architecture/04-web-automation.md)
- **Security**: Read [05-security.md](/.architecture/05-security.md)
- **UI components**: Read [08-ui-architecture.md](/.architecture/08-ui-architecture.md)

### For Understanding Existing Code

1. **[06-directory-structure.md](/.architecture/06-directory-structure.md)** - Find where components live
2. **[02-process-architecture.md](/.architecture/02-process-architecture.md)** - Understand process boundaries
3. **[07-data-models.md](/.architecture/07-data-models.md)** - Understand data flow

### For Setup and Configuration

1. **[09-dependencies.md](/.architecture/09-dependencies.md)** - Install required packages
2. **[05-security.md](/.architecture/05-security.md)** - Configure security settings
3. **[10-development-plan.md](/.architecture/10-development-plan.md)** - Understand development workflow

## Key Architectural Principles

### 1. Process Separation
- Main process handles Node.js APIs, file system, web scraping
- Renderer process handles UI only
- Communication via type-safe IPC channels

### 2. Security First
```typescript
// Always use these settings
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

### 3. Service Layer Pattern
```
Renderer → IPC → Handler → Service → Data
```

### 4. Type Safety
- Shared TypeScript types in `src/shared/types/`
- Zod schemas for runtime validation
- Type-safe IPC with exposed APIs

### 5. Project-Based Workflow
```
Project {
  Component 1: Search Results
  Component 2: Downloads
  Component 3: Mixer Sessions
}
```

## Common Patterns

### Creating a New Service

Refer to [06-directory-structure.md](/.architecture/06-directory-structure.md):

```typescript
// src/main/services/example.service.ts
export class ExampleService {
  constructor(
    private dependency1: Service1,
    private dependency2: Service2
  ) {}

  async doSomething(): Promise<Result> {
    // Implementation
  }
}
```

### Creating a New IPC Handler

Refer to [03-ipc-communication.md](/.architecture/03-ipc-communication.md):

```typescript
// src/main/ipc/example-handlers.ts
import { ipcMain } from 'electron'
import { ExampleSchema } from '../../shared/schemas/example.schema'

ipcMain.handle('example:action', async (event, data) => {
  const validated = ExampleSchema.parse(data)
  const result = await services.example.doSomething(validated)
  return result
})
```

### Creating a New React Component

Refer to [08-ui-architecture.md](/.architecture/08-ui-architecture.md):

```typescript
// src/renderer/components/features/Example/ExampleComponent.tsx
import { useExampleStore } from '../../../store/useExampleStore'

export function ExampleComponent() {
  const { data, actions } = useExampleStore()

  return (
    <div>
      {/* Implementation */}
    </div>
  )
}
```

### Creating a New Zustand Store

Refer to [08-ui-architecture.md](/.architecture/08-ui-architecture.md):

```typescript
// src/renderer/store/useExampleStore.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface ExampleState {
  data: Data[]
  setData: (data: Data[]) => void
}

export const useExampleStore = create<ExampleState>()(
  devtools(
    persist(
      (set) => ({
        data: [],
        setData: (data) => set({ data })
      }),
      { name: 'example-store' }
    ),
    { name: 'ExampleStore' }
  )
)
```

## Architecture Decision Records (ADRs)

Key architectural decisions documented:

1. **Electron over web app**: Cross-platform desktop with native capabilities
2. **React over Vue/Angular**: Component-based, large ecosystem
3. **Zustand over Redux**: Simpler API, less boilerplate
4. **Puppeteer over Playwright**: Better Electron integration
5. **WebTorrent over other clients**: JavaScript-based, good Electron support
6. **Project-based workflow**: DAW-like experience for music production
7. **Service layer pattern**: Separation of concerns, testability
8. **Type-safe IPC**: Runtime validation with Zod, type safety with TypeScript

## Quick Reference Commands

```bash
# Read overview
cat .architecture/01-overview.md

# Find all IPC channel definitions
grep -r "ipcMain.handle\|ipcRenderer.invoke" .architecture/

# View directory structure
cat .architecture/06-directory-structure.md

# Check security requirements
cat .architecture/05-security.md
```

## Summary

The architecture documentation provides:
- **Complete specifications**: All aspects of the application
- **Implementation patterns**: Proven approaches for common tasks
- **Type definitions**: Shared data models
- **Best practices**: Security, performance, maintainability
- **Examples**: Real code snippets

Always consult the relevant architecture documents before implementing new features to ensure consistency with the established patterns.
