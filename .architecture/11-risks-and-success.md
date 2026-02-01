# Risks and Success Criteria

This document outlines open questions, technical risks, and success criteria for the project.

## 17. Open Questions & Risks

### Open Questions
- [x] ~~Database vs file-based storage~~ → File-based (electron-store for settings, JSON for results)
- [ ] Should we add torrent client integration (auto-download)?
- [ ] Do we need torrent filtering (by seeders, size, date)?
- [ ] Should we cache search results permanently or session-only?
- [ ] Do we need search history tracking?

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| RuTracker site changes (HTML structure) | High | High | Abstract selectors into config, make easily updatable |
| CAPTCHA on login/search | High | Medium | Manual CAPTCHA solving, show browser to user |
| IP blocking/rate limiting | Medium | Medium | Configurable delays, respect rate limits, user-agent rotation |
| Session expiration during long searches | Medium | Medium | Auto-relogin on session loss, resume from last position |
| Electron version incompatibility | High | Low | Pin versions, test thoroughly before upgrades |
| Code signing certificate issues | High | Medium | Set up early, document process, have backup plan |
| Pagination changes | Medium | High | Robust pagination detection, fallback strategies |
| Third-party dependency vulnerabilities | Medium | Medium | Automated scanning, regular updates |

## 18. Success Criteria

### Functional Criteria

**Project Management:**
- [ ] Create, load, save, and delete projects
- [ ] Export and import projects
- [ ] Multiple projects can coexist
- [ ] Project auto-save functionality
- [ ] Project metadata tracking (file count, size, etc.)

**Component 1 - Search:**
- [ ] Successfully login to RuTracker with valid credentials
- [ ] Execute single and batch torrent searches
- [ ] Handle paginated search results correctly
- [ ] Extract torrent download links accurately
- [ ] Display real-time progress and logs
- [ ] Error handling with user choice (retry/skip/abort)
- [ ] Add search results to project
- [ ] Browser automation visible to user during searches

**Component 2 - Torrent Manager:**
- [ ] Add torrents to download queue from search results
- [ ] Download torrents with progress tracking
- [ ] Pause, resume, and cancel downloads
- [ ] Seed completed torrents with configurable ratios
- [ ] Organize downloaded files by project
- [ ] Extract audio metadata automatically
- [ ] Audio library with search and filtering
- [ ] Handle concurrent downloads (5-10 simultaneous)

**Component 3 - Mixer:** *(TBD)*
- [ ] Load audio files into mixer
- [ ] Basic mixing interface
- [ ] Export mixed audio

**General:**
- [ ] Application launches successfully on Windows and macOS
- [ ] Settings persist across application restarts
- [ ] Credentials stored securely (encrypted)
- [ ] Export functionality for search results

### Non-Functional Criteria
- [ ] Startup time < 5 seconds (cold start)
- [ ] Memory usage < 500MB (with browser + torrents running)
- [ ] Successfully handle 50+ concurrent search queries
- [ ] Successfully handle 10 concurrent torrent downloads
- [ ] Installer size < 200MB
- [ ] No crashes during 2-hour continuous operation
- [ ] Respect rate limits (configurable delay between searches)
- [ ] Download speeds comparable to native clients
- [ ] No security vulnerabilities in dependencies
- [ ] Credentials encrypted at rest
- [ ] Projects save/load in < 2 seconds for typical size
