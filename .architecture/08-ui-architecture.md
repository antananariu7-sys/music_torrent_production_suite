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
**Current Implementation**: Chakra UI v3 with custom theming

**Chakra UI Benefits**:
- Pre-built accessible components (Button, Modal, Input, etc.)
- Built-in dark mode support (default: dark theme)
- TypeScript-first design
- Emotion-based CSS-in-JS for dynamic styling
- Responsive design utilities
- Consistent design system

**Theme Configuration** ([src/renderer/theme/index.ts](../src/renderer/theme/index.ts)):
- Custom brand colors (purple/violet palette)
- Custom accent colors (indigo palette)
- Global styles: Dark background (gray.900) with light text (gray.50)
- Extensible token system for consistent spacing, colors, typography

**Color Palette**:
- **Brand**: Purple shades (50-900) - Primary UI elements
- **Accent**: Indigo shades (50-900) - Secondary/highlight elements
- **Background**: Gray.900 (dark mode)
- **Text**: Gray.50 (light text on dark background)

### Responsive Design
- Support for different window sizes (minimum 800x600)
- Chakra UI responsive props for adaptive layouts
- Flexbox and Grid utilities from Chakra
- Handle different screen DPI/scaling
- Mobile-first responsive breakpoints (if needed for multi-window scenarios)
