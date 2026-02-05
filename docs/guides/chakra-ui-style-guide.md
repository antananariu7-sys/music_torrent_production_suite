# Chakra UI v3 Style Guide

**Official UI Styling Standard for Music Production Suite**

> **⚠️ CRITICAL**: All UI components MUST use Chakra UI v3. Tailwind CSS, utility `className`, or other CSS frameworks are **NOT permitted**.

---

## Table of Contents

1. [Why Chakra UI Only?](#why-chakra-ui-only)
2. [Core Principles](#core-principles)
3. [Semantic Token System](#semantic-token-system)
4. [Common Patterns](#common-patterns)
5. [Component Examples](#component-examples)
6. [Do's and Don'ts](#dos-and-donts)
7. [Migration Guide](#migration-guide)

---

## Why Chakra UI Only?

### Benefits

✅ **Type-Safe**: Full TypeScript autocomplete for all props
✅ **Accessible**: ARIA attributes, keyboard navigation, focus management built-in
✅ **Theme-Aware**: Semantic tokens automatically adapt to light/dark mode
✅ **Composable**: Component-based API matches React patterns
✅ **Maintainable**: Consistent styling across the entire codebase
✅ **Performant**: CSS-in-JS with Emotion, tree-shakable imports
✅ **Electron-Friendly**: No build-time CSS processing required

### What NOT to Use

❌ **Tailwind CSS** - Not installed, classes won't work
❌ **Utility className** - `className="flex items-center"` is forbidden
❌ **Inline styles** - Use Chakra props instead of `style={{ ... }}`
❌ **CSS modules** - All styling goes through Chakra
❌ **Other CSS frameworks** - Material-UI, Bootstrap, etc.

---

## Core Principles

### 1. Use Chakra Components

Always use Chakra UI components instead of raw HTML:

```tsx
// ✅ CORRECT
import { Box, Flex, Heading, Text, Button } from '@chakra-ui/react'

<Box p={4}>
  <Heading size="lg">Title</Heading>
  <Text>Content</Text>
</Box>

// ❌ WRONG
<div className="p-4">
  <h2 className="text-lg font-bold">Title</h2>
  <p>Content</p>
</div>
```

### 2. Use Semantic Tokens

Use theme tokens instead of hardcoded colors:

```tsx
// ✅ CORRECT - Semantic tokens
<Box bg="bg.card" color="text.primary" borderColor="border.base">

// ❌ WRONG - Hardcoded colors
<Box bg="#151923" color="#e8eaed" borderColor="#252b3a">
```

### 3. Use Chakra Props

Use Chakra's style props instead of `style` or `className`:

```tsx
// ✅ CORRECT - Chakra props
<Box
  display="flex"
  alignItems="center"
  justifyContent="space-between"
  p={4}
  borderRadius="lg"
/>

// ❌ WRONG - className utilities
<div className="flex items-center justify-between p-4 rounded-lg" />

// ❌ WRONG - inline styles
<div style={{ display: 'flex', alignItems: 'center', padding: '16px' }} />
```

---

## Semantic Token System

Our custom theme provides semantic tokens for consistent theming across light and dark modes.

### Background Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `bg.canvas` | `#0a0d12` | `white` | App background |
| `bg.surface` | `#0f1318` | `gray.50` | Elevated surface |
| `bg.card` | `#151923` | `white` | Card background |
| `bg.elevated` | `#1a1f2b` | `gray.100` | Higher elevation |
| `bg.hover` | `#1d2333` | `gray.100` | Hover state |
| `bg.active` | `rgba(59, 130, 246, 0.1)` | `brand.50` | Selected state |

**Example:**
```tsx
<Box bg="bg.canvas">
  <Box bg="bg.surface" p={4}>
    <Box bg="bg.card" borderRadius="lg" p={6}>
      Card content
    </Box>
  </Box>
</Box>
```

### Text Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `text.primary` | `#e8eaed` | `gray.900` | Primary text |
| `text.secondary` | `#9ca3af` | `gray.600` | Secondary text |
| `text.muted` | `#6b7280` | `gray.500` | Muted/disabled text |
| `text.inverse` | `gray.900` | `white` | Inverted text |

**Example:**
```tsx
<Box>
  <Heading color="text.primary">Main Title</Heading>
  <Text color="text.secondary">Subtitle</Text>
  <Text color="text.muted" fontSize="sm">Helper text</Text>
</Box>
```

### Border Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `border.base` | `#252b3a` | `gray.200` | Default border |
| `border.hover` | `#2d3548` | `gray.300` | Hover state border |
| `border.focus` | `brand.500` | `brand.500` | Focus state border |
| `border.accent` | `brand.700` | `brand.200` | Accent border |

**Example:**
```tsx
<Box
  border="1px solid"
  borderColor="border.base"
  _hover={{ borderColor: 'border.hover' }}
  _focus={{ borderColor: 'border.focus' }}
/>
```

### Interactive Tokens

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `interactive.base` | `brand.500` | `brand.500` | Primary interactive |
| `interactive.hover` | `brand.400` | `brand.600` | Hover state |
| `interactive.active` | `brand.600` | `brand.700` | Active/pressed state |

**Example:**
```tsx
<Button
  bg="interactive.base"
  color="white"
  _hover={{ bg: 'interactive.hover' }}
  _active={{ bg: 'interactive.active' }}
>
  Click Me
</Button>
```

### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `brand.500` | `#3b82f6` | Primary brand color (electric blue) |
| `brand.600` | `#2563eb` | Darker variant |
| `brand.400` | `#60a5fa` | Lighter variant |

### Shadow Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `studio-sm` | `0 2px 8px rgba(0, 0, 0, 0.4)` | Small elevation |
| `studio-md` | `0 4px 16px rgba(0, 0, 0, 0.5)` | Medium elevation |
| `studio-lg` | `0 8px 32px rgba(0, 0, 0, 0.6)` | Large elevation |
| `studio-xl` | `0 16px 48px rgba(0, 0, 0, 0.7)` | Extra large elevation |
| `glow-blue` | `0 0 20px rgba(59, 130, 246, 0.3)` | Blue glow effect |

**Semantic Shadow Tokens:**
- `shadow="card"` - Automatically uses `md` (light) or `studio-md` (dark)
- `shadow="modal"` - Automatically uses `xl` (light) or `studio-xl` (dark)

---

## Common Patterns

### Modal/Dialog Overlay

```tsx
import { Box } from '@chakra-ui/react'

<Box
  position="fixed"
  inset="0"
  zIndex="modal"
  display="flex"
  alignItems="center"
  justifyContent="center"
  bg="blackAlpha.700"
  backdropFilter="blur(12px)"
>
  <Box
    width="full"
    maxW="4xl"
    maxH="85vh"
    bg="bg.surface"
    borderRadius="xl"
    border="1px solid"
    borderColor="border.base"
    shadow="modal"
    p={6}
  >
    {/* Modal content */}
  </Box>
</Box>
```

### Interactive Card Button

```tsx
import { Button, Flex, Box, Heading, Text } from '@chakra-ui/react'

<Button
  width="full"
  height="auto"
  p={4}
  bg="bg.card"
  border="1px solid"
  borderColor="border.base"
  borderRadius="lg"
  textAlign="left"
  transition="all 0.2s"
  _hover={{
    borderColor: 'border.hover',
    bg: 'bg.hover',
    transform: 'scale(1.02)',
  }}
  _focus={{
    outline: 'none',
    ring: 2,
    ringColor: 'interactive.base',
  }}
>
  <Flex align="flex-start" gap={3} width="full">
    <Box flex="1">
      <Heading size="lg" color="text.primary">Card Title</Heading>
      <Text fontSize="sm" color="text.secondary" mt={1}>
        Card description
      </Text>
    </Box>
  </Flex>
</Button>
```

### Status Badge

```tsx
import { Badge } from '@chakra-ui/react'

<Badge colorPalette="green" fontSize="xs" textTransform="uppercase">
  FLAC
</Badge>

<Badge colorPalette="blue" fontSize="xs">
  MP3
</Badge>

<Badge colorPalette="gray" fontSize="xs">
  Category
</Badge>
```

### Loading Spinner with Text

```tsx
import { Flex, Spinner, Text } from '@chakra-ui/react'

<Flex align="center" gap={3} p={3} bg="blue.500/10" border="1px solid" borderColor="interactive.base" borderRadius="lg">
  <Spinner size="sm" color="interactive.base" />
  <Text fontSize="sm" color="blue.400">
    Loading...
  </Text>
</Flex>
```

### Input with Icons

```tsx
import { Box, Input, Icon, Button } from '@chakra-ui/react'
import { FiSearch, FiX } from 'react-icons/fi'

<Box position="relative">
  {/* Left Icon */}
  <Box position="absolute" left={4} top="50%" transform="translateY(-50%)" color="text.muted">
    <Icon as={FiSearch} boxSize={5} />
  </Box>

  {/* Input */}
  <Input
    pl={12}
    pr={24}
    py={3}
    bg="bg.elevated"
    border="1px solid"
    borderColor="border.base"
    color="text.primary"
    _placeholder={{ color: 'text.muted' }}
    _focus={{
      outline: 'none',
      ring: 2,
      ringColor: 'interactive.base',
      borderColor: 'border.focus',
    }}
    placeholder="Search..."
  />

  {/* Right Button */}
  <Button
    position="absolute"
    right={2}
    top="50%"
    transform="translateY(-50%)"
    size="sm"
    bg="interactive.base"
    color="white"
    _hover={{ bg: 'interactive.hover' }}
  >
    Search
  </Button>
</Box>
```

### List with Dividers

```tsx
import { VStack, Box, Text, Flex } from '@chakra-ui/react'

<VStack gap={0} align="stretch" divider={<Box h="1px" bg="border.base" />}>
  <Flex p={4} _hover={{ bg: 'bg.hover' }}>
    <Text>Item 1</Text>
  </Flex>
  <Flex p={4} _hover={{ bg: 'bg.hover' }}>
    <Text>Item 2</Text>
  </Flex>
  <Flex p={4} _hover={{ bg: 'bg.hover' }}>
    <Text>Item 3</Text>
  </Flex>
</VStack>
```

---

## Component Examples

### Complete Dialog Component

```tsx
import React from 'react'
import { Box, Button, Flex, Heading, Text, VStack, HStack } from '@chakra-ui/react'

interface MyDialogProps {
  isOpen: boolean
  title: string
  onConfirm: () => void
  onCancel: () => void
}

export const MyDialog: React.FC<MyDialogProps> = ({
  isOpen,
  title,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
    >
      <Box
        width="full"
        maxW="2xl"
        bg="bg.surface"
        borderRadius="xl"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
      >
        {/* Header */}
        <Box p={6} borderBottom="1px solid" borderColor="border.base">
          <Heading size="2xl" color="text.primary">
            {title}
          </Heading>
        </Box>

        {/* Body */}
        <VStack p={6} gap={4} align="stretch">
          <Text color="text.secondary">
            Dialog content goes here...
          </Text>
        </VStack>

        {/* Footer */}
        <HStack p={6} borderTop="1px solid" borderColor="border.base" justify="flex-end" gap={3}>
          <Button
            onClick={onCancel}
            size="md"
            bg="bg.elevated"
            color="text.primary"
            _hover={{ bg: 'bg.hover' }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            size="md"
            bg="interactive.base"
            color="white"
            _hover={{ bg: 'interactive.hover' }}
          >
            Confirm
          </Button>
        </HStack>
      </Box>
    </Box>
  )
}
```

---

## Do's and Don'ts

### ✅ DO

**Use Chakra Components:**
```tsx
import { Box, Flex, Heading, Text, Button, Input, VStack, HStack } from '@chakra-ui/react'
```

**Use Semantic Tokens:**
```tsx
<Box bg="bg.card" color="text.primary" borderColor="border.base" />
```

**Use Responsive Props:**
```tsx
<Box width={{ base: '100%', md: '50%', lg: '33.33%' }} />
```

**Use Style Props:**
```tsx
<Box p={4} borderRadius="lg" shadow="card" />
```

**Use Pseudo Props:**
```tsx
<Button _hover={{ bg: 'bg.hover' }} _active={{ bg: 'bg.active' }} _focus={{ ring: 2 }} />
```

### ❌ DON'T

**Don't Use className with Utilities:**
```tsx
// WRONG
<div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg" />
```

**Don't Use Inline Styles:**
```tsx
// WRONG
<div style={{ display: 'flex', padding: '16px', backgroundColor: '#151923' }} />
```

**Don't Use Hardcoded Colors:**
```tsx
// WRONG
<Box bg="#151923" color="#e8eaed" />
```

**Don't Mix Frameworks:**
```tsx
// WRONG - Mixing Tailwind with Chakra
<Box className="flex p-4 bg-gray-800">
  <Button>Click Me</Button>
</Box>
```

---

## Migration Guide

### From Tailwind to Chakra

| Tailwind | Chakra UI |
|----------|-----------|
| `className="flex"` | `<Flex>` or `<Box display="flex">` |
| `className="flex-col"` | `<Flex direction="column">` or `<VStack>` |
| `className="items-center"` | `align="center"` |
| `className="justify-between"` | `justify="space-between"` |
| `className="gap-4"` | `gap={4}` |
| `className="p-4"` | `p={4}` |
| `className="px-4 py-2"` | `px={4} py={2}` |
| `className="rounded-lg"` | `borderRadius="lg"` |
| `className="bg-gray-800"` | `bg="bg.card"` |
| `className="text-white"` | `color="text.primary"` |
| `className="text-sm"` | `fontSize="sm"` |
| `className="font-bold"` | `fontWeight="bold"` |
| `className="border border-gray-700"` | `border="1px solid" borderColor="border.base"` |
| `className="hover:bg-gray-700"` | `_hover={{ bg: 'bg.hover' }}` |

### Common Component Mappings

| HTML | Chakra UI |
|------|-----------|
| `<div>` | `<Box>` |
| `<section>` | `<Box as="section">` |
| `<button>` | `<Button>` |
| `<input>` | `<Input>` |
| `<h1>` | `<Heading size="4xl">` |
| `<h2>` | `<Heading size="2xl">` |
| `<h3>` | `<Heading size="lg">` |
| `<p>` | `<Text>` |
| `<span>` | `<Text as="span">` |

### Migration Example

**Before (Tailwind):**
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
  <div className="w-full max-w-4xl rounded-xl bg-gray-900 p-6 shadow-2xl">
    <h2 className="text-2xl font-bold text-white">Title</h2>
    <p className="mt-2 text-sm text-gray-400">Description</p>
    <div className="mt-4 flex justify-end gap-3">
      <button className="rounded-lg bg-gray-700 px-4 py-2 text-white hover:bg-gray-600">
        Cancel
      </button>
      <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Confirm
      </button>
    </div>
  </div>
</div>
```

**After (Chakra UI):**
```tsx
<Box
  position="fixed"
  inset="0"
  zIndex="modal"
  display="flex"
  alignItems="center"
  justifyContent="center"
  bg="blackAlpha.700"
  backdropFilter="blur(8px)"
>
  <Box width="full" maxW="4xl" borderRadius="xl" bg="bg.surface" p={6} shadow="modal">
    <Heading size="2xl" color="text.primary">
      Title
    </Heading>
    <Text mt={2} fontSize="sm" color="text.secondary">
      Description
    </Text>
    <HStack mt={4} justify="flex-end" gap={3}>
      <Button bg="bg.elevated" color="text.primary" _hover={{ bg: 'bg.hover' }}>
        Cancel
      </Button>
      <Button bg="interactive.base" color="white" _hover={{ bg: 'interactive.hover' }}>
        Confirm
      </Button>
    </HStack>
  </Box>
</Box>
```

---

## Quick Reference

### Commonly Used Chakra Components

```tsx
// Layout
import { Box, Flex, Stack, HStack, VStack, Grid, GridItem } from '@chakra-ui/react'

// Typography
import { Heading, Text } from '@chakra-ui/react'

// Form
import { Button, Input, Textarea, Select } from '@chakra-ui/react'

// Feedback
import { Spinner, Alert } from '@chakra-ui/react'

// Data Display
import { Badge, Icon } from '@chakra-ui/react'
```

### Common Prop Patterns

```tsx
// Spacing
p={4}                      // padding: 1rem
px={4} py={2}             // padding-left/right: 1rem, padding-top/bottom: 0.5rem
m={4}                      // margin: 1rem
gap={3}                    // gap: 0.75rem

// Sizing
width="full"               // width: 100%
maxW="4xl"                 // max-width: 56rem
height="auto"              // height: auto

// Borders
border="1px solid"         // border: 1px solid
borderRadius="lg"          // border-radius: 0.5rem
borderColor="border.base"  // theme token

// Typography
fontSize="sm"              // font-size: 0.875rem
fontWeight="bold"          // font-weight: 700
color="text.primary"       // theme token

// Flexbox
display="flex"
alignItems="center"
justifyContent="space-between"
flexDirection="column"

// Pseudo-states
_hover={{ bg: 'bg.hover' }}
_active={{ bg: 'bg.active' }}
_focus={{ outline: 'none', ring: 2 }}
_disabled={{ opacity: 0.5 }}
```

---

## Toast Notification System

The application uses Chakra UI v3's toast system for user feedback. Toasts provide non-intrusive notifications for important state changes.

### Configuration

Toast notifications are configured in [src/renderer/components/ui/toaster.tsx](../../src/renderer/components/ui/toaster.tsx):

```tsx
import { toaster, Toaster } from '@/renderer/components/ui/toaster'

// Mount once in app root
<Toaster />
```

The toaster is configured with:
- **Placement**: `top-end` (top-right corner)
- **Pause on idle**: Toasts pause when the page is idle

### Toast Types

| Type | Usage | Color Indicator |
|------|-------|-----------------|
| `success` | Successful operations | Green |
| `error` | Failed operations, errors | Red |
| `warning` | Warnings, cautions | Yellow |
| `info` | Informational messages | Blue |
| `loading` | Long-running operations | Spinner |

### Basic Usage

```tsx
import { toaster } from '@/renderer/components/ui/toaster'

// Success toast
toaster.create({
  title: 'Project saved',
  description: 'Your changes have been saved successfully.',
  type: 'success',
})

// Error toast
toaster.create({
  title: 'Save failed',
  description: 'Could not save project. Please try again.',
  type: 'error',
})

// Info toast
toaster.create({
  title: 'Download started',
  description: 'Your file will be ready shortly.',
  type: 'info',
})
```

### Custom Duration

```tsx
toaster.create({
  title: 'Project deleted',
  description: 'This action cannot be undone.',
  type: 'warning',
  duration: 10000, // 10 seconds for important notifications
})
```

### When to Show Toasts

> **⚠️ IMPORTANT**: All significant user-facing state changes MUST show a toast notification.

**Always show toasts for:**

| Category | Examples |
|----------|----------|
| **Project state changes** | Create, save, delete, open, close project |
| **Settings changes** | Login/logout, preference updates, configuration changes |
| **Search operations** | Search completed, search failed, no results found |
| **Download operations** | Download started, download completed, download failed |
| **Collection changes** | Item added to collection, item removed, collection cleared |
| **Clipboard operations** | Content copied to clipboard |
| **Authentication** | Login success, login failed, logout |
| **Error states** | Any operation failure that the user initiated |

**Don't show toasts for:**
- Background auto-save operations (unless they fail)
- Real-time sync updates
- UI state changes (panel open/close, navigation)
- Hover or focus events

### Current Usage Examples

From the codebase:

```tsx
// Authentication (RuTrackerAuthCard.tsx)
toaster.create({
  title: 'Login successful',
  description: `Welcome back, ${loginUsername}!`,
  type: 'success',
})

// Collection management (TorrentCollection.tsx)
toaster.create({
  title: 'Collection cleared',
  description: `Removed ${count} torrent${count !== 1 ? 's' : ''} from collection.`,
  type: 'info',
})

// Download operations (CollectedTorrentItem.tsx)
toaster.create({
  title: 'Download started',
  description: torrent.title,
  type: 'success',
})

// Project deletion (RecentProjectCard.tsx)
toaster.create({
  title: 'Project deleted',
  description: `"${project.projectName}" has been permanently deleted from disk.`,
  type: 'warning',
  duration: 10000,
})

// Search errors (SmartSearch.tsx)
toaster.create({
  title: 'Search error',
  description: error,
  type: 'error',
})
```

### Best Practices

1. **Be concise**: Keep titles under 5 words, descriptions under 15 words
2. **Be specific**: Include relevant context (project name, item count, etc.)
3. **Use appropriate types**: Match the toast type to the operation outcome
4. **Consider duration**: Use longer durations (10s) for destructive or important actions
5. **Don't spam**: Batch similar operations when possible (e.g., "3 items added" vs 3 separate toasts)

---

## Resources

- **Chakra UI Docs**: https://www.chakra-ui.com/
- **Theme Configuration**: [src/renderer/theme/index.ts](../../src/renderer/theme/index.ts)
- **UI Architecture Docs**: [docs/architecture/08-ui-architecture.md](../architecture/08-ui-architecture.md)
- **Best Practices**: [.claude/skills/architecture-dev/references/best-practices.md](../../.claude/skills/architecture-dev/references/best-practices.md)

---

**Last Updated**: 2026-02-06
