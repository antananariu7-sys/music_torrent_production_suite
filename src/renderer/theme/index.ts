import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e6f2ff' },
          100: { value: '#b3d9ff' },
          200: { value: '#80bfff' },
          300: { value: '#4da6ff' },
          400: { value: '#1a8cff' },
          500: { value: '#0073e6' },
          600: { value: '#005bb3' },
          700: { value: '#004280' },
          800: { value: '#002a4d' },
          900: { value: '#00111a' },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
