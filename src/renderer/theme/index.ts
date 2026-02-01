import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#f5f3ff' },
          100: { value: '#ede9fe' },
          200: { value: '#ddd6fe' },
          300: { value: '#c4b5fd' },
          400: { value: '#a78bfa' },
          500: { value: '#8b5cf6' },
          600: { value: '#7c3aed' },
          700: { value: '#6d28d9' },
          800: { value: '#5b21b6' },
          900: { value: '#4c1d95' },
        },
        accent: {
          50: { value: '#eef2ff' },
          100: { value: '#e0e7ff' },
          200: { value: '#c7d2fe' },
          300: { value: '#a5b4fc' },
          400: { value: '#818cf8' },
          500: { value: '#6366f1' },
          600: { value: '#4f46e5' },
          700: { value: '#4338ca' },
          800: { value: '#3730a3' },
          900: { value: '#312e81' },
        },
      },
    },
  },
  globalCss: {
    'html, body': {
      bg: 'gray.900',
      color: 'gray.50',
    },
  },
})

export const system = createSystem(defaultConfig, config)
