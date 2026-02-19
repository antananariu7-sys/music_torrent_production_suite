import { Checkbox as ChakraCheckbox } from '@chakra-ui/react'
import type { CheckboxRootProps } from '@chakra-ui/react'

export interface CheckboxProps extends CheckboxRootProps {
  checked?: boolean
}

export function Checkbox({ checked, children, ...props }: CheckboxProps) {
  return (
    <ChakraCheckbox.Root checked={checked} {...props}>
      <ChakraCheckbox.HiddenInput />
      <ChakraCheckbox.Control />
      <ChakraCheckbox.Indicator />
      {children && <ChakraCheckbox.Label>{children}</ChakraCheckbox.Label>}
    </ChakraCheckbox.Root>
  )
}
