import { Box, Heading, Text } from '@chakra-ui/react'

export function LauncherHeader(): JSX.Element {
  return (
    <Box className="header-section" mb={12}>
      <Box textAlign="center">
        <Text
          data-testid="launcher-text-system"
          fontSize="sm"
          fontWeight="bold"
          letterSpacing="widest"
          textTransform="uppercase"
          color="brand.400"
          fontFamily="monospace"
          mb={4}
          className="version-glow"
        >
          PROJECT SYSTEM
        </Text>
        <Heading
          data-testid="launcher-heading-main"
          as="h1"
          fontSize={{ base: '4xl', md: '6xl', lg: '7xl' }}
          fontWeight="900"
          lineHeight="0.95"
          letterSpacing="-0.02em"
          mb={4}
        >
          <Box
            as="span"
            display="block"
            color="text.primary"
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              textTransform: 'uppercase',
            }}
          >
            Choose Your
          </Box>
          <Box
            as="span"
            display="block"
            bgGradient="to-r"
            gradientFrom="brand.400"
            gradientVia="accent.400"
            gradientTo="brand.600"
            bgClip="text"
            style={{
              fontFamily: "'Arial Black', 'Arial', sans-serif",
              textTransform: 'uppercase',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.5))',
            }}
          >
            Project
          </Box>
        </Heading>
        <Text
          data-testid="launcher-text-description"
          fontSize={{ base: 'lg', md: 'xl' }}
          color="text.secondary"
          maxW="700px"
          mx="auto"
          lineHeight="1.7"
          fontWeight="500"
        >
          Create a new project or continue working on an existing one
        </Text>
      </Box>
    </Box>
  )
}
