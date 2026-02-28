import { Box, Container } from '@chakra-ui/react'
import { ReactNode } from 'react'
import { UndoRedoBar } from './UndoRedoBar'

interface LayoutProps {
  children: ReactNode
  maxW?: 'container.md' | 'container.lg' | 'container.xl' | '1400px'
}

function Layout({ children, maxW = 'container.xl' }: LayoutProps) {
  return (
    <Box
      minH="100vh"
      bg="bg.canvas"
      color="text.primary"
      position="relative"
      overflow="hidden"
    >
      {/* Animated background texture */}
      <Box
        position="absolute"
        inset="0"
        opacity="0.03"
        pointerEvents="none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      {/* Global undo/redo keyboard handler */}
      <UndoRedoBar />

      {/* Content container */}
      <Container maxW={maxW} py={8} position="relative" mx="auto">
        {children}
      </Container>
    </Box>
  )
}

export default Layout
