---
name: architect
description: Comprehensive guide for planning and reviewing Electron application architecture with focus on code quality, maintainability, and best practices. Use this skill when working with Electron applications for (1) Planning architecture for new Electron apps, (2) Reviewing existing Electron app architecture, (3) Creating architecture documentation and plans, (4) Organizing code structure for main/renderer/preload processes, (5) Designing IPC communication patterns, or (6) Ensuring security and performance best practices in Electron apps.
---

# Electron Architecture Skill

Comprehensive guidance for designing, planning, and reviewing Electron application architecture with emphasis on security, maintainability, and code quality.

## Core Workflow

When working on Electron architecture tasks, follow this process:

### 1. Understand Requirements

For new applications:
- Identify key features and use cases
- Determine target platforms (Windows/macOS/Linux)
- Clarify performance and security requirements
- Understand data storage needs

For existing applications:
- Review current code structure
- Identify architectural pain points
- Assess security posture
- Evaluate maintainability issues

### 2. Design Process Architecture

Determine what belongs in each process:

**Main Process** (Node.js environment):
- Application lifecycle
- Window management
- Business logic and data processing
- File system and database access
- Native OS interactions
- IPC message handling

**Renderer Process** (Chromium environment):
- UI rendering and display
- User interactions
- UI state management
- Communication with main via IPC

**Preload Scripts** (Bridge):
- Expose minimal, specific APIs to renderer
- Validate and transform data
- Create secure abstraction layer

### 3. Design IPC Communication

Plan communication channels between processes:
- Identify required operations (read data, write data, notifications, etc.)
- Choose appropriate patterns (request-response, one-way, push updates, streams)
- Define channel naming convention: `domain:action[:event]`
- Document message validation requirements

**Reference**: See [process-architecture.md](references/process-architecture.md) for detailed IPC patterns and examples.

### 4. Plan Code Organization

Organize code for maintainability:
- Use feature-based organization (group by domain, not by technical role)
- Establish clear module boundaries
- Define service layer for business logic
- Plan dependency injection strategy
- Structure tests to mirror source code

**Reference**: See [code-organization.md](references/code-organization.md) for directory structure and module patterns.

**Asset**: See [directory-structure-example.txt](assets/directory-structure-example.txt) for recommended project structure.

### 5. Apply Security Best Practices

Ensure application security:
- **Context Isolation**: Enable `contextIsolation: true`
- **Node Integration**: Disable `nodeIntegration` in renderer
- **Preload Scripts**: Use `contextBridge.exposeInMainWorld`
- **CSP**: Configure Content Security Policy
- **Validation**: Validate all IPC messages
- **Principle of Least Privilege**: Expose minimal APIs to renderer

**Reference**: See [best-practices.md](references/best-practices.md) for comprehensive security checklist.

### 6. Create Architecture Documentation

When planning a new architecture or documenting an existing one:

**Use the architecture plan template** as a guide:
- Read [architecture-plan-template.md](references/architecture-plan-template.md)
- Fill in all relevant sections
- Document key architectural decisions
- Include IPC channel definitions
- Document security measures
- Plan testing strategy

The template includes:
- Application overview
- Process architecture design
- IPC communication design
- Security architecture
- Directory structure
- State management strategy
- Data architecture
- Build & development setup
- Testing strategy
- Performance optimization
- Error handling & logging
- Architecture Decision Records (ADRs)

### 7. Monitor Code Size

Track file sizes to enforce maintainability thresholds using `scripts/count-lines.py`:

```bash
python scripts/count-lines.py --critical   # Files needing refactoring (>500 lines)
python scripts/count-lines.py --top 15     # Top 15 largest files
python scripts/count-lines.py --category services  # Filter by category
python scripts/count-lines.py --json       # JSON output for CI/automation
```

**Categories**: Main Services, Renderer Components, Pages, Stores, IPC Handlers, Shared, Preload.
**Thresholds**: Critical > 500 lines, Warning > 400 lines, Ideal: 200-300 lines.

**When to use during architecture work**:
- Review existing architecture — run `--critical` to find pain points
- After refactoring — verify files dropped below thresholds
- Planning splits — run `--category <name>` to scope the work
- CI integration — use `--json` output to fail builds on threshold violations

Full refactoring plans per file are in `docs/CODE_SIZE_ANALYSIS.md`.

### 8. Review Architecture Quality (Checklist)

When reviewing existing or planned architecture, check:

