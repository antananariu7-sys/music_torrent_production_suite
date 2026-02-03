import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  conditions: {
    light: '[data-theme=light] &',
    dark: '[data-theme=dark] &',
  },
  globalCss: {
    'input, textarea': {
      paddingLeft: '10px !important',
    },
  },
  theme: {
    tokens: {
      colors: {
        // Light blue brand color
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
      },
    },
    semanticTokens: {
      colors: {
        // Background colors that change with theme
        'bg.canvas': {
          value: {
            _light: 'white',
            _dark: 'gray.900',
          },
        },
        'bg.surface': {
          value: {
            _light: 'gray.50',
            _dark: 'gray.800',
          },
        },
        'bg.card': {
          value: {
            _light: 'white',
            _dark: 'gray.800',
          },
        },
        // Text colors
        'text.primary': {
          value: {
            _light: 'gray.900',
            _dark: 'gray.50',
          },
        },
        'text.secondary': {
          value: {
            _light: 'gray.600',
            _dark: 'gray.400',
          },
        },
        'text.muted': {
          value: {
            _light: 'gray.500',
            _dark: 'gray.500',
          },
        },
        // Border colors
        'border.base': {
          value: {
            _light: 'gray.200',
            _dark: 'gray.700',
          },
        },
        'border.hover': {
          value: {
            _light: 'brand.500',
            _dark: 'brand.500',
          },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
