# Music Production Suite

Comprehensive Electron-based music production application with integrated torrent search, download management, and mixing capabilities.

## Overview

A project-based music production suite with three integrated components:
1. **Torrent Search** - RuTracker automation for finding music
2. **Download Manager** - WebTorrent-based download and seeding
3. **Music Mixer** - Audio mixing interface *(Architecture TBD)*

## Features

- **Project Management**: Create, save, and load music production projects
- **Bulk Torrent Search**: Find multiple music tracks simultaneously
- **Torrent Management**: Download, seed, and organize torrent files
- **Music Mixing**: Mix and edit downloaded audio files *(Component 3 - TBD)*
- **Authenticated Sessions**: Secure RuTracker login with credential storage
- **Real-time Monitoring**: Progress tracking for searches, downloads, and processing
- **Cross-platform Support**: Works on Windows and macOS

## Tech Stack

- **Electron** ^28.0.0 - Desktop application framework
- **React** ^18.2.0 - UI framework
- **TypeScript** ^5.3.0 - Type safety
- **Zustand** ^4.5.0 - State management
- **Vite** ^5.0.0 - Build tool
- **Puppeteer Core** ^21.0.0 - Web automation
- **WebTorrent** ^2.3.0 - Torrent client
- **Zod** ^3.22.0 - Schema validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd misha
```

2. Install dependencies:
```bash
npm install
```

### Development

Start the development server:
```bash
npm run dev
```

This will:
- Start Vite dev server for the renderer process (port 5173)
- Compile and run the Electron main process with debugging enabled

### Building

Build the application:
```bash
npm run build
```

Package for distribution:
```bash
npm run package        # Package for current platform
npm run package:win    # Windows
npm run package:mac    # macOS
```

### Testing

Run unit tests:
```bash
npm test
```

Run E2E tests:
```bash
npm run test:e2e
```

### Linting

```bash
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
npm run typecheck      # TypeScript type checking
```

## Project Structure

```
src/
├── main/                    # Main process (Node.js)
│   ├── index.ts             # Entry point
│   ├── window.ts            # Window management
│   ├── ipc/                 # IPC handlers
│   └── services/            # Business logic
│
├── renderer/                # Renderer process (React)
│   ├── index.html           # HTML entry
│   ├── index.tsx            # React entry
│   ├── App.tsx              # Root component
│   ├── pages/               # Page components
│   ├── components/          # UI components
│   ├── hooks/               # Custom hooks
│   ├── store/               # Zustand stores
│   └── styles/              # Global styles
│
├── preload/                 # Preload scripts
│   └── index.ts             # Main preload with context bridge
│
└── shared/                  # Shared code
    ├── types/               # TypeScript types
    ├── schemas/             # Zod schemas
    └── constants.ts         # App constants
```

## Architecture

See the [`.architecture/`](.architecture/) directory for comprehensive architecture documentation:

- [01-overview.md](.architecture/01-overview.md) - Application overview
- [02-process-architecture.md](.architecture/02-process-architecture.md) - Electron process architecture
- [03-ipc-communication.md](.architecture/03-ipc-communication.md) - IPC patterns
- [06-directory-structure.md](.architecture/06-directory-structure.md) - Complete directory structure
- And more...

## Development Workflow

This project follows a project-based workflow similar to DAWs:

1. Create a new project
2. Search for music tracks
3. Download torrents
4. Mix and edit audio
5. Export final output

## Security

- Context isolation enabled
- Node integration disabled in renderer
- Sandbox mode enabled
- Zod validation for all IPC messages
- Secure credential storage using electron-store

## Contributing

See [AGENTS.md](AGENTS.md) for project rules and conventions.

## License

MIT

## Status

**Current Phase**: Foundation - Basic application structure complete

**Next Steps**:
- Implement project management system
- Create RuTracker authentication service
- Build search interface
- Implement torrent download manager
