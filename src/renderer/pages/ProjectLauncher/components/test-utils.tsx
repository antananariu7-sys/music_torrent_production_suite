import React from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../../theme'

export const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={system}>{children}</ChakraProvider>
)
