import { Box, HStack, VStack, Text, IconButton } from '@chakra-ui/react'

interface ErrorAlertProps {
  /**
   * Error message to display
   * If null/empty, component returns null (not rendered)
   */
  error: string | null

  /**
   * Callback when user clicks close button
   */
  onClose: () => void

  /**
   * Optional custom title (defaults to "ERROR")
   */
  title?: string

  /**
   * Optional data-testid prefix for testing
   */
  testId?: string
}

export function ErrorAlert({
  error,
  onClose,
  title = 'ERROR',
  testId = 'error-alert',
}: ErrorAlertProps): JSX.Element | null {
  if (!error) {
    return null
  }

  return (
    <Box
      data-testid={`${testId}-box`}
      mb={8}
      p={6}
      bg="red.900/20"
      borderWidth="2px"
      borderColor="red.500"
      borderRadius="lg"
      position="relative"
      className="action-section"
    >
      <HStack justify="space-between" align="start">
        <VStack align="start" gap={2} flex="1">
          <HStack>
            <Text fontSize="2xl">⚠️</Text>
            <Text
              fontSize="sm"
              fontWeight="bold"
              fontFamily="monospace"
              color="red.400"
              letterSpacing="wider"
              textTransform="uppercase"
            >
              {title}
            </Text>
          </HStack>
          <Text data-testid={`${testId}-message`} color="red.200" fontWeight="500">
            {error}
          </Text>
        </VStack>
        <IconButton
          data-testid={`${testId}-close-button`}
          aria-label="Close error"
          onClick={onClose}
          variant="ghost"
          size="sm"
          colorPalette="red"
        >
          ✕
        </IconButton>
      </HStack>
    </Box>
  )
}
