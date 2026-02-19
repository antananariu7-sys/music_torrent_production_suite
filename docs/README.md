# Music Production Suite - Documentation

This directory contains all project documentation organized by category.

## 📁 Directory Structure

```
docs/
├── architecture/     # Architecture and system design documents
├── guides/          # Development guides and best practices
├── api/             # API references and quick guides
└── README.md        # This file
```

## 📚 Documentation Categories

### [Architecture](architecture/)

Core architecture and system design documents covering:
- Application overview and components
- Process architecture (Main/Renderer/Preload)
- IPC communication patterns
- Web automation with Puppeteer
- Security architecture
- Directory structure
- Data models and TypeScript interfaces
- UI architecture
- Dependencies and build system
- Development roadmap
- Project system architecture
- Refactoring plans

**Key Files**:
- [01-overview.md](architecture/01-overview.md) - Start here for application overview
- [15-project-system.md](architecture/15-project-system.md) - Project-based workflow
- [10-development-plan.md](architecture/10-development-plan.md) - Roadmap and ADRs

### [Guides](guides/)

Practical implementation guides and best practices:
- **[development.md](guides/development.md)** - Code quality, patterns, security
- **[testing.md](guides/testing.md)** - Testing standards and strategies
- **[rutracker-implementation.md](guides/rutracker-implementation.md)** - RuTracker integration
- **[enhanced-search.md](guides/enhanced-search.md)** - Search features and MusicBrainz
- **[smart-search-integration.md](guides/smart-search-integration.md)** - Smart search (MusicBrainz) integration
- **[chakra-ui-style-guide.md](guides/chakra-ui-style-guide.md)** - Chakra UI v3 styling guide and patterns
- **[unit-test-coverage-plan.md](guides/unit-test-coverage-plan.md)** - Unit test coverage plan

### [API](api/)

API documentation and quick references:
- **[search-api-reference.md](api/search-api-reference.md)** - Search API quick reference

## 🎯 Getting Started

1. **New to the project?** Start with [ARCHITECTURE.md](../ARCHITECTURE.md) (root) for the main index
2. **Need architecture details?** Browse [architecture/](architecture/) for system design
3. **Ready to implement?** Check [guides/](guides/) for practical guidance
4. **Need API info?** See [api/](api/) for quick references

## 🔗 Related Documentation

- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Main architecture index (project root)
- **[../AGENTS.md](../AGENTS.md)** - Project rules for AI agents
- **[../README.md](../README.md)** - Project README

## 📝 Documentation Updates

**Version**: 2.1
**Last Updated**: 2026-02-17

### Recent Changes
- Reorganized documentation from `.architecture/` to `docs/`
- Created logical subdirectories (architecture, guides, api)
- Updated all cross-references
- Added this README for navigation

---

**Maintained by**: Project contributors using [architect skill](../.claude/skills/architect/)
