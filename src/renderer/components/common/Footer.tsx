import { Box, HStack, Text, VStack } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'

interface FooterProps {
  /**
   * Application information from main process
   * If null, footer is not rendered
   */
  appInfo: AppInfo | null
  /**
   * Optional copyright text to display below app info
   */
  showCopyright?: boolean
}

export function Footer({ appInfo, showCopyright = false }: FooterProps): JSX.Element | null {
  if (!appInfo) {
    return null
  }

  return (
    <Box
      data-testid="footer-info"
      textAlign="center"
      pt={12}
      pb={6}
      borderTopWidth="1px"
      borderTopColor="border.base"
      className="footer-fade"
    >
      <VStack gap={3}>
        <HStack
          justify="center"
          gap={4}
          color="text.muted"
          fontSize="sm"
          fontFamily="monospace"
          fontWeight="500"
        >
          <HStack gap={2}>
            <Box w="2" h="2" bg="green.400" borderRadius="full" />
            <Text data-testid="footer-text-version">VERSION {appInfo.version}</Text>
          </HStack>
          <Text color="border.base">|</Text>
          <Text data-testid="footer-text-platform">
            {appInfo.platform.toUpperCase()} / {appInfo.arch.toUpperCase()}
          </Text>
        </HStack>
        {showCopyright && (
          <Text data-testid="footer-text-copyright" fontSize="xs" color="text.muted" fontFamily="monospace">
            © 2026 Music Production Suite. Built with Electron + React.
          </Text>
        )}
      </VStack>
    </Box>
  )
}
