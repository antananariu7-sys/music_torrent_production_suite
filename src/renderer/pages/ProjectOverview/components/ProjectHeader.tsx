import { Box, Heading, Text, Badge, HStack, IconButton } from '@chakra-ui/react'
import { FiSettings } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

interface ProjectHeaderProps {
  name: string
  description?: string
  isActive: boolean
}

export function ProjectHeader({ name, description, isActive }: ProjectHeaderProps): JSX.Element {
  const navigate = useNavigate()

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
        <HStack gap={2}>
          {isActive && (
            <Badge colorPalette="green" size="lg" px={3}>
              ACTIVE
            </Badge>
          )}
          <IconButton
            aria-label="Open settings"
            onClick={() => navigate('/settings')}
            variant="ghost"
            size="sm"
            colorPalette="gray"
            data-testid="project-settings-button"
          >
            <FiSettings />
          </IconButton>
        </HStack>
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
