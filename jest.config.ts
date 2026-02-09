import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Test file patterns - only test business logic (services, renderer utils, stores with complex logic)
  testMatch: [
    '<rootDir>/src/main/services/**/*.{test,spec}.{ts,tsx}',
    '<rootDir>/src/renderer/**/utils.{test,spec}.{ts,tsx}',
    '<rootDir>/src/renderer/store/**/*.{test,spec}.{ts,tsx}',
  ],

  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.claude/',
  ],

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },

  // Coverage configuration - only cover business logic (services, renderer utils, stores)
  collectCoverageFrom: [
    'src/main/services/**/*.{ts,tsx}',
    '!src/main/services/**/*.{test,spec}.{ts,tsx}',
    'src/renderer/**/utils.{ts,tsx}',
    '!src/renderer/**/utils.{test,spec}.{ts,tsx}',
    'src/renderer/store/**/*.{ts,tsx}',
    '!src/renderer/store/**/*.{test,spec}.{ts,tsx}',
  ],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
      },
    }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
}

export default config
