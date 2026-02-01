# Music Production Suite - Architecture Documentation

**Comprehensive Electron-based music production application** with integrated torrent search, download management, and mixing capabilities.

> **📁 This document serves as an index to the complete architecture documentation.**
> All detailed specifications are organized in the [`.architecture/`](.architecture/) directory.

---

## 🎵 Application Overview

A project-based music production suite with three integrated components:
1. **Torrent Search** - RuTracker automation for finding music
2. **Download Manager** - WebTorrent-based download and seeding
3. **Music Mixer** - Audio mixing interface *(TBD)*

**Target Platforms**: Windows 10/11, macOS 10.13+

---

## 📚 Architecture Documentation

### Core Architecture

| Document | Description |
|----------|-------------|
| [**01-overview.md**](.architecture/01-overview.md) | Application purpose, components, project structure |
| [**02-process-architecture.md**](.architecture/02-process-architecture.md) | Main/Renderer/Preload process responsibilities |
| [**03-ipc-communication.md**](.architecture/03-ipc-communication.md) | IPC channels, patterns, validation strategy |
| [**04-web-automation.md**](.architecture/04-web-automation.md) | Puppeteer integration, RuTracker scraping flows |
| [**05-security.md**](.architecture/05-security.md) | Security architecture, threats, credential storage |

### Implementation Details

| Document | Description |
|----------|-------------|
| [**06-directory-structure.md**](.architecture/06-directory-structure.md) | Complete file/folder organization |
| [**07-data-models.md**](.architecture/07-data-models.md) | TypeScript interfaces for all data structures |
| [**08-ui-architecture.md**](.architecture/08-ui-architecture.md) | React components, pages, styling strategy |
| [**09-dependencies.md**](.architecture/09-dependencies.md) | NPM packages and dependency rationale |

### Development & Deployment

| Document | Description |
|----------|-------------|
| [**10-development-plan.md**](.architecture/10-development-plan.md) | 6-phase development roadmap, ADRs |
| [**11-risks-and-success.md**](.architecture/11-risks-and-success.md) | Technical risks, success criteria |
| [**12-implementation-guide.md**](.architecture/12-implementation-guide.md) | RuTracker-specific code examples |

---

## 🚀 Quick Start

### Key Technologies

```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "zustand": "^4.5.0",
  "puppeteer-core": "^21.0.0",
  "webtorrent": "^2.3.0",
  "typescript": "^5.3.0"
}
```

### Component Flow

```
Project → Search (RuTracker) → Download (WebTorrent) → Mix (TBD)
```

### Development Phases

1. **Foundation** (Week 1-2) - Project system, IPC infrastructure
2. **Component 1** (Week 3-4) - Search engine
3. **Component 2** (Week 5-6) - Torrent manager
4. **Component 3** (Week 7-8) - Mixer *(details TBD)*
5. **Polish** (Week 9-10) - Testing, optimization
6. **Distribution** (Week 11) - Installers, deployment

---

## 🔑 Key Architecture Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| **ADR-005** | WebTorrent for downloads | Pure JS, streaming support, cross-platform |
| **ADR-006** | Project-based architecture | Organized workflow like DAWs/video editors |
| **ADR-003** | Context isolation enabled | Security requirement for Electron apps |
| **ADR-001** | Zustand for state management | Lightweight, TypeScript-friendly |

See [10-development-plan.md](.architecture/10-development-plan.md#architecture-decision-records-adrs) for complete ADRs.

---

## 📋 Project Rules & Standards

For coding standards, commit message format, and development best practices, see:

**→ [AGENTS.md](AGENTS.md)** - Project rules for AI agents and developers

---

## 📝 Document Status

- **Version**: 1.0
- **Last Updated**: 2026-01-31
- **Status**: Initial architecture design complete
- **Next Steps**: Begin Phase 1 implementation

---

## 🔗 Related Documentation

- **[AGENTS.md](AGENTS.md)** - Project rules and conventions
- **[.claude/settings.local.json](.claude/settings.local.json)** - Claude Code configuration
- **[README.md](README.md)** - Project README *(to be created)*

---

**Architecture by**: Claude Sonnet 4.5 using [electron-architecture skill](.agents/skills/electron-architecture/)
