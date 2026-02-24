# Implementation Plan: Transform Welcome Page to Project Overview

**Status:** ✅ Completed — ProjectOverview page implemented with tabbed interface (SearchTab, TorrentTab, MixTab)

## Goal

Transform the unused Welcome page into a Project Overview page that displays comprehensive project metadata when users click on a project. Users can navigate back to the project list and reopen different projects using the same page.

## User Preferences

- **Metadata Display**: Show all available metadata (basic info, statistics, mix metadata, songs preview)
- **Navigation Behavior**: Keep project loaded when navigating to Settings and back
- **Visual Style**: Minimal/clean dashboard with focus on data, grid layout, minimal decoration

## Architecture Context

**Current State:**

- React Router v6 with HashRouter
- Routes: `/` (ProjectLauncher), `/settings` (Settings)
- Welcome page exists at `src/renderer/pages/Welcome/index.tsx` but is NOT routed
- `useProjectStore` manages `currentProject: Project | null`
- PageLayout component provides automatic back button on non-home routes
- ProjectLauncher has TODO to navigate when project loads

**Available Project Data** (from `src/shared/types/project.types.ts`):

- **Basic**: id, name, description, createdAt, updatedAt, projectDirectory, isActive
- **Content**: songs[] array with Song objects
- **Mix**: mixMetadata (title, description, genre, tags, coverImagePath)
- **Song fields**: title, artist, duration, format, bitrate, fileSize, order, addedAt

## Implementation Steps

### Step 1: Add Route and Navigation

**Files:** `src/renderer/App.tsx`, `src/renderer/pages/ProjectLauncher/index.tsx`

**1.1 Update App.tsx**

- Import ProjectOverview (will be renamed from Welcome)
- Add route: `<Route path="/project" element={<ProjectOverview appInfo={appInfo} />} />`
- Route order: `/` → `/project` → `/settings` → `*`

**1.2 Update ProjectLauncher**

- Update useEffect (lines 35-40) to navigate when currentProject is set:

```typescript
useEffect(() => {
  if (currentProject) {
    navigate('/project')
  }
}, [currentProject, navigate])
```

**Why `/project` without ID**: App uses Zustand for state, no need for URL params

### Step 2: Rename and Restructure

**Files:** Rename `src/renderer/pages/Welcome/` to `src/renderer/pages/ProjectOverview/`

**2.1 Rename Files**

- `Welcome/index.tsx` → `ProjectOverview/index.tsx`
- `Welcome/Welcome.styles.tsx` → `ProjectOverview/ProjectOverview.styles.tsx`
- Component name: `Welcome` → `ProjectOverview`
- Update all imports and exports

**2.2 Create Structure**

```
ProjectOverview/
├── index.tsx                 # Main page component
├── ProjectOverview.styles.tsx
├── utils.ts                  # Data formatting utilities
└── components/
    ├── ProjectHeader.tsx     # Name, description
    ├── StatsGrid.tsx         # Statistics cards
    ├── MetadataSection.tsx   # Genre, tags, dates
    └── SongsList.tsx         # Songs preview table
```

### Step 3: Implement Route Guard

**File:** `src/renderer/pages/ProjectOverview/index.tsx`

Add redirect logic at component start:

```typescript
const currentProject = useProjectStore((state) => state.currentProject)
const navigate = useNavigate()

useEffect(() => {
  if (!currentProject) {
    navigate('/', { replace: true })
  }
}, [currentProject, navigate])

if (!currentProject) {
  return null // Redirecting
}
```

**Behavior**: Auto-redirect to launcher if no project loaded

### Step 4: Create Data Utilities

**File:** `src/renderer/pages/ProjectOverview/utils.ts`

Implement formatting functions:

- `formatDuration(seconds?: number): string` - Convert to HH:MM:SS or MM:SS
- `formatDate(date: Date): string` - Format as "Jan 15, 2024"
- `formatFileSize(bytes?: number): string` - Convert to KB/MB/GB
- `getUniqueFormats(songs: Song[]): string[]` - Extract unique file formats
- `calculateTotalDuration(songs: Song[]): number` - Sum song durations
- `calculateTotalSize(songs: Song[]): number` - Sum file sizes

### Step 5: Implement Main Layout

**File:** `src/renderer/pages/ProjectOverview/index.tsx`

**Layout Structure** (minimal/clean dashboard):

