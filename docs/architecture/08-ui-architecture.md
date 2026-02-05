# UI Architecture

This document describes the UI architecture, component structure, and styling strategy.

## 8. UI Architecture

### Framework/Library
- **React 18.3.1** with functional components and hooks
- **TypeScript 5.9.3** for type safety
- **Chakra UI 3.31.0** for component library
- **React Router 6.30.3** for client-side routing
- **Emotion** (CSS-in-JS) required by Chakra UI
- No class components (hooks-based architecture)

### Component Structure
```
src/renderer/
├── pages/              # Route-level page components
│   └── Welcome.tsx     # Welcome/landing page
├── components/         # Reusable UI components
│   └── (to be added)
├── theme/              # Chakra UI theme configuration
│   └── index.ts        # Custom theme with brand colors
├── styles/             # Global styles
│   └── global.css      # Base CSS reset and globals
├── store/              # Zustand state stores
│   └── (to be added)
└── hooks/              # Custom React hooks
    └── (to be added)
```

### Styling Strategy

**Official Styling Standard**: **Chakra UI v3 ONLY**

> **⚠️ IMPORTANT**: All UI components MUST use Chakra UI v3. Tailwind CSS, inline styles with `className`, or other CSS frameworks are **NOT permitted**.

**Why Chakra UI v3**:
- **Type-safe**: Full TypeScript support with autocomplete for all props
- **Accessible by default**: ARIA attributes, keyboard navigation, focus management built-in
- **Theme-aware**: Semantic tokens automatically adapt to light/dark mode
- **Composable**: Component-based API matches React patterns
- **Maintainable**: Consistent styling across the entire application
- **Performant**: CSS-in-JS with Emotion, tree-shakable components
- **Electron-friendly**: No build-time CSS processing required

**Chakra UI Components**:
- Layout: `Box`, `Flex`, `Stack`, `HStack`, `VStack`, `Grid`
- Typography: `Heading`, `Text`
- Form: `Input`, `Button`, `Textarea`, `Select`
- Feedback: `Spinner`, `Alert`, `Toast`
- Overlay: `Modal`, `Drawer`, `Popover`
- Data Display: `Badge`, `Card`, `Table`
- And more: See [Chakra UI Docs](https://www.chakra-ui.com/)

**Theme Configuration** ([src/renderer/theme/index.ts](../../src/renderer/theme/index.ts)):
- **Custom semantic tokens** for consistent theming
- **Studio aesthetic** with electric blue brand colors and slate grays
- **Semantic color system**: `bg.canvas`, `bg.surface`, `bg.card`, `text.primary`, `text.secondary`, `border.base`, `interactive.base`
- **Custom shadows**: Studio-inspired elevation system (`studio-sm`, `studio-md`, `studio-lg`)
- **Global styles**: Font family, smooth transitions for theme changes

**Semantic Color Tokens**:
```typescript
// Background hierarchy
'bg.canvas'   // Deep studio dark (#0a0d12 dark, white light)
'bg.surface'  // Slightly elevated surface
'bg.card'     // Card elevation
'bg.elevated' // Higher elevation
'bg.hover'    // Hover state background
'bg.active'   // Active/selected state

// Text hierarchy
'text.primary'   // Primary text (#e8eaed dark, gray.900 light)
'text.secondary' // Secondary text (#9ca3af)
'text.muted'     // Muted text (#6b7280)

// Borders
'border.base'  // Default border (#252b3a dark)
'border.hover' // Hover state border
'border.focus' // Focus state border (brand.500)

// Interactive elements
'interactive.base'   // Primary interactive (brand.500)
'interactive.hover'  // Interactive hover state
'interactive.active' // Interactive active state
```

**Brand Color Palette**:
- **Brand**: Electric blue (blue-500 to blue-900) - Primary UI elements, links, interactive states
- **Accent**: Cyan shades - Secondary highlights
- **Slate**: Deep studio grays - Backgrounds and surfaces

**DO NOT Use**:
- ❌ Tailwind CSS classes (`className="flex items-center"`)
- ❌ Raw `className` with utility classes
- ❌ Inline `style` objects (except for rare edge cases)
- ❌ CSS modules or global CSS files for component styling
- ❌ Any other CSS framework

**When to use Chakra props vs style**:
- ✅ **Always use Chakra props**: `<Box p={4} bg="bg.card" borderRadius="lg">`
- ✅ **Use semantic tokens**: `color="text.primary"`, `bg="bg.surface"`
- ✅ **Use responsive props**: `width={{ base: '100%', md: '50%' }}`
- ⚠️ **Only use `style` for**:  Dynamic values from state/props that can't be expressed with Chakra tokens

### Responsive Design
- Support for different window sizes (minimum 800x600)
- Chakra UI responsive props for adaptive layouts
- Flexbox and Grid utilities from Chakra
- Handle different screen DPI/scaling
- Mobile-first responsive breakpoints (if needed for multi-window scenarios)
