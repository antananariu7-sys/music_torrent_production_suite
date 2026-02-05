'use client'

import {
  Toaster as ChakraToaster,
  ToastRoot,
  ToastCloseTrigger,
  ToastIndicator,
  createToaster,
  Box,
  type CreateToasterReturn,
} from '@chakra-ui/react'
import type { ReactNode } from 'react'

export const toaster = createToaster({
  placement: 'bottom-right',
  pauseOnPageIdle: true,
})

interface ToastData {
  title?: ReactNode
  description?: ReactNode
  type?: 'success' | 'error' | 'warning' | 'info'
}

// Chakra UI v3 types are incomplete, so we need to cast
const ToasterWithProps = ChakraToaster as React.FC<{
  toaster: CreateToasterReturn
  children: (toast: ToastData) => ReactNode
}>

export function Toaster() {
  return (
    <ToasterWithProps toaster={toaster}>
      {(toast) => (
        <ToastRoot>
          <ToastIndicator />
          <Box flex="1">
            {toast.title && (
              <Box fontWeight="semibold" color="text.primary">
                {toast.title}
              </Box>
            )}
            {toast.description && (
              <Box fontSize="sm" color="text.secondary">
                {toast.description}
              </Box>
            )}
          </Box>
          <ToastCloseTrigger />
        </ToastRoot>
      )}
    </ToasterWithProps>
  )
}