```
┌─────────────────────────────────────────────────────┐
│  ProjectHeader                                      │
│  - Project name (large)                             │
│  - Description                                      │
│  - Active status badge                              │
└─────────────────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬─────────┐
│  Songs Card  │ Duration Card│  Size Card   │ Info Card│
│  📁 15 songs │  ⏱️ 1:23:45  │  💾 450 MB   │ 📅 Dates │
│  MP3, FLAC   │              │              │          │
└──────────────┴──────────────┴──────────────┴─────────┘

┌─────────────────────────────────────────────────────┐
│  MetadataSection                                    │
│  Genre: Electronic  Tags: [Chill] [Study] [Mix]    │
│  Directory: /path/to/project                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  SongsList (Preview)                                │
│  Table: # | Title | Artist | Duration | Format      │
│  [First 10 songs shown]                             │
└─────────────────────────────────────────────────────┘
```

**Component Tree:**

```tsx
<PageLayout appInfo={appInfo}>
  <VStack spacing={6} align="stretch">
    <ProjectHeader
      name={currentProject.name}
      description={currentProject.description}
      isActive={currentProject.isActive}
    />

    <StatsGrid
      songCount={currentProject.songs.length}
      totalDuration={calculateTotalDuration(currentProject.songs)}
      totalSize={calculateTotalSize(currentProject.songs)}
      formats={getUniqueFormats(currentProject.songs)}
      createdAt={currentProject.createdAt}
      updatedAt={currentProject.updatedAt}
    />

    <MetadataSection
      genre={currentProject.mixMetadata?.genre}
      tags={currentProject.mixMetadata?.tags || []}
      directory={currentProject.projectDirectory}
    />

    <SongsList songs={currentProject.songs} maxDisplay={10} />
  </VStack>
</PageLayout>
```

### Step 6: Implement Components

**6.1 ProjectHeader Component**

- Simple Box with project name as heading (size="2xl")
- Description in muted color below
- Badge showing "ACTIVE" status
- No animations, clean typography

**6.2 StatsGrid Component**

- SimpleGrid with 4 columns (responsive: 1 on mobile, 2 on tablet, 4 on desktop)
- Each card: Icon, large number, label, detail text
- Cards:
  1. **Songs**: Count + format list (MP3, FLAC, etc.)
  2. **Duration**: Total time formatted
  3. **Size**: Total file size formatted
  4. **Timeline**: Created/Updated dates
- Subtle border, light background, no hover effects (minimal style)

**6.3 MetadataSection Component**

- Simple grid layout
- Genre as colored badge
- Tags as array of small badges
- Directory path in Code component (monospace)
- Gracefully hide missing fields

**6.4 SongsList Component**

- Chakra Table component (bordered, striped)
- Columns: # (order), Title, Artist, Duration, Format
- Show first 10 songs (prop: `maxDisplay`)
- If empty: "No songs added yet" message
- If more than 10: "Showing 10 of X songs" footer
- No pagination in MVP

### Step 7: Styling

**File:** `src/renderer/pages/ProjectOverview/ProjectOverview.styles.tsx`

**Minimal Style Guidelines:**

- Remove all animations from Welcome.styles.tsx
- Remove gradient effects and glow effects
- Use simple borders and backgrounds
- Color scheme:
  - Cards: gray.700 background, gray.600 border
  - Text: gray.100 primary, gray.400 secondary
  - Accent: brand.400 for badges and highlights
- No hover effects or transformations
- Focus on readability and data density

**Example Styles:**

```tsx
<Box
  bg="gray.700"
  borderWidth="1px"
  borderColor="gray.600"
  borderRadius="md"
  p={6}
>
  <Heading size="md" color="gray.100">
    ...
  </Heading>
  <Text color="gray.400">...</Text>
</Box>
```

### Step 8: Navigation State Management

**File:** `src/renderer/pages/ProjectOverview/index.tsx`

**Keep Project Loaded** (per user preference):

- Do NOT clear currentProject on component unmount
- Project stays loaded when navigating to Settings
- Only clear when user explicitly returns to launcher
- Back button from ProjectOverview goes to `/` (launcher)

**Optional Enhancement** (not required for MVP):

- Add "Close Project" button that clears currentProject and navigates home
- Or clear currentProject in ProjectLauncher when it mounts

### Step 9: Error Handling

**Handle Missing Data:**

