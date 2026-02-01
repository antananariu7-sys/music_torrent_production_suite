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

- **Electron** 40.1.0 - Desktop application framework
- **React** 18.3.1 - UI framework
- **Chakra UI** 3.31.0 - Component library with theming
- **TypeScript** 5.9.3 - Type safety
- **Zustand** 4.5.7 - State management
- **Vite** 5.4.21 - Renderer build tool
- **esbuild** 0.27.2 - Main/preload bundler
- **Puppeteer Core** 21.11.0 - Web automation
- **WebTorrent** 2.8.5 - Torrent client
- **Zod** 3.25.76 - Schema validation
- **React Router** 6.30.3 - Client-side routing

## Getting Started

### Prerequisites

- **Node.js** 25.0.0 or higher
- **Yarn** package manager
- **Git**

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd music-production-suite
```

2. Install dependencies:
```bash
yarn install
```

### Development

Start the development server:
```bash
yarn dev
```

This will:
- Build main and preload processes with esbuild
- Start Vite dev server for renderer process (port 5173)
- Launch Electron in development mode with hot reload

### Building

Build the application:
```bash
yarn build
```

Package for distribution:
```bash
yarn package        # Package for current platform
yarn package:win    # Windows (NSIS installer)
yarn package:mac    # macOS (DMG)
```

### Testing

Run unit tests:
```bash
yarn test
```

Run E2E tests:
```bash
yarn test:e2e
```

### Linting

```bash
yarn lint           # Check for issues
yarn lint:fix       # Auto-fix issues
yarn typecheck      # TypeScript type checking
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
├── renderer/                # Renderer process (React + Chakra UI)
│   ├── index.html           # HTML entry
│   ├── index.tsx            # React entry with ChakraProvider
│   ├── App.tsx              # Root component
│   ├── pages/               # Page components
│   │   └── Welcome.tsx      # Welcome/landing page
│   ├── components/          # UI components
│   ├── theme/               # Chakra UI theme
│   │   └── index.ts         # Custom theme (dark mode, brand colors)
│   ├── hooks/               # Custom hooks
│   ├── store/               # Zustand stores
│   └── styles/              # Global styles
│       └── global.css       # Base CSS reset
│
├── preload/                 # Preload scripts
│   ├── index.ts             # Main preload with context bridge
│   └── types.ts             # Type definitions for window.api
│
└── shared/                  # Shared code
    ├── types/               # TypeScript types
    ├── schemas/             # Zod schemas
    └── constants.ts         # App constants

scripts/                     # Build scripts
├── build-main.mjs           # esbuild config for main process
└── build-preload.mjs        # esbuild config for preload

dist/                        # Build output (gitignored)
├── main/                    # Compiled main process (CommonJS)
├── preload/                 # Compiled preload script (CommonJS)
└── renderer/                # Built renderer (Vite output)
```

### Build System

- **Renderer Process**: Built with Vite (fast HMR, optimized production builds)
- **Main Process**: Bundled with esbuild to CommonJS
- **Preload Script**: Bundled with esbuild to CommonJS
- **Type Checking**: Strict TypeScript with separate configs per process
- **Module System**: ES Modules with Node.js 25+

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

## UI Design

**Component Library**: Chakra UI v3 with custom theming

**Theme**:
- **Color Scheme**: Dark mode by default (gray.900 background)
- **Brand Colors**: Purple/violet palette (50-900 shades)
- **Accent Colors**: Indigo palette for highlights
- **Typography**: Built-in Chakra UI font system
- **Responsive**: Adaptive layouts with Chakra's responsive props

**Styling Approach**:
- Emotion CSS-in-JS (required by Chakra UI)
- Component-based styling with Chakra's sx prop
- Global styles for base resets
- Theme tokens for consistent spacing, colors, typography

**Benefits**:
- Pre-built accessible components (Button, Modal, Input, etc.)
- Built-in dark mode support
- TypeScript-first design
- Consistent design system

## Security

- Context isolation enabled
- Node integration disabled in renderer
- Sandbox mode enabled
- Zod validation for all IPC messages
- Secure credential storage using electron-store
- Preload script with minimal exposed APIs via contextBridge

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
