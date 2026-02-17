# Security Architecture

This document describes the security architecture and best practices for the application.

## 5. Security Architecture

### Context Isolation
- [x] Context isolation enabled (`contextIsolation: true`)
- [x] Node integration disabled (`nodeIntegration: false`)
- [x] Preload script uses `contextBridge.exposeInMainWorld`
- [x] Minimal API surface exposed to renderer
- [x] No remote module usage
- [x] Sandbox enabled for renderer processes

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               media-src 'self' data:;">
```

> **Note**: CSP is enforced both as an HTML meta tag in `src/renderer/index.html` and as HTTP response headers in `src/main/window.ts`.

### Security Considerations
- **Credential Storage**: Password is **never stored** — only username kept in memory for convenience. Session cookies stored as plain JSON (see Current Implementation below)
- **Secure Communication**: HTTPS only for database website
- **Input Validation**: Validate all user input in both renderer and main
- **File Operations**: Restricted to allowed directories
- **No Code Execution**: No `eval()` or similar dynamic code execution
- **External URLs**: Opened in default browser, not in-app
- **Session Security**:
  - Session cookies stored in `{userData}/sessions/rutracker-session.json`
  - Background session validation every 15 minutes
  - Clear session data on logout
- **Web Scraping Security**:
  - Sanitize all extracted HTML content
  - Validate URLs before navigation
  - Timeout limits on page loads
- **Regular Updates**: Automated dependency scanning and security audits
- **Code Signing**: Recommended for both Windows and macOS builds (not currently enforced in build config)

### Credential Storage — Current Implementation

The actual implementation in `src/main/services/AuthService.ts`:

```typescript
// Password is NEVER stored — only used during the Puppeteer login flow and discarded
// Username is kept in memory only (when "remember me" is checked)

// Session persistence: cookies saved as plain JSON
// File: {userData}/sessions/rutracker-session.json
interface PersistedSession {
  cookies: Electron.Cookie[]
  username: string
  sessionExpiry: number
  savedAt: string
}

// Background validation runs every 15 minutes
// On logout, session file is deleted
```

> **Note**: Password is never stored, only the username for convenience.
> Session cookies are stored as **unencrypted JSON**. See "Recommended Improvements" below.

### Recommended Security Improvements

The following improvements would strengthen the credential storage:

```typescript
// 1. Use safeStorage to encrypt session cookies before writing to disk
import { safeStorage } from 'electron'

const encrypted = safeStorage.encryptString(JSON.stringify(sessionData))
fs.writeFileSync(sessionPath, encrypted)

// 2. Use electron-store with encryptionKey for settings
import Store from 'electron-store'
const store = new Store({ encryptionKey: 'derived-key' })
```

### Threat Model
| Threat | Risk | Mitigation |
|--------|------|------------|
| Credential theft | Critical | Password never stored; session cookies stored as plain JSON |
| Malicious IPC messages | High | Strict validation, type checking, rate limiting |
| Path traversal attacks | High | Sanitize all file paths, restrict to app directories |
| XSS in renderer | Medium | CSP headers, React's built-in XSS protection |
| Session hijacking | High | Plain JSON cookie storage, background validation every 15 min |
| Scraped content injection | Medium | Sanitize all HTML, validate extracted data |
| Dependency vulnerabilities | Medium | Automated dependency scanning, regular updates |
| Code injection | High | No eval, strict CSP, code signing |
| Rate limiting/IP blocking | Medium | Politeness delays, respect robots.txt, user-agent ID |
