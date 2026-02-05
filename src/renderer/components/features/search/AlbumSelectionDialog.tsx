import React, { useState } from 'react'
import { Box, Button, Flex, Heading, Text, VStack, HStack, Badge, Icon, Image } from '@chakra-ui/react'
import { FiCheck, FiChevronRight, FiDisc } from 'react-icons/fi'
import type { MusicBrainzAlbum, SearchClassificationResult } from '@shared/types/musicbrainz.types'

interface AlbumSelectionDialogProps {
  isOpen: boolean
  albums: MusicBrainzAlbum[]
  selectedClassification: SearchClassificationResult | null
  onSelectAlbum: (album: MusicBrainzAlbum) => void
  onSelectDiscography?: () => void
  onCancel: () => void
}

export const AlbumSelectionDialog: React.FC<AlbumSelectionDialogProps> = ({
  isOpen,
  albums,
  selectedClassification,
  onSelectAlbum,
  onSelectDiscography,
  onCancel,
}) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MusicBrainzAlbum | null>(null)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleImageError = (albumId: string) => {
    setImageErrors((prev) => new Set(prev).add(albumId))
  }

  if (!isOpen) return null

  const isArtistSearch = selectedClassification?.type === 'artist'

  const formatDate = (date?: string): string => {
    if (!date) return 'Unknown'
    const year = date.split('-')[0]
    return year || 'Unknown'
  }

  const getAlbumTypeLabel = (type?: string): string => {
    if (!type) return ''
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const handleSelectAlbum = (album: MusicBrainzAlbum) => {
    setSelectedAlbum(album)
  }

  const handleConfirm = () => {
    if (selectedAlbum) {
      onSelectAlbum(selectedAlbum)
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
        maxW="4xl"
        maxH="85vh"
        display="flex"
        flexDirection="column"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
      >
        {/* Header */}
        <Box p={6} borderBottom="1px solid" borderColor="border.base" flexShrink={0}>
          <Heading size="2xl" color="text.primary">
            {isArtistSearch ? 'Select an Album' : 'Which Album Contains This Song?'}
          </Heading>
          <Text mt={2} fontSize="sm" color="text.secondary">
            {selectedClassification && (
              <>
                Found {albums.length} album{albums.length !== 1 ? 's' : ''} for{' '}
                <Text as="span" fontWeight="medium" color="text.primary">
                  {selectedClassification.name}
                </Text>
                {selectedClassification.artist && <> by {selectedClassification.artist}</>}
              </>
            )}
          </Text>
        </Box>

        {/* Body */}
        <VStack flex="1" overflowY="auto" p={6} gap={3} align="stretch">
          {/* Discography Option */}
          {isArtistSearch && onSelectDiscography && (
            <Button
              onClick={onSelectDiscography}
              width="full"
              height="auto"
              borderRadius="lg"
              border="2px dashed"
              borderColor="interactive.base"
              bg="bg.active"
              p={4}
              textAlign="left"
              transition="all 0.2s"
              _hover={{
                bg: 'bg.hover',
                borderColor: 'interactive.hover',
                transform: 'scale(1.01)',
              }}
            >
              <Flex align="center" gap={3}>
                <Text fontSize="3xl" flexShrink={0}>
                  📀
                </Text>
                <Box flex="1" minW="0">
                  <Heading size="lg" color="interactive.base">
                    Download Complete Discography
                  </Heading>
                  <Text fontSize="sm" color="text.secondary">
                    Search RuTracker for all albums by {selectedClassification?.name}
                  </Text>
                </Box>
                <Icon as={FiChevronRight} boxSize={6} color="interactive.base" flexShrink={0} />
              </Flex>
            </Button>
          )}

          {/* Album List */}
          {albums.map((album) => {
            const isSelected = selectedAlbum?.id === album.id
            return (
              <Button
                key={album.id}
                onClick={() => handleSelectAlbum(album)}
                width="full"
                height="auto"
                borderRadius="lg"
                p={4}
                textAlign="left"
                border="1px solid"
                borderColor={isSelected ? 'border.focus' : 'border.base'}
                bg={isSelected ? 'bg.active' : 'bg.card'}
                transition="all 0.2s"
                _hover={
                  !isSelected
                    ? {
                        borderColor: 'border.hover',
                        bg: 'bg.hover',
                      }
                    : {}
                }
              >
                <Flex align="flex-start" gap={3} width="full">
                  {album.coverArtUrl && !imageErrors.has(album.id) ? (
                    <Image
                      src={album.coverArtUrl}
                      alt={`${album.title} cover`}
                      boxSize="80px"
                      objectFit="cover"
                      borderRadius="md"
                      flexShrink={0}
                      onError={() => handleImageError(album.id)}
                    />
                  ) : (
                    <Icon as={FiDisc} boxSize="80px" color="interactive.base" flexShrink={0} />
                  )}
                  <Box flex="1" minW="0">
                    <Flex align="center" gap={2} flexWrap="wrap">
                      <Heading size="lg" color="text.primary">
                        {album.title}
                      </Heading>
                      {album.type && (
                        <Badge bg="bg.elevated" color="text.secondary" fontSize="xs">
                          {getAlbumTypeLabel(album.type)}
                        </Badge>
                      )}
                    </Flex>
                    <Text fontSize="sm" mt={1} color="text.secondary">
                      by {album.artist}
                    </Text>
                    <Flex mt={2} align="center" gap={3} fontSize="xs" flexWrap="wrap" color="text.muted">
                      <Text>📅 {formatDate(album.date)}</Text>
                      {album.trackCount && <Text>🎵 {album.trackCount} tracks</Text>}
                      {album.score && <Text>✨ {album.score}% match</Text>}
                    </Flex>
                  </Box>
                  {isSelected && <Icon as={FiCheck} boxSize={6} color="interactive.base" flexShrink={0} />}
                </Flex>
              </Button>
            )
          })}
        </VStack>

        {/* Footer */}
        <HStack p={6} borderTop="1px solid" borderColor="border.base" justify="flex-end" gap={3} flexShrink={0}>
          <Button onClick={onCancel} size="md" bg="bg.elevated" color="text.primary" _hover={{ bg: 'bg.hover' }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAlbum}
            size="md"
            px={6}
            bg="interactive.base"
            color="white"
            _hover={{ bg: 'interactive.hover' }}
          >
            Search RuTracker
          </Button>
        </HStack>
      </Box>
    </Box>
  )
}
