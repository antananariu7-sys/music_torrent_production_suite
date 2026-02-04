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
               script-src 'self';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data:;
               font-src 'self';">
```

### Security Considerations
- **Credential Storage**: Use electron-store with encryption (AES-256)
- **Secure Communication**: HTTPS only for database website
- **Input Validation**: Validate all user input in both renderer and main
- **File Operations**: Restricted to allowed directories
- **No Code Execution**: No `eval()` or similar dynamic code execution
- **External URLs**: Opened in default browser, not in-app
- **Session Security**:
  - Session cookies stored encrypted
  - Auto-logout after inactivity period
  - Clear session data on logout
- **Web Scraping Security**:
  - Sanitize all extracted HTML content
  - Validate URLs before navigation
  - Timeout limits on page loads
- **Regular Updates**: Automated dependency scanning and security audits
- **Code Signing**: Required for both Windows and macOS builds

### Credential Storage Implementation
```typescript
import Store from 'electron-store'
import { safeStorage } from 'electron'

// Encrypted store for credentials
const store = new Store({
  encryptionKey: 'your-encryption-key',
  name: 'secure-credentials'
})

// Store credentials (encrypted by electron-store)
function saveCredentials(username: string, password: string) {
  // Additional encryption using Electron's safeStorage
  const encryptedPassword = safeStorage.encryptString(password)
  store.set('credentials', {
    username,
    password: encryptedPassword.toString('base64')
  })
}

// Retrieve credentials
function getCredentials() {
  const data = store.get('credentials')
  if (!data) return null

  const passwordBuffer = Buffer.from(data.password, 'base64')
  const decryptedPassword = safeStorage.decryptString(passwordBuffer)

  return {
    username: data.username,
    password: decryptedPassword
  }
}
```

### Threat Model
| Threat | Risk | Mitigation |
|--------|------|------------|
| Credential theft | Critical | AES-256 encryption, OS-level keychain integration |
| Malicious IPC messages | High | Strict validation, type checking, rate limiting |
| Path traversal attacks | High | Sanitize all file paths, restrict to app directories |
| XSS in renderer | Medium | CSP headers, React's built-in XSS protection |
| Session hijacking | High | Encrypted cookie storage, session validation |
| Scraped content injection | Medium | Sanitize all HTML, validate extracted data |
| Dependency vulnerabilities | Medium | Automated dependency scanning, regular updates |
| Code injection | High | No eval, strict CSP, code signing |
| Rate limiting/IP blocking | Medium | Politeness delays, respect robots.txt, user-agent ID |
