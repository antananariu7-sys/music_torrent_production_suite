import { Slider as ChakraSlider } from '@chakra-ui/react'
import type { SliderRootProps } from '@chakra-ui/react'

export interface SliderProps extends SliderRootProps {
  value: number[]
  onValueChange?: (value: number[]) => void
}

export function Slider({ value, onValueChange, ...props }: SliderProps) {
  return (
    <ChakraSlider.Root
      value={value}
      onValueChange={(details: { value: number[] }) => onValueChange?.(details.value)}
      {...props}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ChakraSlider.Control {...{} as any}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ChakraSlider.Track {...{} as any}>
          <ChakraSlider.Range />
        </ChakraSlider.Track>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <ChakraSlider.Thumb {...{ index: 0 } as any} />
      </ChakraSlider.Control>
    </ChakraSlider.Root>
  )
}
