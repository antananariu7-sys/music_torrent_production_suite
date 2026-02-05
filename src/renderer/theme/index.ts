import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  conditions: {
    light: '[data-theme=light] &',
    dark: '[data-theme=dark] &',
  },
  globalCss: {
    body: {
      fontFamily: '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      letterSpacing: '-0.01em',
    },
    'input, textarea': {
      paddingLeft: '10px !important',
    },
    // Smooth transitions for theme changes
    '*': {
      transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
    },
  },
  theme: {
    tokens: {
      colors: {
        // Electric blue brand color - studio aesthetic
        brand: {
          50: { value: '#eff6ff' },
          100: { value: '#dbeafe' },
          200: { value: '#bfdbfe' },
          300: { value: '#93c5fd' },
          400: { value: '#60a5fa' },
          500: { value: '#3b82f6' },
          600: { value: '#2563eb' },
          700: { value: '#1d4ed8' },
          800: { value: '#1e40af' },
          900: { value: '#1e3a8a' },
        },
        accent: {
          50: { value: '#f0f9ff' },
          100: { value: '#e0f2fe' },
          200: { value: '#bae6fd' },
          300: { value: '#7dd3fc' },
          400: { value: '#38bdf8' },
          500: { value: '#0ea5e9' },
          600: { value: '#0284c7' },
          700: { value: '#0369a1' },
          800: { value: '#075985' },
          900: { value: '#0c4a6e' },
        },
        // Studio slate grays
        slate: {
          950: { value: '#0a0d12' },
        },
      },
      shadows: {
        // Studio-inspired elevation system
        'studio-sm': { value: '0 2px 8px rgba(0, 0, 0, 0.4)' },
        'studio-md': { value: '0 4px 16px rgba(0, 0, 0, 0.5)' },
        'studio-lg': { value: '0 8px 32px rgba(0, 0, 0, 0.6)' },
        'studio-xl': { value: '0 16px 48px rgba(0, 0, 0, 0.7)' },
        'glow-blue': { value: '0 0 20px rgba(59, 130, 246, 0.3)' },
      },
      spacing: {
        // Consistent spacing scale
        section: { value: '2rem' },
        card: { value: '1.5rem' },
      },
    },
    semanticTokens: {
      colors: {
        // Background hierarchy - Studio aesthetic
        'bg.canvas': {
          value: {
            _light: 'white',
            _dark: '#0a0d12', // Deep studio dark
          },
        },
        'bg.surface': {
          value: {
            _light: 'gray.50',
            _dark: '#0f1318', // Slightly elevated
          },
        },
        'bg.card': {
          value: {
            _light: 'white',
            _dark: '#151923', // Card elevation
          },
        },
        'bg.elevated': {
          value: {
            _light: 'gray.100',
            _dark: '#1a1f2b', // Higher elevation
          },
        },
        'bg.hover': {
          value: {
            _light: 'gray.100',
            _dark: '#1d2333',
          },
        },
        'bg.active': {
          value: {
            _light: 'brand.50',
            _dark: 'rgba(59, 130, 246, 0.1)',
          },
        },
        // Text hierarchy
        'text.primary': {
          value: {
            _light: 'gray.900',
            _dark: '#e8eaed',
          },
        },
        'text.secondary': {
          value: {
            _light: 'gray.600',
            _dark: '#9ca3af',
          },
        },
        'text.muted': {
          value: {
            _light: 'gray.500',
            _dark: '#6b7280',
          },
        },
        'text.inverse': {
          value: {
            _light: 'white',
            _dark: 'gray.900',
          },
        },
        // Border system
        'border.base': {
          value: {
            _light: 'gray.200',
            _dark: '#252b3a',
          },
        },
        'border.hover': {
          value: {
            _light: 'gray.300',
            _dark: '#2d3548',
          },
        },
        'border.focus': {
          value: {
            _light: 'brand.500',
            _dark: 'brand.500',
          },
        },
        'border.accent': {
          value: {
            _light: 'brand.200',
            _dark: 'brand.700',
          },
        },
        // Interactive states
        'interactive.base': {
          value: {
            _light: 'brand.500',
            _dark: 'brand.500',
          },
        },
        'interactive.hover': {
          value: {
            _light: 'brand.600',
            _dark: 'brand.400',
          },
        },
        'interactive.active': {
          value: {
            _light: 'brand.700',
            _dark: 'brand.600',
          },
        },
      },
      shadows: {
        // Semantic shadow tokens
        card: {
          value: {
            _light: 'md',
            _dark: 'studio-md',
          },
        },
        modal: {
          value: {
            _light: 'xl',
            _dark: 'studio-xl',
          },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
