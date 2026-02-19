---
name: dev
description: "Provides comprehensive guidance for implementing features in an Electron + React application following established architecture patterns, best practices, and TDD methodology. Use when developers need to: (1) Create new features following the project architecture, (2) Implement services, IPC handlers, or React components, (3) Follow Test-Driven Development workflow, (4) Apply Electron security best practices, (5) Set up type-safe IPC communication, (6) Create Zustand stores, (7) Generate boilerplate code from templates, (8) Understand the project's directory structure and data models."
---

# Architecture-Driven Development Skill

This skill guides feature implementation for an Electron + React application following a comprehensive architecture and TDD best practices.

## When to Use This Skill

Use this skill when:
- **Implementing new features** according to the project architecture
- **Creating services** in the main process with dependency injection
- **Setting up IPC communication** with type-safe patterns
- **Building React components** with Zustand state management
- **Following TDD workflow** (Red-Green-Refactor cycle)
- **Applying Electron security** (context isolation, credential storage)
- **Generating boilerplate** from templates
- **Understanding project structure** and architectural decisions

## Continuous Improvement Mandate

**IMPORTANT**: This skill is a living document that must evolve with the codebase.

As new code guidelines, patterns, and best practices emerge during development, you MUST:

1. **Update Templates** (`templates/`):
   - Refine templates to reflect new patterns discovered in actual code
   - Add new templates for recurring components or patterns
   - Remove or deprecate templates that no longer match the codebase

2. **Enhance Examples** (`examples/`):
   - Add new examples based on successfully implemented features
   - Update existing examples to use newly established patterns
   - Document edge cases and solutions discovered during development

3. **Improve References** (`references/`):
   - Update best-practices.md with new security patterns, performance optimizations, or coding standards
   - Enhance tdd-guide.md with real test cases from the project
   - Expand architecture-overview.md when architectural decisions change

4. **Identify Improvement Triggers**:
   - When you write code that doesn't match existing templates → update templates
   - When you discover a better pattern than documented → update references
   - When you implement a feature differently than examples → add new example
   - When code reviews reveal new guidelines → update all relevant files
   - When you notice repeated manual corrections → automate via templates

5. **Maintain Consistency**:
   - Ensure templates, examples, and references align with actual codebase
   - Remove outdated patterns that are no longer used
   - Keep the skill synchronized with `.architecture/` documentation

**How to Update the Skill**:
- Directly edit files in `.claude/skills/dev/`
- After updates, repackage using: `python .claude/skills/skill-creator/scripts/package_skill.py .claude/skills/dev`
- Move updated package to `_packed_skills/`

This ensures the skill remains an accurate, valuable guide that grows alongside the project.

## How to Use This Skill

### 1. Understand the Architecture First

Before implementing any feature, consult `references/architecture-overview.md` to:
- Identify which component the feature belongs to (Component 1: Search, Component 2: Download, Component 3: Mixer)
- Understand the directory structure
- Know where files should be created
- Review relevant architecture documents

**Quick navigation:**
- **Process architecture**: Main vs Renderer process responsibilities
- **IPC patterns**: Request-response and event streaming
- **Security guidelines**: Context isolation and credential storage
- **Directory structure**: Complete project layout
- **Data models**: TypeScript types and Zod schemas

### 2. Choose Your Workflow

#### Pragmatic Testing Approach (Recommended)

**Core Principle**: Write tests for business logic only; skip UI tests unless necessary.

**Implementation workflow**:

1. **Define types and schemas**
   - Define types in `src/shared/types/`
   - Create Zod schemas in `src/shared/schemas/`

2. **Implement service with tests** (Business Logic)
   - Write service test first for complex business logic
   - Implement service in `src/main/services/`
   - Use templates from `templates/service.template.ts`
   - Use templates from `templates/unit-test.template.ts`

3. **Create IPC handlers**
   - Implement IPC handler in `src/main/ipc/`
   - Test only if handler has complex logic
   - Use templates from `templates/ipc-handler.template.ts`

4. **Build UI layer (minimal/no tests)**
   - Expose API in `src/preload/index.ts`
   - Create Zustand store (skip tests unless complex logic)
   - Build React component (skip tests unless critical)
   - Use templates from `templates/react-component.template.tsx`

#### For TDD Workflow (Optional)

If you prefer TDD for complex business logic:

