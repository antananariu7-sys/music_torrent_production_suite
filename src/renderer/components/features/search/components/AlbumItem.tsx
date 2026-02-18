import { useState } from 'react'
import { Box, VStack, Text, HStack, Icon, Image } from '@chakra-ui/react'
import { FiDisc } from 'react-icons/fi'
import type { MusicBrainzAlbum } from '@shared/types/musicbrainz.types'

interface AlbumItemProps {
  album: MusicBrainzAlbum
  onSelect?: (album: MusicBrainzAlbum) => void
}

export const AlbumItem: React.FC<AlbumItemProps> = ({ album, onSelect }) => {
  const [imageError, setImageError] = useState(false)
  const hasCover = album.coverArtUrl && !imageError
  const year = album.date ? new Date(album.date).getFullYear() : null

  const typeLabel = album.type
    ? album.type.charAt(0).toUpperCase() + album.type.slice(1)
    : null

  return (
    <Box
      position="relative"
      h="100px"
      borderRadius="md"
      overflow="hidden"
      cursor="pointer"
      onClick={() => onSelect?.(album)}
      transition="all 0.2s"
      borderWidth="1px"
      borderColor="border.base"
      _hover={{
        borderColor: 'border.focus',
        transform: 'scale(1.02)',
      }}
    >
      {/* Background: Cover art or fallback gradient */}
      {hasCover ? (
        <Image
          src={album.coverArtUrl}
          alt=""
          position="absolute"
          inset={0}
          w="full"
          h="full"
          objectFit="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Box
          position="absolute"
          inset={0}
          bgGradient="to-br"
          gradientFrom="gray.700"
          gradientTo="gray.900"
        />
      )}

      {/* Dark overlay for text contrast */}
      <Box
        position="absolute"
        inset={0}
        bgGradient="to-t"
        gradientFrom="blackAlpha.900"
        gradientVia="blackAlpha.600"
        gradientTo="blackAlpha.300"
      />

      {/* Fallback icon when no cover */}
      {!hasCover && (
        <Icon
          as={FiDisc}
          position="absolute"
          top={2}
          right={2}
          boxSize={8}
          color="whiteAlpha.300"
        />
      )}

      {/* Content overlay */}
      <VStack
        position="relative"
        h="full"
        align="start"
        justify="flex-end"
        p={3}
        gap={0.5}
      >
        <Text
          fontSize="sm"
          fontWeight="semibold"
          color="white"
          lineClamp={1}
          textShadow="0 1px 3px rgba(0,0,0,0.5)"
        >
          {album.title}
        </Text>
        <Text
          fontSize="xs"
          color="whiteAlpha.800"
          lineClamp={1}
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
        >
          {album.artist}
        </Text>
        <HStack gap={2} mt={0.5}>
          {year && (
            <Text fontSize="xs" color="whiteAlpha.700">
              {year}
            </Text>
          )}
          {typeLabel && (
            <Text
              fontSize="xs"
              color="whiteAlpha.900"
              bg="whiteAlpha.200"
              px={1.5}
              py={0.5}
              borderRadius="sm"
            >
              {typeLabel}
            </Text>
          )}
          {album.trackCount && (
            <Text fontSize="xs" color="whiteAlpha.700">
              {album.trackCount} tracks
            </Text>
          )}
        </HStack>
      </VStack>

      {/* Score badge */}
      {album.score !== undefined && album.score >= 80 && (
        <Box
          position="absolute"
          top={2}
          right={2}
          bg="green.500"
          color="white"
          fontSize="xs"
          fontWeight="bold"
          px={1.5}
          py={0.5}
          borderRadius="sm"
        >
          {album.score}%
        </Box>
      )}
    </Box>
  )
}
