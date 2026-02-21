# Feature: Windows Installer Upgrade

## Overview

Replace the default one-click NSIS installer with a full wizard-style installer that lets users choose the install directory, opt into a desktop shortcut, and cleanly uninstall the app — including an option to remove user data.

## User Problem

The current installer silently drops the app into `%LOCALAPPDATA%` with no directory choice, no shortcut options, and a bare-bones uninstaller. This feels unfinished and gives users no control over where the app lives on their system.

## User Stories

- As a user, I want to choose where Music Production Suite is installed so I can manage disk space across drives
- As a user, I want a desktop shortcut created during install so I can launch the app quickly
- As a user, I want a Start Menu entry so I can find the app through Windows search
- As a user, I want the uninstaller to optionally remove my settings and data so I can do a clean removal when needed

## Proposed UX Flow

### Install Flow (Assisted Wizard)

```
┌─────────────────────────────────────────┐
│  Welcome to Music Production Suite      │
│  Setup Wizard                           │
│                                         │
│  This will install MPS on your computer │
│                                         │
│                        [Next] [Cancel]  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Choose Install Location                │
│                                         │
│  C:\Program Files\Music Production Su.. │
│                              [Browse..] │
│                                         │
│  Space required: ~200 MB                │
│  Space available: XX GB                 │
│                                         │
│              [Back] [Next] [Cancel]     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Installation Options                   │
│                                         │
│  [x] Create Desktop shortcut            │
│  [x] Create Start Menu shortcut         │
│                                         │
│              [Back] [Install] [Cancel]  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Installing...                          │
│  ████████████████░░░░░░  72%            │
│                                         │
│                              [Cancel]   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Installation Complete!                 │
│                                         │
│  [x] Launch Music Production Suite      │
│                                         │
│                             [Finish]    │
└─────────────────────────────────────────┘
```

### Uninstall Flow

```
┌─────────────────────────────────────────┐
│  Uninstall Music Production Suite       │
│                                         │
│  [ ] Also remove user settings and data │
│      (projects are not affected)        │
│                                         │
│             [Uninstall] [Cancel]        │
└─────────────────────────────────────────┘
```

The "remove user settings" checkbox is **unchecked by default** to prevent accidental data loss. It removes the electron-store config directory (`%APPDATA%/music-production-suite/`). User project directories are never touched.

## Technical Changes

### electron-builder NSIS Config

Add to the `build.nsis` section in `package.json`:

```jsonc
"nsis": {
  "oneClick": false,           // Enable assisted wizard
  "allowToChangeInstallationDirectory": true,
  "perMachine": true,          // Install to Program Files (requires UAC)
  "createDesktopShortcut": true,
  "createStartMenuShortcut": true,
  "shortcutName": "Music Production Suite",
  "uninstallDisplayName": "Music Production Suite",
  "deleteAppDataOnUninstall": false,  // We handle this via custom NSIS script
  "include": "build/installer.nsh"    // Custom NSIS script for uninstall data cleanup
}
```

### Custom NSIS Script (`build/installer.nsh`)

Adds a checkbox to the uninstaller that asks whether to remove user settings:

```nsis
!macro customUnInstall
  MessageBox MB_YESNO "Also remove user settings and app data?$\n(Your projects will NOT be affected)" IDYES removeData IDNO keepData
  removeData:
    RMDir /r "$APPDATA\music-production-suite"
  keepData:
!macroend
```

### Auto-Update Prep (publish config)

Add `publish` config so electron-updater can be wired up later:

```jsonc
"build": {
  "publish": {
    "provider": "github",
    "owner": "<github-owner>",
    "repo": "music-production-suite"
  }
}
```

### Install Directory Change

| Aspect               | Before                     | After                                     |
| -------------------- | -------------------------- | ----------------------------------------- |
| Default location     | `%LOCALAPPDATA%\Programs\` | `C:\Program Files\Music Production Suite` |
| Admin required       | No                         | Yes (UAC prompt)                          |
| User can change dir  | No                         | Yes (browse dialog)                       |
| Shortcut: Desktop    | No                         | Yes (opt-in, default checked)             |
| Shortcut: Start Menu | No                         | Yes (always created)                      |

### App Icons (TODO)

The installer and app need a proper `.ico` file at `resources/icons/icon.ico`. Until provided:

- electron-builder will use its default Electron icon
- This is a cosmetic blocker for a polished release but not a functional one

## Files to Change

| File                       | Change                                              |
| -------------------------- | --------------------------------------------------- |
| `package.json`             | Add `build.nsis` config, add `build.publish` config |
| `build/installer.nsh`      | **New file** — custom NSIS uninstall macro          |
| `resources/icons/icon.ico` | **TODO** — app icon for installer and exe           |

## Edge Cases & Error States

- **No admin rights:** UAC prompt will appear. If user declines, install aborts with a clear message (NSIS default behavior)
- **Custom install path with spaces:** NSIS handles this natively, no special handling needed
- **Upgrade over existing install:** NSIS detects existing installation and upgrades in-place (electron-builder default)
- **Uninstall data removal:** Only removes `%APPDATA%/music-production-suite/` (electron-store). Never touches project directories which live in user-chosen locations

## Acceptance Criteria

- [ ] Running the installer shows a multi-page wizard (Welcome → Directory → Options → Install → Finish)
- [ ] User can browse and change the install directory
- [ ] Default install path is `C:\Program Files\Music Production Suite`
- [ ] Desktop shortcut is created when the checkbox is checked
- [ ] Start Menu shortcut is always created
- [ ] App launches correctly from the new install location
- [ ] Uninstaller prompts whether to remove user settings
- [ ] Declining the data removal leaves `%APPDATA%` intact
- [ ] Accepting the data removal cleans `%APPDATA%/music-production-suite/`
- [ ] `publish` config is present in electron-builder config for future auto-update
- [ ] Upgrading over an existing installation works without data loss

## Out of Scope

- License/EULA screen
- Custom installer branding (sidebar image, banner graphic)
- macOS DMG customization
- Linux installer changes
- Auto-update implementation (only prep/config in this feature)
- App icon creation (noted as TODO dependency)

## Dependencies

- `electron-builder` NSIS support (already available)
- App icon `.ico` file (TODO — cosmetic, not blocking)
- GitHub repo owner/name for publish config
