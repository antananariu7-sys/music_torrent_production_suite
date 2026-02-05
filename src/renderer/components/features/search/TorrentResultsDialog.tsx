import React, { useState } from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Icon,
} from '@chakra-ui/react'
import { FiCheck, FiDownload } from 'react-icons/fi'
import type { SearchResult } from '@shared/types/search.types'

interface TorrentResultsDialogProps {
  isOpen: boolean
  query: string
  results: SearchResult[]
  onSelectTorrent: (torrent: SearchResult) => void
  onCancel: () => void
  isDownloading?: boolean
}

export const TorrentResultsDialog: React.FC<TorrentResultsDialogProps> = ({
  isOpen,
  query,
  results,
  onSelectTorrent,
  onCancel,
  isDownloading = false,
}) => {
  const [selectedTorrent, setSelectedTorrent] = useState<SearchResult | null>(null)

  if (!isOpen) return null

  const handleSelectTorrent = (torrent: SearchResult) => {
    setSelectedTorrent(torrent)
  }

  const handleDownload = () => {
    if (selectedTorrent) {
      onSelectTorrent(selectedTorrent)
    }
  }

  const getFormatBadgeColor = (format?: string): string => {
    switch (format?.toLowerCase()) {
      case 'flac':
      case 'alac':
      case 'ape':
        return 'green'
      case 'mp3':
        return 'blue'
      case 'wav':
        return 'purple'
      default:
        return 'gray'
    }
  }

  const getRelevanceColor = (score?: number): string => {
    if (!score) return 'text.muted'
    if (score >= 80) return 'green.400'
    if (score >= 60) return 'blue.400'
    if (score >= 40) return 'yellow.400'
    return 'text.muted'
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.700"
      backdropFilter="blur(8px)"
    >
      <Box
        width="full"
        maxW="5xl"
        maxH="85vh"
        display="flex"
        flexDirection="column"
        borderRadius="lg"
        bg="bg.card"
        p={6}
        shadow="modal"
      >
        <Box mb={4}>
          <Heading size="2xl" color="text.primary">
            Select Torrent to Download
          </Heading>
          <Text mt={1} fontSize="sm" color="text.secondary">
            Found {results.length} torrent{results.length !== 1 ? 's' : ''} for{' '}
            <Text as="span" fontWeight="medium" color="text.primary">
              {query}
            </Text>
          </Text>
        </Box>

        <VStack flex="1" overflowY="auto" gap={2} mb={4} align="stretch">
          {results.map((result) => (
            <Button
              key={result.id}
              onClick={() => handleSelectTorrent(result)}
              disabled={isDownloading}
              width="full"
              height="auto"
              borderRadius="lg"
              border="1px solid"
              borderColor={selectedTorrent?.id === result.id ? 'border.focus' : 'border.base'}
              bg={selectedTorrent?.id === result.id ? 'bg.active' : 'bg.elevated'}
              p={4}
              textAlign="left"
              transition="all 0.2s"
              _hover={!isDownloading ? { borderColor: 'border.hover', bg: 'bg.hover' } : {}}
              _focus={{ outline: 'none', ring: 2, ringColor: 'interactive.base' }}
            >
              <Flex gap={3} align="flex-start">
                <Box flex="1">
                  <Flex align="flex-start" justify="space-between" gap={2}>
                    <Heading size="md" color="text.primary" flex="1">
                      {result.title}
                    </Heading>
                    {selectedTorrent?.id === result.id && (
                      <Icon as={FiCheck} boxSize={5} color="interactive.base" />
                    )}
                  </Flex>

                  <Text mt={1} fontSize="sm" color="text.secondary">
                    by {result.author}
                  </Text>

                  <Flex mt={2} flexWrap="wrap" align="center" gap={2}>
                    {result.format && (
                      <Badge
                        colorPalette={getFormatBadgeColor(result.format)}
                        textTransform="uppercase"
                        fontSize="xs"
                      >
                        {result.format}
                      </Badge>
                    )}
                    {result.category && (
                      <Badge colorPalette="gray" fontSize="xs">
                        {result.category}
                      </Badge>
                    )}
                    <Text fontSize="xs" color="text.muted">
                      📦 {result.size}
                    </Text>
                    <Text fontSize="xs" color="green.400">
                      ⬆ {result.seeders} seeders
                    </Text>
                    <Text fontSize="xs" color="text.muted">
                      ⬇ {result.leechers} leechers
                    </Text>
                    {result.relevanceScore !== undefined && (
                      <Text fontSize="xs" fontWeight="medium" color={getRelevanceColor(result.relevanceScore)}>
                        ⭐ {result.relevanceScore}% match
                      </Text>
                    )}
                  </Flex>

                  {result.uploadDate && (
                    <Text mt={1} fontSize="xs" color="text.muted">
                      Uploaded: {new Date(result.uploadDate).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
              </Flex>
            </Button>
          ))}
        </VStack>

        {isDownloading && (
          <Flex
            mb={4}
            borderRadius="lg"
            bg="blue.500/10"
            border="1px solid"
            borderColor="interactive.base"
            p={3}
            align="center"
            gap={3}
          >
            <Spinner size="sm" color="interactive.base" />
            <Text fontSize="sm" color="blue.400">
              Downloading torrent file...
            </Text>
          </Flex>
        )}

        <HStack justify="flex-end" gap={3}>
          <Button
            onClick={onCancel}
            disabled={isDownloading}
            size="md"
            bg="bg.elevated"
            color="text.primary"
            _hover={{ bg: 'bg.hover' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!selectedTorrent || isDownloading}
            size="md"
            bg="interactive.base"
            color="white"
            _hover={{ bg: 'interactive.hover' }}
          >
            {isDownloading ? (
              <>
                <Spinner size="sm" mr={2} />
                Downloading...
              </>
            ) : (
              <>
                <Icon as={FiDownload} mr={2} />
                Download Torrent
              </>
            )}
          </Button>
        </HStack>
      </Box>
    </Box>
  )
}
