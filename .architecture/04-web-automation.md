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
- **CAPTCHA Support**: RuTracker now requires CAPTCHA for login
  - Browser runs in visible mode (headless: false) to allow manual CAPTCHA entry
  - User solves CAPTCHA in the browser window
  - System waits up to 5 minutes for CAPTCHA submission
- Navigate to login page
- Fill credentials in login form fields
- Detect CAPTCHA presence and wait for manual completion
- Submit and verify successful authentication
- Store session cookies for persistence across app restarts
- **Session Persistence**: Cookies saved to userData directory
- **Session Restoration**: Automatic session restore on app startup
- **Background Validation**: Session validity checked every 5 minutes

**Search Implementation**:
- **Direct URL Navigation**: Use URL parameters to search (e.g., `tracker.php?nm=<query>`)
- Session reuse from AuthService for authenticated searches
- Wait for results table (`#tor-tbl`) to load with `networkidle2`
- Browser instance management:
  - Headless mode by default (configurable via `DEBUG_BROWSER` env var)
  - Automatically closes browser after successful search in headless mode
  - Leaves browser open in non-headless mode for debugging
- Search requires active login session (validates before search)

**Data Extraction**:
- Parse search results from table with ID `tor-tbl`
- Results are rows with `data-topic_id` attribute
- Extract for each result:
  - **Topic ID**: From `data-topic_id` attribute
  - **Title**: From `.t-title a.tLink` selector
  - **URL**: Constructed as `https://rutracker.org/forum/{href}`
  - **Author**: From `.u-name a` selector
  - **Size**: From `.tor-size[data-ts_text]` attribute or text content
  - **Seeders**: From `.seedmed` or `.seed` selector, parsed as integer
  - **Leechers**: From `.leechmed` or `.leech` selector, parsed as integer
- Multiple selector fallbacks for robustness
- Browser console logging for debugging extraction issues
- Returns empty array on parse failure (graceful degradation)

### Authentication Flow
```typescript
1. User provides credentials in UI (username, password, remember)
2. Renderer → Main via IPC: auth:login with LoginCredentials
3. Main process (AuthService):
   - Validate credentials (non-empty username and password)
   - Initialize Puppeteer browser with system Chrome
   - Set viewport to 1280x800
   - Navigate to https://rutracker.org/forum/login.php
   - Wait 2 seconds for page load
4. Form filling:
   - Wait for username field: #login-form-full input[name="login_username"]
   - Type username into field
   - Wait for password field: #login-form-full input[name="login_password"]
   - Type password into field
5. CAPTCHA handling:
   - Check for CAPTCHA image: #login-form-full img[src*="captcha"]
   - If CAPTCHA present:
     * Log CAPTCHA detection
     * Keep browser open (visible)
     * Wait for user to solve CAPTCHA and submit (5 min timeout)
     * Wait for navigation after submission
   - If no CAPTCHA:
     * Click submit button: #login-form-full input[name="login"][type="submit"]
     * Wait for navigation (15 sec timeout)
6. Verify login:
   - Wait 2 seconds after navigation
   - Check for error message (.mrg_16)
   - If error found: return failure, leave browser open
   - Extract session cookies (filter bb_* and session* cookies)
   - If no cookies: return failure
7. Success handling:
   - Close browser
   - Generate session ID from cookies
   - Set session expiry (24 hours from now)
   - Update auth state (isLoggedIn, username, sessionExpiry)
   - Save session to file if remember=true
   - Return LoginResult with success, username, sessionId
8. Session persistence:
   - Save to {userData}/sessions/rutracker-session.json
   - Store cookies, username, sessionExpiry, savedAt timestamp
```

### Search Execution Flow
```typescript
1. User submits search query
2. Renderer → Main: search:start with SearchRequest {query, category?}
3. Main process (RuTrackerSearchService):
   - Check if user is logged in (validate auth state)
   - Return error if not authenticated
   - Get session cookies from AuthService
   - Initialize browser (if not already running)
4. Search execution:
   - Navigate to RuTracker homepage (to set domain)
   - Restore session cookies via page.setCookie()
   - Navigate directly to search URL: tracker.php?nm={encodedQuery}
   - Wait for results table (#tor-tbl) with networkidle2
   - Wait additional 2 seconds for full render
5. Parse results:
   - Execute page.evaluate() to extract data in browser context
   - Find all rows with data-topic_id attribute
   - Extract fields using CSS selectors with multiple fallbacks
   - Log parsing progress to browser console
   - Return array of SearchResult objects
6. Cleanup:
   - Close browser in headless mode
   - Leave browser open in non-headless mode for debugging
   - Return SearchResponse with success status and results
7. Error handling:
   - Return SearchResponse with success: false and error message
   - Leave browser open for inspection in non-headless mode
```

### Session Management
- **Session Persistence**:
  - Cookies saved to `{userData}/sessions/rutracker-session.json`
  - Includes username, expiry, and all session cookies
  - Automatically restored on app startup
- **Session Restoration**:
  - On app start, checks for saved session file
  - Validates session hasn't expired
  - Restores cookies and auth state
  - Shows "Session Restored" indicator in UI
- **Background Validation**:
  - Validates session every 5 minutes
  - Makes lightweight request to verify cookies still valid
  - Automatically logs out if session expired
  - Clears saved session on validation failure
- **Session Refresh**: User must re-login if session expired (CAPTCHA required)
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
- Parse HTML with page.evaluate() for browser-native parsing
- Cache parsed results to avoid re-scraping
- Handle pagination if results span multiple pages
- Validate data structure before processing

### Service Architecture

**AuthService** (`src/main/services/AuthService.ts`):
- Handles RuTracker authentication with Puppeteer
- Manages session state and cookies
- Features:
  - Session persistence to file system
  - Automatic session restoration on app startup
  - Background session validation (every 5 minutes)
  - CAPTCHA support with manual user entry
  - Browser instance lifecycle management
- Chrome path detection across platforms (Windows, Linux, macOS)
- Debug mode support via `DEBUG_BROWSER` environment variable
- Session file location: `{userData}/sessions/rutracker-session.json`

**RuTrackerSearchService** (`src/main/services/RuTrackerSearchService.ts`):
- Handles search operations on RuTracker
- Reuses AuthService session for authenticated searches
- Features:
  - Direct URL navigation with query parameters
  - Session cookie restoration from AuthService
  - Robust HTML parsing with multiple selector fallbacks
  - Browser debugging support (headless/visible modes)
  - Automatic browser cleanup in headless mode
- Validates authentication before search execution
- Returns structured SearchResponse with results or errors

### Browser Instance Management
- **Chrome Detection**: Searches common installation paths on Windows, Linux, macOS
- **Headless Mode**: Controlled by `DEBUG_BROWSER` environment variable
  - `DEBUG_BROWSER=true`: Browser visible for debugging
  - Default: Headless mode for production use
- **Lifecycle**:
  - Browser initialized on first auth/search operation
  - Kept alive for reuse across operations
  - Automatically closed after successful operations (headless mode)
  - Left open for inspection on errors or in debug mode
- **Browser Args**: Disabled sandboxing and security features for compatibility

### Environment Variables
- `DEBUG_BROWSER`: Set to `"true"` to run browser in visible mode for debugging
