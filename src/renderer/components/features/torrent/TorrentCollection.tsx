import { Box, VStack, HStack, Text, Button, Icon, Heading } from '@chakra-ui/react'
import { FiDownload, FiTrash2 } from 'react-icons/fi'
import { useCollection, useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { CollectedTorrentItem } from './CollectedTorrentItem'

export function TorrentCollection(): JSX.Element {
  const collection = useCollection()
  const clearCollection = useTorrentCollectionStore((state) => state.clearCollection)

  return (
    <Box
      p={6}
      borderRadius="md"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.base"
    >
      <HStack justify="space-between" mb={4}>
        <HStack gap={2}>
          <Icon as={FiDownload} boxSize={5} color="interactive.base" />
          <Heading size="md" color="text.primary">
            Collected Torrents
          </Heading>
          {collection.length > 0 && (
            <Text
              fontSize="xs"
              bg="interactive.base"
              color="white"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {collection.length}
            </Text>
          )}
        </HStack>
        {collection.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={clearCollection}
          >
            <Icon as={FiTrash2} mr={2} />
            Clear All
          </Button>
        )}
      </HStack>

      {collection.length === 0 ? (
        <Box p={6} textAlign="center">
          <Icon as={FiDownload} boxSize={10} color="text.muted" mb={3} />
          <Text fontSize="sm" color="text.muted">
            No torrents collected yet
          </Text>
          <Text fontSize="xs" color="text.muted" mt={1}>
            Use the Search tab to find and add torrents to your collection
          </Text>
        </Box>
      ) : (
        <VStack align="stretch" gap={3}>
          {collection.map((torrent) => (
            <CollectedTorrentItem key={torrent.id} torrent={torrent} />
          ))}
        </VStack>
      )}
    </Box>
  )
}
