import { Box, SimpleGrid, VStack, Text, Badge, HStack, Code } from '@chakra-ui/react'

interface MetadataSectionProps {
  genre?: string
  tags: string[]
  directory: string
}

export function MetadataSection({ genre, tags, directory }: MetadataSectionProps): JSX.Element {
  return (
    <Box
      bg="bg.card"
      borderWidth="1px"
      borderColor="border.base"
      borderRadius="md"
      p={6}
    >
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
        {/* Left column: Genre and Tags */}
        <VStack align="start" gap={4}>
          {genre && (
            <Box>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                color="text.muted"
                letterSpacing="wide"
                mb={2}
              >
                Genre
              </Text>
              <Badge colorPalette="brand" size="lg">
                {genre}
              </Badge>
            </Box>
          )}

          {tags.length > 0 && (
            <Box>
              <Text
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
                color="text.muted"
                letterSpacing="wide"
                mb={2}
              >
                Tags
              </Text>
              <HStack gap={2} wrap="wrap">
                {tags.map((tag, index) => (
                  <Badge key={index} colorPalette="gray" size="md">
                    {tag}
                  </Badge>
                ))}
              </HStack>
            </Box>
          )}

          {!genre && tags.length === 0 && (
            <Text fontSize="sm" color="text.muted">
              No metadata available
            </Text>
          )}
        </VStack>

        {/* Right column: Directory */}
        <VStack align="start" gap={2}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            color="text.muted"
            letterSpacing="wide"
          >
            Project Directory
          </Text>
          <Code
            fontSize="sm"
            p={2}
            borderRadius="sm"
            bg="bg.elevated"
            color="text.secondary"
            w="full"
            wordBreak="break-all"
          >
            {directory}
          </Code>
        </VStack>
      </SimpleGrid>
    </Box>
  )
}