1. **RED**: Write service test first
2. **GREEN**: Implement minimal code to pass
3. **REFACTOR**: Clean up while tests stay green
4. **Skip UI tests**: Don't write tests for components/stores unless necessary

### 3. Apply Best Practices

Consult `references/best-practices.md` for:

**Security:**
- Always use `contextIsolation: true`
- Never enable `nodeIntegration` in renderer
- Use `safeStorage` for credentials
- Validate all IPC inputs with Zod

**IPC Communication:**
- Type-safe channels with Zod validation
- Proper event subscription cleanup
- Progress updates for long operations

**React Patterns:**
- Custom hooks for IPC communication
- Zustand for state management
- Selector hooks for performance

**Service Layer:**
- Dependency injection pattern
- Single responsibility principle
- Error handling with logging

**Performance:**
- Pagination for large datasets
- Virtual scrolling for long lists
- Debouncing user input

**Project Conventions:**
- Always use `yarn` as the package manager (not npm)
- **Prefer absolute imports** (`@/shared/types`) over deep relative paths (`../../../shared/types`) for better maintainability and refactoring
- Components used in pages should be moved to `components/common/` folder

### 4. Use Templates

Templates are located in `templates/` directory. Replace placeholders (e.g., `{{SERVICE_NAME}}`) with actual values:

**Available Templates:**
- `service.template.ts` - Main process service
- `ipc-handler.template.ts` - IPC communication handler
- `react-component.template.tsx` - React component with hooks
- `zustand-store.template.ts` - Zustand state store
- `unit-test.template.ts` - Service unit test
- `integration-test.template.ts` - IPC integration test
- `e2e-test.template.ts` - End-to-end user flow test

**Template Placeholders:**

Common placeholders to replace:
- `{{SERVICE_NAME}}` - Name of the service (e.g., "search", "export")
- `{{FEATURE_NAME}}` - Name of the feature (e.g., "search-results")
- `{{TYPE_NAME}}` - TypeScript type name
- `{{METHOD_NAME}}` - Method or function name
- `{{CHANNEL_PREFIX}}` - IPC channel prefix (e.g., "search", "download")
- `{{STORE_NAME}}` - Zustand store name (e.g., "SearchStore")

### 5. Follow the Directory Structure

Place files according to the architecture (see `references/architecture-overview.md`):

```
src/
├── main/                    # Main process (Node.js)
│   ├── services/            # Business logic
│   └── ipc/                 # IPC handlers
│
├── renderer/                # Renderer process (React)
│   ├── components/
│   │   ├── common/          # Shared components
│   │   └── features/        # Feature-specific components
│   ├── pages/               # Page components
│   ├── hooks/               # Custom React hooks
│   └── store/               # Zustand stores
│
├── preload/                 # Preload scripts
│   └── index.ts             # API exposure
│
└── shared/                  # Shared code
    ├── types/               # TypeScript types
    ├── schemas/             # Zod schemas
    └── constants.ts         # Constants
```

### 6. Implement Type-Safe IPC

Follow this pattern for all IPC communication:

**1. Define shared types:**
```typescript
// src/shared/types/feature.types.ts
export interface FeatureData {
  id: string
  name: string
}
```

**2. Create Zod schema:**
```typescript
// src/shared/schemas/feature.schema.ts
import { z } from 'zod'

export const FeatureDataSchema = z.object({
  id: z.string(),
  name: z.string()
})
```

**3. Create IPC handler:**
```typescript
// src/main/ipc/feature-handlers.ts
import { ipcMain } from 'electron'
import { FeatureDataSchema } from '../../shared/schemas/feature.schema'

ipcMain.handle('feature:action', async (event, data) => {
  const validated = FeatureDataSchema.parse(data)
  return await services.feature.doSomething(validated)
})
```

**4. Expose in preload:**
```typescript
// src/preload/index.ts
const api = {
  featureAction: (data: FeatureData) =>
    ipcRenderer.invoke('feature:action', data)
}
```

**5. Use in React:**
```typescript
// src/renderer/components/Feature.tsx
const result = await window.api.featureAction(data)
```

### 7. Testing Strategy

**Pragmatic Testing**: Focus on business logic, skip UI tests unless necessary.

**Unit Tests (Business Logic Only):**
- Test services with complex business logic
- Test utilities and validators
- Test complex algorithms
- Mock dependencies
- Skip simple components and stores

