import { Box, HStack } from '@chakra-ui/react'

export function FrequencyBars() {
  return (
    <>
      <style>{`
        @keyframes freq-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <HStack gap={1} h="full" align="flex-end" justify="center">
        {[...Array(50)].map((_, i) => (
          <Box
            key={i}
            w="8px"
            h="100%"
            bg="brand.400"
            transformOrigin="bottom"
            style={{
              animation: `freq-bounce ${0.5 + Math.random() * 0.8}s ease-in-out infinite`,
              animationDelay: `${i * 0.02}s`,
            }}
          />
        ))}
      </HStack>
    </>
  )
}
