# Music Production Suite

Comprehensive Electron-based music production application with integrated torrent search, download management, and mixing capabilities.

## Overview

A project-based music production suite with three integrated components:

1. **Torrent Search** - RuTracker automation for finding music
2. **Download Manager** - WebTorrent-based download and seeding
3. **Music Mixer** - Audio mixing and waveform timeline editor

## Features

- **Project Management**: Create, save, and load music production projects
- **Bulk Torrent Search**: Find multiple music tracks simultaneously
- **Torrent Management**: In-app WebTorrent download queue with real-time progress, speed limits, and seeding controls
- **Waveform Timeline**: Visual mix arrangement with canvas waveforms, frequency coloring, beat grids, cue points, and crossfade editing
- **Audio Mix Export**: FFmpeg-based mix rendering with crossfades, loudness normalization, and .cue sheet generation
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
│   │   ├── ProjectLauncher/ # Project selection and creation
│   │   ├── ProjectOverview/ # Main project view with tabs (Search/Torrent/Mix/Timeline)
│   │   └── Settings/        # Application settings
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

**Renderer Process** (Vite):

- Fast HMR during development on port 5173
- Optimized production builds with code splitting
- Path aliases: `@/` → `src/renderer/`, `@shared/` → `src/shared/`
- Target: ESNext for modern JavaScript features

**Main Process** (esbuild):

- Custom build script: `scripts/build-main.mjs`
- Bundles to `dist/main/index.cjs` (CommonJS format)
- Target: `node25` matching engine requirement
- Externalizes runtime dependencies: electron, puppeteer-core, cheerio, webtorrent, music-metadata, electron-store, csv-stringify, uuid
- Path aliases: `@shared` → `src/shared/`
- Sourcemaps in development, minification in production

**Preload Script** (esbuild):

- Custom build script: `scripts/build-preload.mjs`
- Bundles to `dist/preload/index.cjs` (CommonJS format)
- Target: `node25`
- Externalizes only electron (all other dependencies bundled)
- Path aliases: `@shared` → `src/shared/`
- Sourcemaps in development, minification in production

**Type Checking**:

- Strict TypeScript with separate configs per process
- `tsconfig.main.json` - Main process (CommonJS, Node types)
- `tsconfig.preload.json` - Preload (CommonJS, Node + DOM types)
- `tsconfig.renderer.json` - Renderer (ESNext, React JSX)

**Module System**: ES Modules with Node.js 25+

## Architecture

See the [`docs/`](docs/) directory for comprehensive documentation:

**Quick Links**:

- [ARCHITECTURE.md](ARCHITECTURE.md) - Main architecture index
- [docs/architecture/01-overview.md](docs/architecture/01-overview.md) - Application overview
- [docs/architecture/02-process-architecture.md](docs/architecture/02-process-architecture.md) - Electron process architecture
- [docs/architecture/03-ipc-communication.md](docs/architecture/03-ipc-communication.md) - IPC patterns
- [docs/guides/development.md](docs/guides/development.md) - Development best practices
- [docs/guides/testing.md](docs/guides/testing.md) - Testing standards

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

- **Color Scheme**: Dark mode by default (studio dark aesthetic)
- **Brand Colors**: Electric blue palette (blue-500 to blue-900)
- **Accent Colors**: Cyan shades for secondary highlights
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

## Troubleshooting

### Build Issues

**Module resolution errors:**

- Ensure Node.js >= 25.0.0 is installed: `node --version`
- Clear dependencies and reinstall: `rm -rf node_modules yarn.lock && yarn install`
- Check that `"type": "module"` is set in package.json

**esbuild bundling errors:**

- Verify all runtime dependencies are listed in the `external` array in build scripts
- Check that path aliases match in both tsconfig and build scripts
- Ensure target platform is set to `node25`

**Electron fails to start:**

- Build main and preload first: `yarn build:main && yarn build:preload`
- Check that output files exist: `dist/main/index.cjs`, `dist/preload/index.cjs`
- Verify Vite dev server is running on port 5173 in development mode

**TypeScript errors in IDE:**

- Ensure correct tsconfig is active for the file you're editing
- Restart TypeScript server in your IDE
- Check that path aliases are configured in the appropriate tsconfig file

**Preload script not found:**

- Verify preload path in [window.ts:19](src/main/window.ts#L19): `join(__dirname, '../preload/index.cjs')`
- Ensure preload script is built: `yarn build:preload`
- Check file exists at `dist/preload/index.cjs`

## Contributing

See [agents.md](AGENTS.md) for project rules and conventions.

## License

MIT

## Status

**Current Version**: 0.3.4
**Current Phase**: Component 3 (Mix Builder + Waveform Timeline) core complete

**Completed**:

- Project management system (create, save, load projects)
- RuTracker authentication with session persistence
- Smart search with MusicBrainz integration
- Torrent collection system (per-project)
- WebTorrent download queue with real-time progress
- Audio player with playlist playback
- Mix Builder with drag-and-drop track ordering and crossfade settings
- Audio mix export (FFmpeg rendering, crossfades, loudness normalization, .cue sheets)
- Waveform timeline editor with canvas rendering, frequency coloring, beat grid, cue points, zoom/scroll, minimap
- Performance optimizations: OffscreenCanvas tile cache, binary peak cache, VirtualTrack virtualization, React.memo boundaries

**Next Steps**:

- Waveform interaction improvements (drag-to-trim, draggable cue points, crossfade preview)