**Integration Tests (Selective):**
- Test complex IPC channels only
- Skip simple request-response handlers
- Test when multiple services interact

**E2E Tests (Rare):**
- Only test critical user workflows
- Minimal coverage for high-risk paths
- Use Playwright sparingly

**What NOT to Test:**
- Simple React components
- Basic Zustand stores (getters/setters)
- UI interactions without business logic
- Presentational components

### 8. Monitor Code Size

Use `scripts/count-lines.py` to track file sizes and catch files growing beyond thresholds:

```bash
python scripts/count-lines.py --critical   # Show only files needing attention
python scripts/count-lines.py --top 15     # Top 15 largest files
python scripts/count-lines.py --category services  # Filter by category
python scripts/count-lines.py --json       # JSON output for automation
```

**Thresholds**: Critical > 500 lines, Warning > 400 lines, Ideal: 200-300 lines.

**When to run**:
- After implementing a new feature — verify no file crossed thresholds
- Before refactoring — identify highest-impact targets
- During architecture reviews — assess overall codebase health

Full analysis is maintained in `docs/CODE_SIZE_ANALYSIS.md` with refactoring plans for each oversized file.

### 9. Common Patterns

#### Creating a New Service

1. Read `templates/service.template.ts`
2. Create service in `src/main/services/`
3. Inject dependencies via constructor
4. Write comprehensive unit tests
5. Register in service container

#### Creating a New Feature

1. Review `examples/complete-feature-example.md`
2. Follow 7-step process:
   - Define types → Zod schema → Service → IPC → Preload → Store → Component
3. Write tests for each layer
4. Follow progressive disclosure for large features

#### Implementing Error Handling

- Catch errors in services
- Log errors with LoggerService
- Send user-friendly error events via IPC
- Show error dialogs in renderer
- Provide retry/skip/abort options

## Reference Documentation

Load these files as needed for detailed information:

- **`references/architecture-overview.md`** - Architecture navigation and key patterns
- **`references/best-practices.md`** - Electron + React best practices
- **`references/tdd-guide.md`** - Test-Driven Development workflow

## Examples

Load these files to see complete implementations:

- **`examples/complete-feature-example.md`** - Settings management feature (end-to-end)
- **`examples/tdd-workflow-example.md`** - CSV export with TDD workflow

## Project Architecture Location

The complete architecture documentation is located in `.architecture/` directory:

- `01-overview.md` - Application overview and components
- `02-process-architecture.md` - Electron process architecture
- `03-ipc-communication.md` - IPC patterns
- `04-web-automation.md` - Puppeteer/scraping patterns
- `05-security.md` - Security requirements
- `06-directory-structure.md` - Complete project structure
- `07-data-models.md` - Data types and schemas
- `08-ui-architecture.md` - React/UI patterns
- `09-dependencies.md` - NPM packages
- `10-development-plan.md` - Development roadmap
- `11-risks-and-success.md` - Risk assessment
- `12-implementation-guide.md` - RuTracker-specific examples

## Quick Reference

### Security Checklist

✅ `contextIsolation: true`
✅ `nodeIntegration: false`
✅ `sandbox: true`
✅ Use Zod for IPC validation
✅ Use safeStorage for credentials

### Feature Implementation Checklist

✅ Types defined in `shared/types/`
✅ Zod schemas in `shared/schemas/`
✅ Service implemented (with tests for business logic)
✅ IPC handler with validation
✅ API exposed in preload
✅ Zustand store created (skip tests unless complex)
✅ React component implemented (skip tests unless critical)
✅ Business logic tests passing

### Testing Approach

**For Business Logic:**
1. RED - Write failing test for service
2. GREEN - Implement minimal code to pass
3. REFACTOR - Improve code while tests stay green

**For UI Layer:**
1. Implement directly without tests (unless critical)
2. Manually verify functionality
3. Only add tests if business-critical

## Summary

This skill provides:
- **Architecture guidance** - Navigate comprehensive architecture docs
- **Best practices** - Electron security, IPC patterns, React hooks
- **TDD workflow** - Red-Green-Refactor methodology
- **Code templates** - Boilerplate for services, IPC, components, tests
- **Complete examples** - End-to-end feature implementations
- **Type safety** - TypeScript + Zod validation patterns

Always start by understanding the architecture, then choose your workflow (TDD or standard), apply best practices, use templates, and follow the established patterns.
