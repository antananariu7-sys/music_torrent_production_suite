# Electron Architecture Plan Template

Use this template to create comprehensive architecture plans for Electron applications.

## 1. Application Overview

### Purpose
[Brief description of what the application does and its primary use cases]

### Target Users
[Who will use this application?]

### Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]

### Technical Requirements
- **Platform Support**: [Windows/macOS/Linux]
- **Performance**: [Startup time, memory limits, etc.]
- **Security**: [Security requirements]
- **Scalability**: [Expected data volume, concurrent operations]

## 2. Process Architecture

### Main Process Responsibilities
[What will run in the main process?]
- [Responsibility 1]
- [Responsibility 2]

### Renderer Process(es) Responsibilities
[What will run in renderer process(es)?]
- [Responsibility 1]
- [Responsibility 2]

### Preload Script Strategy
[How will you bridge main and renderer processes?]

### Multi-Window Strategy
[If applicable: Will the app have multiple windows? How will they communicate?]

## 3. IPC Communication Design

### IPC Channels

| Channel Name | Direction | Purpose | Data |
|--------------|-----------|---------|------|
| `domain:action` | R→M | [Purpose] | [Data structure] |
| `domain:action:event` | M→R | [Purpose] | [Data structure] |

### Communication Patterns
- **Request-Response**: [Which operations?]
- **One-Way Messages**: [Which notifications?]
- **Push Updates**: [What data syncs from main to renderer?]
- **Streams**: [Any long-running operations?]

### Validation Strategy
[How will you validate IPC messages?]

## 4. Security Architecture

### Context Isolation
- [ ] Context isolation enabled
- [ ] Node integration disabled
- [ ] Preload script uses contextBridge
- [ ] Minimal API surface exposed

### Content Security Policy
```
[CSP directives]
```

### Security Considerations
- [Consideration 1]
- [Consideration 2]

### Threat Model
[What are the security risks and mitigations?]

## 5. Directory Structure

```
project-name/
├── src/
│   ├── main/
│   │   ├── [main modules]
│   │   └── ...
│   ├── renderer/
│   │   ├── [renderer modules]
│   │   └── ...
│   ├── preload/
│   │   └── [preload scripts]
│   └── shared/
│       └── [shared code]
├── [other directories]
└── [config files]
```

### Module Organization Strategy
[Feature-based, layer-based, or hybrid?]

## 6. State Management

### Main Process State
[How will state be managed in main process?]
- **Approach**: [In-memory, database, file system?]
- **Persistence**: [What needs to persist?]
- **Synchronization**: [How to sync with renderer(s)?]

### Renderer Process State
[How will UI state be managed?]
- **Library**: [Redux, Zustand, Context API, etc.]
- **Structure**: [How will state be organized?]
- **IPC Integration**: [How does it connect with main process?]

## 7. Data Architecture

### Data Storage
- **Local Storage**: [What and how?]
- **Remote Storage**: [If applicable]
- **Caching Strategy**: [What gets cached?]

### Data Models
[Key data structures and their relationships]

### Data Flow
1. [Step 1: How data enters the system]
2. [Step 2: How data is processed]
3. [Step 3: How data is stored/displayed]

## 8. UI Architecture

### Framework/Library
[React, Vue, Angular, vanilla, etc.]

### Component Structure
[How will components be organized?]

### Styling Strategy
[CSS modules, styled-components, Tailwind, etc.]

### Responsive Design
[If applicable: How will you handle different screen sizes?]

## 9. Build & Development Architecture

### Build Tools
- **Main Process**: [TypeScript compiler, etc.]
- **Renderer Process**: [Vite, Webpack, etc.]
- **Bundler**: [electron-builder, electron-forge, etc.]

### Development Workflow
1. [How to start dev environment]
2. [Hot reload strategy]
3. [Debugging approach]

### Build Pipeline
1. [Build step 1]
2. [Build step 2]
3. [Package and distribute]

## 10. Testing Strategy

### Unit Testing
- **Main Process**: [What to test, tools]
- **Renderer Process**: [What to test, tools]
- **Coverage Target**: [X%]

### Integration Testing
- **IPC Testing**: [How to test IPC communication]
- **Service Integration**: [How to test service integrations]

### E2E Testing
- **Tool**: [Playwright, Spectron, etc.]
- **Test Scenarios**: [Key user flows to test]

## 11. Performance Optimization

### Bundle Optimization
- [Code splitting strategy]
- [Lazy loading approach]
- [Tree shaking]

### Runtime Optimization
- [Memory management]
- [CPU-intensive task handling]
- [Rendering optimization]

### Startup Optimization
- [What to defer until after initial render]
- [Preloading strategy]

## 12. Error Handling & Logging

### Error Handling Strategy
- **Main Process**: [How to handle and log errors]
- **Renderer Process**: [How to handle and display errors]
- **IPC Errors**: [How to handle communication failures]

### Logging Strategy
- **Log Levels**: [Debug, Info, Warn, Error]
- **Log Storage**: [Where logs are stored]
- **Log Rotation**: [If applicable]

## 13. Update & Distribution

### Auto-Update Strategy
- **Tool**: [electron-updater, etc.]
- **Update Channel**: [Stable, beta, etc.]
- **Rollback Plan**: [How to handle failed updates]

### Distribution
- **Platforms**: [Windows installer, macOS DMG, Linux AppImage, etc.]
- **Code Signing**: [Certificate requirements]
- **Update Server**: [Where updates are hosted]

## 14. Dependencies

### Main Dependencies
- `electron`: [version]
- [Other key dependencies]

### Dev Dependencies
- [Build tools]
- [Testing tools]
- [Linting tools]

### Dependency Management Strategy
[How to keep dependencies updated and secure]

## 15. Migration & Rollout Plan

### Development Phases
1. **Phase 1**: [What to build first]
2. **Phase 2**: [What comes next]
3. **Phase 3**: [Final features]

### Rollout Strategy
[How to release to users]

### Rollback Plan
[What if something goes wrong]

## 16. Architecture Decision Records (ADRs)

### ADR-001: [Decision Title]
- **Status**: [Proposed/Accepted/Deprecated]
- **Context**: [Why this decision was needed]
- **Decision**: [What was decided]
- **Consequences**: [Trade-offs and implications]

### ADR-002: [Decision Title]
[Same structure as above]

## 17. Open Questions & Risks

### Open Questions
- [ ] [Question 1]
- [ ] [Question 2]

### Technical Risks
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| [Risk] | High/Med/Low | High/Med/Low | [How to mitigate] |

## 18. Success Criteria

### Functional Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

### Non-Functional Criteria
- [ ] Startup time < [X]ms
- [ ] Memory usage < [X]MB
- [ ] Bundle size < [X]MB
- [ ] Test coverage > [X]%

## 19. Future Considerations

### Potential Enhancements
- [Enhancement 1]
- [Enhancement 2]

### Scalability Path
[How could this architecture scale if requirements change?]

### Technical Debt
[Known compromises and when to address them]
