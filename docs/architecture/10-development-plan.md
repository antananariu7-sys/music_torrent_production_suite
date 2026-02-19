# Development Plan

This document describes the migration and rollout plan, including Architecture Decision Records (ADRs).

## 15. Migration & Rollout Plan

### Development Phases

**Phase 1: Foundation (Week 1-2)**
- Set up project structure for multi-component app
- Configure build tools (TypeScript, Vite, electron-builder)
- Implement project management system (create, load, save)
- Set up IPC communication infrastructure
- Create preload script with type-safe API
- Implement settings and project persistence

**Phase 2: Component 1 - Search Engine (Week 3-4)**
- Implement RuTracker authentication
- Build Puppeteer-based scraper service
- Create search interface and result display
- Add batch search with pagination
- Real-time logging and progress tracking
- Integration with project system

**Phase 3: Component 2 - Torrent Manager (Week 5-6)** ✅ Core Complete
- ✅ Integrate WebTorrent client (lazy-loaded ESM via dynamic import)
- ✅ Implement download queue management (FIFO with configurable concurrency)
- ✅ Create torrent progress monitoring (1s broadcast interval)
- ✅ Seeding controls and speed limits
- ✅ Queue persistence across app restarts
- ✅ Torrent collection → download queue flow
- Build audio library with metadata extraction
- File organization and storage

**Phase 4: Component 3 - Mix Builder (v0.2 — In Progress)**
- ✅ AudioPlayer with playlist support (already built)
- ✅ Song data model and ProjectService CRUD
- Song IPC channels (add/remove/update/reorder)
- MixTracklist component with play/reorder/remove actions
- AddTrackDialog (from file picker or completed downloads)
- MixTab redesign
- See full plan: `docs/architecture/16-mixer-component.md`

**Phase 5: Polish & Testing (Week 9-10)**
- Write unit and integration tests for all components
- E2E test critical workflows (search → download → mix)
- Performance optimization
- UI/UX refinements across all components
- Documentation
- Code signing setup

**Phase 6: Distribution (Week 11)**
- Set up auto-update
- Create installers for Windows and macOS
- Test installation and updates
- Prepare release notes
- Beta testing with select users

### Rollout Strategy
1. **Internal testing**: Development team
2. **Beta release**: 10-20 early adopters
3. **Staged rollout**: 25% → 50% → 100% of users
4. **Monitor**: Error rates, performance metrics
5. **Iterate**: Based on feedback

### Rollback Plan
- Keep previous version downloadable
- Auto-update can be disabled
- Document manual installation process
- Monitor error rates for quick rollback decision

## 16. Architecture Decision Records (ADRs)

### ADR-001: Use Zustand for State Management
- **Status**: Accepted
- **Context**: Need lightweight state management for React app. Redux is complex, Context API has performance issues for frequent updates.
- **Decision**: Use Zustand - simple API, TypeScript support, minimal boilerplate, good performance
- **Consequences**:
  - ✅ Faster development, less boilerplate
  - ✅ Better performance than Context API
  - ⚠️ Smaller ecosystem than Redux
  - ⚠️ Team needs to learn new library

### ADR-002: Use Vite for Renderer Build
- **Status**: Accepted
- **Context**: Need fast development experience and modern build tool for React renderer
- **Decision**: Use Vite instead of Webpack
- **Consequences**:
  - ✅ Extremely fast HMR in development
  - ✅ Modern ESM-based architecture
  - ✅ Simple configuration
  - ⚠️ Less mature Electron integration than Webpack
  - ⚠️ Some plugins might not be available

### ADR-003: Enable Context Isolation
- **Status**: Accepted
- **Context**: Security requirement to prevent renderer from accessing Node.js APIs directly
- **Decision**: Enable `contextIsolation: true` and use `contextBridge` for all main-renderer communication
- **Consequences**:
  - ✅ Significantly improved security
  - ✅ Follows Electron best practices
  - ⚠️ Requires explicit API definitions in preload
  - ⚠️ Cannot use node modules directly in renderer

### ADR-004: TypeScript for All Code
- **Status**: Accepted
- **Context**: Need type safety and better developer experience
- **Decision**: Use TypeScript for main, renderer, and preload processes
- **Consequences**:
  - ✅ Catch errors at compile time
  - ✅ Better IDE support and autocomplete
  - ✅ Self-documenting code
  - ⚠️ Slightly more complex setup
  - ⚠️ Learning curve for team members new to TypeScript

### ADR-005: WebTorrent for Downloads
- **Status**: Accepted
- **Context**: Need torrent client for downloading music files. Options: native torrent clients (libtorrent, transmission), WebTorrent, or external client integration
- **Decision**: Use WebTorrent - JavaScript-based streaming torrent client
- **Consequences**:
  - ✅ Pure JavaScript, easy integration with Electron
  - ✅ Streaming support (can play while downloading)
  - ✅ No native dependencies, easier cross-platform
  - ✅ Good API for progress monitoring
  - ⚠️ Slightly slower than native clients
  - ⚠️ Limited DHT support compared to libtorrent
  - ⚠️ Smaller swarm compatibility

### ADR-006: Project-Based Architecture
- **Status**: Accepted
- **Context**: Application needs to manage searches, downloads, and mixing in an organized way
- **Decision**: Implement project-based workflow where each project contains all related data (searches, downloads, mixes)
- **Consequences**:
  - ✅ Organized workflow similar to professional tools (DAWs, video editors)
  - ✅ Easy to backup, export, import entire projects
  - ✅ Multiple projects can coexist
  - ✅ Clear separation of data
  - ⚠️ More complex data management
  - ⚠️ Need robust save/load system
  - ⚠️ Migration between project versions may be needed