**Security** (references/best-practices.md):
- [ ] Context isolation enabled
- [ ] Node integration disabled
- [ ] Preload uses contextBridge
- [ ] IPC validation implemented
- [ ] CSP configured
- [ ] Minimal API exposure

**Process Architecture** (references/process-architecture.md):
- [ ] Clear separation of main/renderer responsibilities
- [ ] Secure IPC patterns used
- [ ] No synchronous IPC calls
- [ ] Proper error handling in IPC

**Code Organization** (references/code-organization.md):
- [ ] Logical directory structure
- [ ] Clear module boundaries
- [ ] Consistent naming conventions
- [ ] TypeScript properly configured
- [ ] Tests organized and comprehensive

**Performance**:
- [ ] Code splitting implemented
- [ ] Lazy loading for non-critical code
- [ ] No blocking operations in main process
- [ ] Resource cleanup implemented

## Reference Files

Load these references as needed for detailed guidance:

### [best-practices.md](references/best-practices.md)
Core Electron architecture principles, security best practices, common anti-patterns to avoid, and architecture quality checklist.

**When to read**:
- Starting a new architecture plan
- Reviewing architecture quality
- Need security guidance
- Identifying anti-patterns

### [process-architecture.md](references/process-architecture.md)
Detailed process model, secure IPC patterns with code examples, context isolation setup, multi-window architecture, and error handling.

**When to read**:
- Designing IPC communication
- Need code examples for IPC patterns
- Working with multi-window apps
- Security configuration questions

### [code-organization.md](references/code-organization.md)
Directory structure recommendations, module organization patterns, dependency management, TypeScript configuration, testing strategies, and naming conventions.

**When to read**:
- Organizing project structure
- Setting up build configuration
- Planning testing strategy
- Establishing coding standards

### [architecture-plan-template.md](references/architecture-plan-template.md)
Comprehensive template for creating architecture plans with all sections: overview, process design, IPC design, security, state management, testing, and more.

**When to read**:
- Creating architecture documentation
- Planning new application
- Documenting architecture decisions
- Need structured planning format

## Common Architecture Patterns

### Secure IPC Communication
```typescript
// Main: main/ipc/user-handlers.ts
ipcMain.handle('user:get', async (event, userId: string) => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID');
  }
  return await userService.getUser(userId);
});

// Preload: preload/api.ts
contextBridge.exposeInMainWorld('api', {
  getUser: (userId: string) => ipcRenderer.invoke('user:get', userId)
});

// Renderer: renderer/services/user.service.ts
const user = await window.api.getUser('123');
```

### Service Layer Pattern
```typescript
// Separate business logic from IPC
export class UserService {
  constructor(private userRepo: UserRepository) {}

  async getUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) throw new Error('User not found');
    return this.enrichUserData(user);
  }
}
```

### Feature-Based Organization
```
src/renderer/features/
├── user-profile/
│   ├── components/
│   ├── hooks/
│   ├── store/
│   └── types.ts
└── dashboard/
    └── ...
```

## Key Principles to Remember

1. **Security First**: Always enable context isolation and disable node integration in renderer
2. **Process Separation**: Keep business logic in main, UI in renderer, minimal bridge in preload
3. **Clear Boundaries**: Separate concerns with service layers and repository patterns
4. **Type Safety**: Use TypeScript throughout with proper configurations for each process
5. **Testability**: Design for testing with dependency injection and clear interfaces
6. **Performance**: Avoid synchronous IPC, implement code splitting, optimize bundles
7. **Maintainability**: Use consistent patterns, document decisions, organize by feature

## Deliverables

When completing architecture work, produce:

### For Planning Tasks
- Comprehensive architecture plan following the template
- IPC channel definitions with data structures
- Directory structure diagram or description
- Key architectural decisions documented
- Security checklist completed

### For Review Tasks
- Architecture assessment report
- Identified issues and recommendations
- Security vulnerabilities found
- Code organization improvements
- Performance optimization opportunities

## Tips for Effective Architecture

- **Start Simple**: Don't over-engineer; add complexity only when needed
- **Document Decisions**: Use Architecture Decision Records (ADRs) for important choices
- **Validate Early**: Test IPC communication early in development
- **Security by Default**: Apply security best practices from the start, not as an afterthought
- **Measure Performance**: Profile startup time, memory usage, and bundle size
- **Iterate**: Architecture evolves; review and refactor as requirements change
