import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Test file patterns for main process
  testMatch: [
    '<rootDir>/src/main/**/*.{test,spec}.{ts,tsx}',
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
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/main/**/*.{ts,tsx}',
    '!src/main/**/*.{test,spec}.{ts,tsx}',
    '!src/main/**/__tests__/**',
    '!src/main/index.ts',
  ],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
      },
    }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Timeout for async tests
  testTimeout: 10000,
}

export default config
