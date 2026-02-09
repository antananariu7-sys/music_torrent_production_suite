import { Box, Heading, VStack, HStack, Text, Card } from '@chakra-ui/react'

/**
 * AdvancedSettings Component
 *
 * Placeholder for advanced settings and options
 */
export function AdvancedSettings() {
  return (
    <Card.Root
      bg="bg.card"
      borderWidth="2px"
      borderColor="border.base"
      borderRadius="xl"
      overflow="hidden"
      data-testid="advanced-section"
      className="settings-card settings-card-4"
    >
      <Card.Header
        p={6}
        borderBottomWidth="1px"
        borderBottomColor="border.base"
        bg="bg.surface"
      >
        <HStack justify="space-between">
          <VStack align="start" gap={1}>
            <Heading
              size="lg"
              color="text.primary"
              data-testid="advanced-heading"
              fontWeight="800"
              letterSpacing="-0.01em"
            >
              Advanced
            </Heading>
            <Text
              fontSize="xs"
              fontFamily="monospace"
              color="purple.400"
              fontWeight="bold"
            >
              SECTION_04
            </Text>
          </VStack>
          <Text fontSize="3xl">🔧</Text>
        </HStack>
      </Card.Header>
      <Card.Body p={6}>
        <VStack align="start" gap={3}>
          <Box
            w="full"
            p={4}
            borderRadius="lg"
            bg="bg.surface"
            borderWidth="1px"
            borderColor="border.base"
            borderStyle="dashed"
          >
            <Text
              fontSize="sm"
              color="text.muted"
              fontStyle="italic"
              data-testid="advanced-placeholder"
              fontFamily="monospace"
            >
              → Advanced options coming soon...
            </Text>
          </Box>
          <HStack
            gap={2}
            fontSize="xs"
            fontFamily="monospace"
            color="text.muted"
          >
            <Text>STATUS:</Text>
            <Text color="yellow.500" fontWeight="bold">
              DEVELOPMENT
            </Text>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
