import { useState } from 'react'
import {
  Card,
  Button,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Input,
  Textarea,
} from '@chakra-ui/react'
import { FiFolder, FiPlus } from 'react-icons/fi'

interface CreateProjectCardProps {
  /**
   * Callback when user submits the create project form
   * @param name - Project name (required, trimmed)
   * @param location - Full directory path (required)
   * @param description - Optional project description
   */
  onCreateProject: (
    name: string,
    location: string,
    description?: string
  ) => Promise<void>

  /**
   * Whether project creation is in progress
   * Used to disable form during submission
   */
  isLoading?: boolean
}

export function CreateProjectCard({
  onCreateProject,
  isLoading = false,
}: CreateProjectCardProps): JSX.Element {
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectLocation, setProjectLocation] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const handleSelectLocation = async () => {
    const directory = await window.api.selectDirectory()
    if (directory) {
      setProjectLocation(directory)
    }
  }

  const handleCreateProject = async () => {
    if (!projectName.trim() || !projectLocation) {
      return
    }

    await onCreateProject(
      projectName,
      projectLocation,
      projectDescription || undefined
    )

    // Reset form after successful submission
    setProjectName('')
    setProjectDescription('')
    setProjectLocation('')
    setShowCreateForm(false)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setProjectName('')
    setProjectDescription('')
    setProjectLocation('')
  }

  return (
    <Card.Root
      data-testid="launcher-card-create"
      bg="bg.card"
      borderWidth="2px"
      borderColor="border.base"
      borderRadius="xl"
      overflow="hidden"
      position="relative"
      className="action-card action-card-1"
    >
      <Card.Body gap={5} p={8}>
        <VStack align="start" gap={4}>
          <HStack gap={4} align="center">
            <Box fontSize="4xl" className="emoji-icon">
              ✨
            </Box>
            <VStack align="start" gap={0}>
              <Heading
                data-testid="launcher-heading-create"
                size="xl"
                color="text.primary"
                fontWeight="800"
                letterSpacing="-0.01em"
              >
                Create New Project
              </Heading>
              <Text
                fontSize="xs"
                fontFamily="monospace"
                color="brand.400"
                fontWeight="bold"
              >
                ACTION_01
              </Text>
            </VStack>
          </HStack>

          {!showCreateForm ? (
            <>
              <Text
                data-testid="launcher-text-create-description"
                color="text.secondary"
                lineHeight="1.7"
                fontSize="md"
              >
                Start a fresh project with organized folder structure and
                automatic configuration.
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
                data-testid="launcher-button-create"
                colorPalette="brand"
                size="lg"
                w="full"
                fontWeight="bold"
                letterSpacing="wide"
                textTransform="uppercase"
                onClick={() => setShowCreateForm(true)}
                disabled={isLoading}
              >
                <HStack gap={2}>
                  <FiPlus />
                  <Text>New Project</Text>
                </HStack>
              </Button>
            </>
          ) : (
            <VStack align="stretch" gap={4} w="full">
              <Box>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  mb={2}
                  color="text.secondary"
                  fontWeight="bold"
                  letterSpacing="wide"
                >
                  PROJECT NAME *
                </Text>
                <Input
                  data-testid="launcher-input-project-name"
                  placeholder="My Awesome Mix"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  size="lg"
                  fontWeight="500"
                  disabled={isLoading}
                />
              </Box>

              <Box>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  mb={2}
                  color="text.secondary"
                  fontWeight="bold"
                  letterSpacing="wide"
                >
                  DESCRIPTION (OPTIONAL)
                </Text>
                <Textarea
                  data-testid="launcher-textarea-project-description"
                  placeholder="Brief description of your project..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={3}
                  fontWeight="500"
                  disabled={isLoading}
                />
              </Box>

              <Box>
                <Text
                  fontSize="xs"
                  fontFamily="monospace"
                  mb={2}
                  color="text.secondary"
                  fontWeight="bold"
                  letterSpacing="wide"
                >
                  LOCATION *
                </Text>
                <HStack>
                  <Input
                    data-testid="launcher-input-project-location"
                    placeholder="Select folder..."
                    value={projectLocation}
                    readOnly
                    flex={1}
                    fontFamily="monospace"
                    fontSize="sm"
                    disabled={isLoading}
                  />
                  <Button
                    data-testid="launcher-button-browse-location"
                    onClick={handleSelectLocation}
                    colorPalette="accent"
                    disabled={isLoading}
                  >
                    <FiFolder />
                  </Button>
                </HStack>
              </Box>

              <Box
                w="full"
                h="2px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--chakra-colors-border-base), transparent)',
                }}
              />

              <HStack justify="flex-end" gap={3}>
                <Button
                  data-testid="launcher-button-cancel"
                  variant="ghost"
                  onClick={handleCancel}
                  textTransform="uppercase"
                  fontWeight="bold"
                  letterSpacing="wide"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  data-testid="launcher-button-submit-create"
                  colorPalette="brand"
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || !projectLocation || isLoading}
                  textTransform="uppercase"
                  fontWeight="bold"
                  letterSpacing="wide"
                  loading={isLoading}
                >
                  Create
                </Button>
              </HStack>
            </VStack>
          )}
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
