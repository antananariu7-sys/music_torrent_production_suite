'use client'

import { Toast, Toaster as ChakraToaster, createToaster, Box, Flex, CloseButton } from '@chakra-ui/react'
import { LuCheck, LuX, LuTriangleAlert, LuInfo } from 'react-icons/lu'
import type { FC, ReactNode } from 'react'

export const toaster = createToaster({
  placement: 'top-end',
  pauseOnPageIdle: true,
})

interface ToastData {
  title?: ReactNode
  description?: ReactNode
  type?: 'success' | 'error' | 'warning' | 'info' | 'loading'
}

// Chakra UI v3 types are incomplete - cast to work with children
const ToasterPortal = ChakraToaster as FC<{
  toaster: typeof toaster
  children: (toast: ToastData) => ReactNode
}>

const typeStyles = {
  success: { bg: 'green.600', icon: LuCheck },
  error: { bg: 'red.600', icon: LuX },
  warning: { bg: 'orange.500', icon: LuTriangleAlert },
  info: { bg: 'blue.600', icon: LuInfo },
  loading: { bg: 'blue.600', icon: LuInfo },
} as const

export function Toaster() {
  return (
    <ToasterPortal toaster={toaster}>
      {(toast) => {
        const type = toast.type || 'info'
        const styles = typeStyles[type]
        const Icon = styles.icon

        return (
          <Toast.Root asChild>
            <Flex
              bg={styles.bg}
              color="white"
              px={4}
              py={3}
              mr={4}
              mt={4}
              borderRadius="lg"
              boxShadow="lg"
              minW="300px"
              maxW="400px"
              align="flex-start"
              gap={3}
            >
              <Box mt="0.5">
                <Icon size={18} />
              </Box>
              <Box flex="1">
                {toast.title && (
                  <Box fontWeight="semibold" fontSize="sm">
                    {toast.title}
                  </Box>
                )}
                {toast.description && (
                  <Box fontSize="sm" opacity={0.9} mt={toast.title ? 1 : 0}>
                    {toast.description}
                  </Box>
                )}
              </Box>
{/* @ts-expect-error Chakra UI v3 types incomplete for asChild */}
              <Toast.CloseTrigger asChild>
                <CloseButton size="sm" color="white" _hover={{ bg: 'whiteAlpha.200' }} />
              </Toast.CloseTrigger>
            </Flex>
          </Toast.Root>
        )
      }}
    </ToasterPortal>
  )
}
