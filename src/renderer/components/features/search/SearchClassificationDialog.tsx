import React from 'react'
import { Box, Button, Flex, Heading, Text, VStack, Badge, Icon } from '@chakra-ui/react'
import { FiChevronRight } from 'react-icons/fi'
import type { SearchClassificationResult } from '@shared/types/musicbrainz.types'

interface SearchClassificationDialogProps {
  isOpen: boolean
  query: string
  results: SearchClassificationResult[]
  onSelect: (result: SearchClassificationResult) => void
  onCancel: () => void
}

export const SearchClassificationDialog: React.FC<SearchClassificationDialogProps> = ({
  isOpen,
  query,
  results,
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'artist':
        return 'Artist'
      case 'album':
        return 'Album'
      case 'song':
        return 'Song'
      default:
        return 'Unknown'
    }
  }

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'artist':
        return '🎤'
      case 'album':
        return '💿'
      case 'song':
        return '🎵'
      default:
        return '❓'
    }
  }

  const getActionDescription = (type: string): string => {
    switch (type) {
      case 'artist':
        return 'Browse albums or download discography'
      case 'album':
        return 'Download this album from RuTracker'
      case 'song':
        return 'Find and download the album containing this song'
      default:
        return ''
    }
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
    >
      <Box
        width="full"
        maxW="2xl"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
      >
        {/* Header */}
        <Box p={6} borderBottom="1px solid" borderColor="border.base">
          <Heading size="2xl" color="text.primary">
            What are you searching for?
          </Heading>
          <Text mt={2} fontSize="sm" color="text.secondary">
            We found multiple matches for &quot;
            <Text as="span" fontWeight="medium" color="text.primary">
              {query}
            </Text>
            &quot;. Choose what you&apos;re looking for:
          </Text>
        </Box>

        {/* Body */}
        <VStack p={6} gap={3} maxH="60vh" overflowY="auto" align="stretch">
          {results.map((result, index) => (
            <Button
              key={`${result.type}-${result.name}-${index}`}
              onClick={() => onSelect(result)}
              width="full"
              height="auto"
              borderRadius="lg"
              p={4}
              textAlign="left"
              bg="bg.card"
              border="1px solid"
              borderColor="border.base"
              transition="all 0.2s"
              _hover={{
                borderColor: 'border.focus',
                bg: 'bg.hover',
                transform: 'scale(1.02)',
              }}
            >
              <Flex align="flex-start" gap={4} width="full">
                <Text fontSize="4xl" flexShrink={0}>
                  {getTypeIcon(result.type)}
                </Text>
                <Box flex="1" minW="0">
                  <Flex align="center" gap={2} mb={1}>
                    <Badge colorPalette="brand" textTransform="uppercase" fontSize="xs">
                      {getTypeLabel(result.type)}
                    </Badge>
                    <Text fontSize="xs" color="text.secondary">
                      {result.score}% match
                    </Text>
                  </Flex>
                  <Heading size="lg" color="text.primary">
                    {result.name}
                  </Heading>
                  {result.artist && result.type !== 'artist' && (
                    <Text fontSize="sm" mt={1} color="text.secondary">
                      by {result.artist}
                    </Text>
                  )}
                  <Text fontSize="xs" mt={1} color="text.muted">
                    {getActionDescription(result.type)}
                  </Text>
                </Box>
                <Icon as={FiChevronRight} boxSize={6} color="text.muted" flexShrink={0} />
              </Flex>
            </Button>
          ))}
        </VStack>

        {/* Footer */}
        <Flex p={6} borderTop="1px solid" borderColor="border.base" justify="flex-end">
          <Button
            onClick={onCancel}
            size="md"
            bg="bg.elevated"
            color="text.primary"
            _hover={{ bg: 'bg.hover' }}
          >
            Cancel
          </Button>
        </Flex>
      </Box>
    </Box>
  )
}
