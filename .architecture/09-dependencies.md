# Dependencies

This document lists all main and development dependencies for the application.

## 14. Dependencies

### Runtime Environment
- **Node.js**: >=25.0.0 (ES Modules enabled with `"type": "module"`)
- **Package Manager**: Yarn (exact versions locked)

### Main Dependencies
```json
{
  "electron": "40.1.0",
  "react": "18.3.1",
  "react-dom": "18.3.1",
  "react-router-dom": "6.30.3",
  "@chakra-ui/react": "3.31.0",
  "@emotion/react": "11.14.0",
  "@emotion/styled": "11.14.1",
  "zustand": "4.5.7",
  "puppeteer-core": "21.11.0",
  "webtorrent": "2.8.5",
  "electron-store": "8.2.0",
  "cheerio": "1.2.0",
  "zod": "3.25.76",
  "csv-stringify": "6.6.0",
  "music-metadata": "8.3.0",
  "uuid": "9.0.1"
}
```

**Key Dependencies Explained:**

**UI Framework & Styling:**
- `@chakra-ui/react`: Component library for React with built-in theming and accessibility
- `@emotion/react` & `@emotion/styled`: CSS-in-JS library required by Chakra UI
- `react-router-dom`: Client-side routing for multi-page navigation

**Core Electron & React:**
- `electron`: Desktop application framework (v40.1.0 - latest stable)
- `react` & `react-dom`: UI framework for renderer process

**State Management & Data:**
- `zustand`: Lightweight state management (TypeScript-friendly, minimal boilerplate)
- `zod`: Runtime schema validation for IPC messages and data structures

**Web Automation & Torrent:**
- `puppeteer-core`: Browser automation for RuTracker scraping (uses Electron's Chromium)
- `webtorrent`: Streaming torrent client for downloading and seeding
- `cheerio`: Fast HTML parsing for extracting search results

**Data Processing & Storage:**
- `electron-store`: Encrypted settings and credential storage with project persistence
- `csv-stringify`: Export search results to CSV format
- `music-metadata`: Extract audio metadata (title, artist, duration, bitrate)
- `uuid`: Generate unique IDs for projects, torrents, files

### Dev Dependencies
```json
{
  "typescript": "5.9.3",
  "vite": "5.4.21",
  "@vitejs/plugin-react": "4.7.0",
  "esbuild": "0.27.2",
  "electron-builder": "24.13.3",
  "concurrently": "8.2.2",
  "cross-env": "10.1.0",
  "wait-on": "9.0.3",
  "eslint": "8.57.1",
  "@typescript-eslint/eslint-plugin": "6.21.0",
  "@typescript-eslint/parser": "6.21.0",
  "eslint-plugin-react": "7.37.5",
  "eslint-plugin-react-hooks": "4.6.2",
  "jest": "29.7.0",
  "@testing-library/react": "14.3.1",
  "@testing-library/jest-dom": "6.9.1",
  "@testing-library/user-event": "14.5.2",
  "playwright": "1.58.1",
  "@types/node": "20.19.30",
  "@types/react": "18.3.27",
  "@types/react-dom": "18.3.7",
  "@types/uuid": "9.0.8"
}
```

**Build & Development Tools:**
- `vite`: Fast build tool for renderer process (dev server on port 5173 + production builds)
- `esbuild`: Fast bundler for main/preload processes
  - Bundles main process to `dist/main/index.cjs` (CommonJS format)
  - Bundles preload to `dist/preload/index.cjs` (CommonJS format)
  - Externalizes runtime dependencies (electron, puppeteer-core, cheerio, webtorrent, music-metadata, electron-store, csv-stringify, uuid)
  - Supports path aliases (`@shared` → `src/shared/`)
  - Target: `node25` for modern JavaScript features
  - Custom build scripts: `scripts/build-main.mjs`, `scripts/build-preload.mjs`
- `electron-builder`: Package and distribute Electron apps (NSIS/DMG installers)
- `concurrently`: Run multiple dev scripts in parallel
- `cross-env`: Cross-platform environment variables
- `wait-on`: Wait for dev server to start before launching Electron

**Code Quality & Testing:**
- `typescript`: Type safety and better developer experience
- `eslint` + plugins: Code linting for TypeScript and React
- `jest`: JavaScript testing framework for unit and integration tests
- `@testing-library/react`: React component testing utilities
- `@testing-library/user-event`: User interaction simulation for tests
- `@testing-library/jest-dom`: Custom Jest matchers for DOM assertions
- `playwright`: End-to-end testing for Electron apps

**Type Definitions:**
- `@types/*`: TypeScript type definitions for Node.js, React, and dependencies

### Dependency Management Strategy
- **Exact Versions**: All dependencies pinned to exact versions (no `^` or `~`)
- **Lock File**: `yarn.lock` committed to repository for reproducible builds
- **Package Manager**: Yarn for faster installs and better dependency resolution
- **Regular Updates**: Monthly review of security advisories and updates
- **Testing**: Full test suite run before updating major versions
- **Security**: Automated scanning via npm audit / Yarn audit