- `description` is optional → Show "No description" or hide section
- `mixMetadata.genre` is optional → Hide genre badge if missing
- `tags` array can be empty → Show "No tags" or hide section
- `songs` array can be empty → Show empty state in SongsList
- Cover image not needed (minimal design)

**Handle Route Guard:**

- If `!currentProject`, redirect to `/` immediately
- No error UI needed, just silent redirect

**Handle Undefined/Null:**

- All formatting utilities handle undefined gracefully
- Return fallback strings ("--:--", "Unknown", "Not specified")

## Critical Files to Modify

1. **src/renderer/App.tsx**
   - Add `/project` route

2. **src/renderer/pages/Welcome/index.tsx** → **src/renderer/pages/ProjectOverview/index.tsx**
   - Complete transformation of page logic and layout

3. **src/renderer/pages/ProjectLauncher/index.tsx**
   - Update useEffect to navigate when currentProject is set

4. **src/renderer/pages/ProjectOverview/utils.ts** (NEW)
   - Create data formatting utilities

5. **src/renderer/pages/ProjectOverview/components/** (NEW)
   - Create 4 sub-components: ProjectHeader, StatsGrid, MetadataSection, SongsList

## Data Flow

```
User clicks project in ProjectLauncher
  ↓
openProject() called
  ↓
currentProject set in useProjectStore
  ↓
useEffect in ProjectLauncher detects change
  ↓
navigate('/project')
  ↓
ProjectOverview renders
  ↓
Reads currentProject from store
  ↓
Displays all metadata in clean dashboard layout
  ↓
User clicks back button
  ↓
navigate('/')
  ↓
Returns to ProjectLauncher
  ↓
currentProject still set (stays loaded)
```

## Testing Strategy

### Manual Testing

1. **Navigation Flow**
   - Launch app → should show ProjectLauncher
   - Click recent project → should navigate to /project
   - Should show project overview with all metadata
   - Click back → should return to launcher
   - Project should still be loaded (can navigate to /project again)

2. **Route Guard**
   - Manually navigate to /project in URL (without loading project)
   - Should redirect to /

3. **Data Display**
   - Test with project that has all metadata
   - Test with project missing optional fields (description, genre, tags)
   - Test with project with 0 songs
   - Test with project with 50+ songs (verify list shows only 10)

4. **Edge Cases**
   - Project with very long name/description
   - Project with special characters in name
   - Songs with missing metadata (duration, format, etc.)

### Unit Tests (Pragmatic - Business Logic Only)

**Note**: Following project's testing approach, we skip UI component tests.

**Test utils.ts functions** (these are business logic):

```typescript
describe('ProjectOverview Utils', () => {
  describe('formatDuration', () => {
    it('formats seconds to MM:SS')
    it('formats hours to HH:MM:SS')
    it('handles undefined gracefully')
  })

  describe('calculateTotalDuration', () => {
    it('sums song durations')
    it('handles songs without duration')
    it('handles empty array')
  })

  // Similar tests for other utility functions
})
```

**Skip component tests** per pragmatic testing approach.

## Verification Checklist

After implementation, verify:

- [ ] Route `/project` exists in App.tsx
- [ ] ProjectLauncher navigates to /project when currentProject is set
- [ ] ProjectOverview shows all metadata sections
- [ ] Statistics are calculated correctly (song count, duration, size)
- [ ] Songs list shows first 10 songs
- [ ] Route guard redirects if no project loaded
- [ ] Back button returns to launcher
- [ ] Project stays loaded when navigating to Settings and back
- [ ] Missing metadata handled gracefully (no errors, shows fallbacks)
- [ ] All utility functions have unit tests
- [ ] Clean, minimal design with no animations
- [ ] Layout is responsive (works on different window sizes)

## Future Enhancements (Out of Scope for MVP)

- Full songs list with pagination
- Inline editing of project metadata
- Project statistics charts
- Export project functionality
- Project settings modal
- Cover image display/upload
- Drag-and-drop song reordering
- Song search and filtering

## Risk Mitigation

**Risk: Missing/incomplete project metadata**

- Mitigation: Comprehensive fallbacks, graceful degradation, hide empty sections

**Risk: URL and state desynchronization**

- Mitigation: Clear route guard logic, proper useEffect dependencies

**Risk: Large projects with many songs**

- Mitigation: Limit songs list to 10 items, calculate statistics efficiently

**Risk: Project data changes while viewing**

- Mitigation: ProjectOverview reads from store reactively, updates automatically
