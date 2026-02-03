# Testing Authentication Flow

This guide helps you test the RuTracker authentication feature that was just implemented.

## Prerequisites

- Build the app: `npm run build`
- Start the app: `npm start`

## Testing Steps

### 1. Open the Application

```bash
npm start
```

The app should launch and show the Project Launcher screen.

### 2. Navigate to Settings

- Click the ⚙️ Settings button in the bottom navigation bar
- You should see the Settings page with three sections:
  1. **Appearance** (theme toggle)
  2. **RuTracker Authentication** (login form)
  3. **Debug: Auth State** (purple debug panel)

### 3. Check Initial State

In the **Debug: Auth State** panel, you should see:
- `isLoggedIn: false`
- `username: null`
- `sessionExpiry: null`
- `isAuthenticated(): false`

### 4. Test Login Flow

**In the RuTracker Authentication section:**

1. Enter any username (e.g., `testuser`)
2. Enter any password (e.g., `password123`)
3. Optionally check "Remember my credentials"
4. Click **LOGIN TO RUTRACKER**

**What to expect:**
- Button shows loading state for ~1 second
- After loading completes, the UI switches to "logged in" state
- You should see:
  - Green checkmark ✅
  - "LOGGED IN AS: testuser"
  - A logout button

**Debug panel should update to:**
- `isLoggedIn: true`
- `username: testuser`
- `sessionExpiry: [timestamp 24 hours from now]`
- `isAuthenticated(): true`

### 5. Check Console Logs

**Open DevTools** (View → Toggle Developer Tools or Ctrl+Shift+I)

**In the Console tab**, you should see logs like:
```
[Settings] 🔐 Login attempt: { username: 'testuser', remember: true }
[AuthService] Login attempt for user: testuser
[AuthService] Stored credentials for user: testuser
[AuthService] ✅ Login successful for user: testuser
[AuthService] Session ID: session_1738583647123
[AuthService] Session expires: 2/4/2026, 10:30:47 AM
[Settings] Login result: { success: true, username: 'testuser', sessionId: 'session_...' }
[Settings] ✅ Store updated, user logged in: testuser
```

### 6. Test Logout Flow

Click the **LOGOUT** button.

**What to expect:**
- Button shows loading state briefly
- UI switches back to login form
- Debug panel shows all values back to `false`/`null`

**Console should show:**
```
[Settings] 🚪 Logout attempt
[AuthService] Logout user: testuser
[Settings] ✅ Logout successful, store cleared
```

### 7. Test Form Validation

Try clicking **LOGIN TO RUTRACKER** without filling in the fields:

- Button should be **disabled** when fields are empty
- No API call should be made

Try filling only username:
- Button should still be **disabled**
- Password is required

### 8. Test "Remember Me" Functionality

1. Log in with "Remember my credentials" checked
2. Check console logs - should see: `[AuthService] Stored credentials for user: testuser`
3. Currently, credentials are stored in memory only (Phase 2 will add persistence)

### 9. Test Session Expiry

The session is set to expire in 24 hours. To test expiry logic:

1. Log in successfully
2. In DevTools Console, manually expire the session:
   ```javascript
   window.api.auth.getStatus().then(result => console.log(result))
   ```
   This will show the current auth state from the main process

### 10. Test State Persistence

1. Log in to the app
2. Navigate to another page (click on a project or go back to Project Launcher)
3. Navigate back to Settings
4. **Expected:** The debug panel should **still** show you're logged in
5. **Why:** Zustand store maintains state during the session

> **Note:** Currently, state is NOT persisted across app restarts. To add persistence, we would need to use Zustand's `persist` middleware (like the theme store does).

## Testing Checklist

- [ ] App builds successfully
- [ ] App starts without errors
- [ ] Settings page loads
- [ ] Debug panel displays correctly
- [ ] Login form accepts input
- [ ] Login button disabled when fields empty
- [ ] Login shows loading state
- [ ] Login updates UI to logged-in state
- [ ] Debug panel updates after login
- [ ] Console logs appear correctly
- [ ] Logout button works
- [ ] Logout updates UI back to login form
- [ ] Debug panel updates after logout
- [ ] "Remember me" checkbox works
- [ ] State persists during navigation

## Current Limitations (Mock Implementation)

The current implementation is a **mock** that accepts any credentials:
- ✅ Any username/password combination will work
- ✅ No actual connection to RuTracker
- ✅ Session stored in memory only
- ❌ No actual Puppeteer automation yet
- ❌ No credential persistence across app restarts
- ❌ No CAPTCHA handling

**Next Steps (Phase 2):**
When you're ready to implement real RuTracker authentication, update [src/main/services/AuthService.ts](src/main/services/AuthService.ts):
1. Replace mock implementation with Puppeteer
2. Navigate to RuTracker login page
3. Fill credentials and submit
4. Extract and store session cookies
5. Add error handling for failed logins
6. Handle CAPTCHA if present

## Troubleshooting

**If login doesn't work:**
1. Check DevTools Console for errors
2. Check Terminal (where you ran `npm start`) for main process logs
3. Verify all files built correctly: `npm run build`

**If debug panel doesn't update:**
1. Make sure you're using the Zustand store hook correctly
2. Check that the store is properly initialized
3. Verify the component is re-rendering

**If TypeScript errors appear:**
1. Make sure all type definitions are imported
2. Run `npm run build` to check for type errors
3. Check that `window.api.auth` types are properly defined in preload

## Development Tips

**To see all auth state changes in real-time:**
```javascript
// Add this in DevTools Console
window.api.auth.getStatus().then(status => console.log('Current auth status:', status))
```

**To manually test the IPC:**
```javascript
// Test login directly
window.api.auth.login({ username: 'test', password: 'test', remember: true })
  .then(result => console.log('Login result:', result))

// Test logout directly
window.api.auth.logout()
  .then(() => console.log('Logged out'))

// Check status
window.api.auth.getStatus()
  .then(result => console.log('Auth status:', result))
```

## Files Changed

1. **Types:**
   - [src/shared/types/auth.types.ts](src/shared/types/auth.types.ts)

2. **Store:**
   - [src/renderer/store/useAuthStore.ts](src/renderer/store/useAuthStore.ts)

3. **UI Components:**
   - [src/renderer/pages/Settings/components/RuTrackerAuthCard.tsx](src/renderer/pages/Settings/components/RuTrackerAuthCard.tsx)
   - [src/renderer/pages/Settings/index.tsx](src/renderer/pages/Settings/index.tsx)

4. **Services:**
   - [src/main/services/AuthService.ts](src/main/services/AuthService.ts)

5. **IPC:**
   - [src/main/ipc/index.ts](src/main/ipc/index.ts)
   - [src/preload/index.ts](src/preload/index.ts)

---

**Happy Testing! 🚀**
