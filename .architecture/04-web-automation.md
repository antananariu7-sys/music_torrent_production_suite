# Web Automation Architecture

This document describes the web automation architecture for browser automation and web scraping.

## 4. Web Automation Architecture

### Browser Automation Strategy
**Using Puppeteer-Core with Electron's Browser**
- Reuse Electron's Chromium instance (no separate browser download)
- **Run in visible mode** - Browser window shown to user for transparency and debugging
- Maintain persistent browser context for session management
- BrowserView embedded in Electron window for seamless integration

### RuTracker-Specific Implementation

**Target Site**: https://rutracker.org/forum/index.php

**Authentication**:
- Standard login form (username/password)
- Navigate to login page
- Fill credentials in login form fields
- Submit and verify successful authentication
- Store session cookies for persistence

**Search Implementation**:
- Use search box on main page
- Submit search query
- Handle paginated results (iterate through pages)
- Extract torrent links from each result page
- Support for multiple concurrent searches with rate limiting

**Data Extraction**:
- Parse search result pages
- Extract for each result:
  - Torrent title
  - Torrent download link (.torrent file URL)
  - Additional metadata (seeders, leechers, size, etc.)
- Handle pagination to collect all results

### Authentication Flow
```typescript
1. User provides credentials in UI
2. Renderer → Main via IPC: auth:login
3. Main process:
   - Launch Puppeteer browser (if not running)
   - Navigate to login page
   - Fill credentials
   - Submit form
   - Wait for successful login (verify session)
   - Store session cookies
   - Encrypt and save credentials (if remember=true)
4. Return success/failure to renderer
5. Keep browser session alive for subsequent searches
```

### Search Execution Flow
```typescript
1. User submits list of search strings
2. Renderer → Main: search:start with query list
3. Main process creates SearchJob:
   - Generate unique job ID
   - Queue all queries
   - Start processing queue
4. For each query:
   - Navigate to search page
   - Enter search query
   - Execute search
   - Wait for results
   - Parse results with Cheerio
   - Extract page matches
   - Send progress update → Renderer
   - Apply delay before next query (rate limiting)
5. When complete:
   - Cache results
   - Send completion event → Renderer
   - Return all results
```

### Session Management
- **Session Persistence**: Save cookies between app sessions
- **Session Validation**: Check if still logged in before searches
- **Session Refresh**: Re-login automatically if session expired
- **Timeout Handling**: Graceful handling of network timeouts
- **Error Recovery**: Retry failed searches with exponential backoff

### Rate Limiting & Politeness
- Configurable delay between searches (default: 2-3 seconds)
- Respect robots.txt (if applicable)
- User-agent string identification
- Maximum concurrent requests limit
- Backoff on repeated failures

### Web Scraping Best Practices
- Use CSS selectors for robust element targeting
- Handle dynamic content with proper waits
- Parse HTML with Cheerio for efficiency
- Cache parsed results to avoid re-scraping
- Handle pagination if results span multiple pages
- Validate data structure before processing
