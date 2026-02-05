import { Box, Button, Heading, Text, VStack, HStack } from '@chakra-ui/react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmColorPalette?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColorPalette = 'red',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps): JSX.Element | null {
  if (!isOpen) return null

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      onClick={onCancel}
    >
      <Box
        width="full"
        maxW="md"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={0}>
          {/* Header */}
          <Box p={6} borderBottom="1px solid" borderColor="border.base">
            <Heading size="lg" color="text.primary">
              {title}
            </Heading>
          </Box>

          {/* Body */}
          <Box p={6}>
            <Text color="text.secondary">{message}</Text>
          </Box>

          {/* Footer */}
          <HStack p={6} pt={0} justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </Button>
            <Button
              colorPalette={confirmColorPalette}
              onClick={onConfirm}
              loading={isLoading}
            >
              {confirmLabel}
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  )
}
