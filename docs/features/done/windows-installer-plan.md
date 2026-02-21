# Windows Installer Upgrade — Implementation Plan

## Context

The current NSIS installer uses electron-builder defaults: one-click install to `%LOCALAPPDATA%`, no directory choice, no shortcut options, bare-bones uninstaller. This feature upgrades to a wizard-style installer with directory selection, shortcut options, and a clean uninstall flow with optional data removal.

Full spec: `docs/features/windows-installer.md`

## Pre-conditions (Already Done)

- App icons exist in `build/icon.ico` and `build/icons/` (all PNG sizes: 16–1024px)
- electron-builder is configured with `"target": ["nsis"]` in `package.json`
- `build/` directory exists

---

## Phase 1: NSIS Wizard Configuration

**Goal:** Switch from one-click to assisted wizard installer with directory selection and shortcut options.

### Modify

| File           | Change                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `package.json` | Add `build.nsis` configuration block inside the existing `build` section (after line 91, the `win` block) |

### Configuration to add

```jsonc
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "perMachine": true,
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "Music Production Suite",
  "uninstallDisplayName": "Music Production Suite",
  "deleteAppDataOnUninstall": false,
  "include": "build/installer.nsh"
}
```

### Key details

- `oneClick: false` enables the multi-page wizard (Welcome → Directory → Options → Install → Finish)
- `perMachine: true` installs to `C:\Program Files\` by default (requires UAC elevation)
- `allowToChangeInstallationDirectory: true` adds Browse button to choose install path
- `deleteAppDataOnUninstall: false` — we handle this ourselves via custom NSIS script (Phase 2)
- `include` references the custom NSIS script for uninstall behavior

### Verify

- `yarn build` passes
- Run the generated installer (`release/` directory) — wizard pages appear
- Install directory is selectable
- Desktop and Start Menu shortcuts are created

---

## Phase 2: Custom Uninstall Script

**Goal:** Add a prompt during uninstall asking whether to remove user settings and app data.

### New files

| File                  | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `build/installer.nsh` | Custom NSIS script with uninstall macro for optional data cleanup |

### Content

```nsis
!macro customUnInstall
  MessageBox MB_YESNO "Also remove user settings and app data?$\n(Your projects will NOT be affected)" IDYES removeData IDNO keepData
  removeData:
    RMDir /r "$APPDATA\music-production-suite"
  keepData:
!macroend
```

### Key details

- The `customUnInstall` macro is called by electron-builder's NSIS template during uninstall
- `$APPDATA\music-production-suite` is the electron-store config directory
- User project directories (which live in user-chosen locations) are never touched
- The checkbox defaults to "No" (user must explicitly opt into data removal)
- If user declines, `%APPDATA%` directory is left intact for potential reinstall

### Verify

- Uninstall from Add/Remove Programs → prompt appears
- Click "No" → settings preserved in `%APPDATA%`
- Click "Yes" → `%APPDATA%/music-production-suite/` removed
- Reinstall after "No" → app retains previous settings

---

## Phase 3: Auto-Update Prep (Publish Config)

**Goal:** Add GitHub publish config so electron-updater can be wired up in a future feature.

### Modify

| File           | Change                                                       |
| -------------- | ------------------------------------------------------------ |
| `package.json` | Add `build.publish` configuration inside the `build` section |

### Configuration to add

```jsonc
"publish": {
  "provider": "github",
  "owner": "<github-owner>",
  "repo": "music-production-suite"
}
```

### Key details

- This only adds the config — no auto-update code is implemented
- The `owner` field needs the actual GitHub username/org
- This enables `electron-updater` to be wired up later without touching the build config again
- Release artifacts will include update metadata files (`.yml`) when built with `--publish`

### Verify

- `yarn build` still passes
- No runtime behavior changes
- Build output includes `latest.yml` in release directory

---

## File Inventory Summary

**1 new file:** `build/installer.nsh`
**1 modified file:** `package.json`

## Verification (End-to-End)

1. `yarn build` — full build passes
2. Run installer → wizard appears with Welcome, Directory, Options, Install, Finish pages
3. Default path is `C:\Program Files\Music Production Suite`
4. Browse and change directory → installs to chosen location
5. Desktop shortcut created (when checked)
6. Start Menu shortcut created
7. App launches correctly from new install location
8. Uninstall → "Remove settings?" prompt appears
9. Upgrade over existing install → no data loss
10. `latest.yml` present in build output
