import { Box, HStack, Text } from '@chakra-ui/react'
import type { AppInfo } from '@shared/types/app.types'

interface LauncherFooterProps {
  /**
   * Application information from main process
   * If null, footer is not rendered
   */
  appInfo: AppInfo | null
}

export function LauncherFooter({ appInfo }: LauncherFooterProps): JSX.Element | null {
  if (!appInfo) {
    return null
  }

  return (
    <Box
      data-testid="launcher-footer-info"
      textAlign="center"
      pt={12}
      pb={6}
      borderTopWidth="1px"
      borderTopColor="border.base"
    >
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
          <Text data-testid="launcher-text-version">VERSION {appInfo.version}</Text>
        </HStack>
        <Text color="border.base">|</Text>
        <Text data-testid="launcher-text-platform">
          {appInfo.platform.toUpperCase()} / {appInfo.arch.toUpperCase()}
        </Text>
      </HStack>
    </Box>
  )
}
