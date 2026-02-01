# Dependencies

This document lists all main and development dependencies for the application.

## 14. Dependencies

### Main Dependencies
```json
{
  "electron": "^28.0.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "zustand": "^4.5.0",
  "puppeteer-core": "^21.0.0",
  "webtorrent": "^2.3.0",
  "electron-store": "^8.1.0",
  "cheerio": "^1.0.0-rc.12",
  "zod": "^3.22.0",
  "csv-stringify": "^6.4.0",
  "music-metadata": "^8.1.0",
  "uuid": "^9.0.0"
}
```

**Key Dependencies Explained:**
- `puppeteer-core`: Browser automation for web scraping (no bundled Chromium, uses Electron's)
- `webtorrent`: Streaming torrent client for downloading and seeding
- `electron-store`: Encrypted settings and credential storage with project persistence
- `cheerio`: Fast HTML parsing for extracting search results
- `zod`: Schema validation for IPC messages and data structures
- `csv-stringify`: Export search results to CSV format
- `music-metadata`: Extract audio metadata (title, artist, duration, bitrate)
- `uuid`: Generate unique IDs for projects, torrents, files

### Dev Dependencies
```json
{
  "typescript": "^5.3.0",
  "vite": "^5.0.0",
  "@vitejs/plugin-react": "^4.2.0",
  "electron-builder": "^24.9.0",
  "concurrently": "^8.2.0",
  "eslint": "^8.55.0",
  "@typescript-eslint/eslint-plugin": "^6.15.0",
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.1.0",
  "playwright": "^1.40.0"
}
```

### Dependency Management Strategy
- Lock file committed to repository
- Automated security scanning (Dependabot, Snyk)
- Regular updates (monthly review)
- Test before updating major versions
- Pin critical dependencies
