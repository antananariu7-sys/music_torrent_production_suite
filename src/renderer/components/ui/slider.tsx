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
      onValueChange={(details: any) => onValueChange?.(details.value)}
      {...props}
    >
      <ChakraSlider.Control {...({} as any)}>
        <ChakraSlider.Track {...({} as any)}>
          <ChakraSlider.Range />
        </ChakraSlider.Track>
        <ChakraSlider.Thumb {...({ index: 0 } as any)} />
      </ChakraSlider.Control>
    </ChakraSlider.Root>
  )
}
