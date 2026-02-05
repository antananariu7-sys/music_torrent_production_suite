import { Box, Heading, Text, Badge, HStack } from '@chakra-ui/react'

interface ProjectHeaderProps {
  name: string
  description?: string
  isActive: boolean
}

export function ProjectHeader({ name, description, isActive }: ProjectHeaderProps): JSX.Element {
  return (
    <Box>
      <HStack justify="space-between" align="start" mb={2}>
        <Heading
          as="h1"
          size="2xl"
          color="text.primary"
          fontWeight="bold"
        >
          {name}
        </Heading>
        {isActive && (
          <Badge colorPalette="green" size="lg" px={3}>
            ACTIVE
          </Badge>
        )}
      </HStack>
      {description && (
        <Text
          fontSize="lg"
          color="text.secondary"
          mt={3}
        >
          {description}
        </Text>
      )}
    </Box>
  )
}
