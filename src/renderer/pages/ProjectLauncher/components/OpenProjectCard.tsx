import {
  Card,
  Button,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
} from '@chakra-ui/react'
import { FiFolder } from 'react-icons/fi'

interface OpenProjectCardProps {
  /**
   * Callback when user clicks browse button
   * Opens directory picker and handles project loading
   */
  onBrowseProject: () => Promise<void>

  /**
   * Whether a project is being opened
   */
  isLoading?: boolean
}

export function OpenProjectCard({
  onBrowseProject,
  isLoading = false,
}: OpenProjectCardProps): JSX.Element {
  return (
    <Card.Root
      data-testid="launcher-card-open"
      bg="bg.card"
      borderWidth="2px"
      borderColor="border.base"
      borderRadius="xl"
      overflow="hidden"
      position="relative"
      className="action-card action-card-2"
    >
      <Card.Body gap={5} p={8}>
        <VStack align="start" gap={4}>
          <HStack gap={4} align="center">
            <Box fontSize="4xl" className="emoji-icon">
              📂
            </Box>
            <VStack align="start" gap={0}>
              <Heading
                data-testid="launcher-heading-open"
                size="xl"
                color="text.primary"
                fontWeight="800"
                letterSpacing="-0.01em"
              >
                Open Existing
              </Heading>
              <Text
                fontSize="xs"
                fontFamily="monospace"
                color="accent.400"
                fontWeight="bold"
              >
                ACTION_02
              </Text>
            </VStack>
          </HStack>

          <Text
            data-testid="launcher-text-open-description"
            color="text.secondary"
            lineHeight="1.7"
            fontSize="md"
          >
            Browse for a project folder containing a project.json file to
            continue working.
          </Text>

          <Box
            w="full"
            h="2px"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
            }}
          />

          <Button
            data-testid="launcher-button-browse"
            colorPalette="accent"
            size="lg"
            w="full"
            fontWeight="bold"
            letterSpacing="wide"
            textTransform="uppercase"
            onClick={onBrowseProject}
            disabled={isLoading}
            loading={isLoading}
          >
            <HStack gap={2}>
              <FiFolder />
              <Text>Browse</Text>
            </HStack>
          </Button>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
