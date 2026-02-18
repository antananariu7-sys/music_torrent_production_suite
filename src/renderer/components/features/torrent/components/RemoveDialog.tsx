import { Box, HStack, VStack, Text, Icon, Button } from '@chakra-ui/react'
import { FiFile, FiMusic } from 'react-icons/fi'
import { isAudioFile } from '@/utils/audioUtils'
import type { TorrentContentFile } from '@shared/types/torrent.types'
import { formatSize } from '../utils/formatters'

interface RemoveDialogProps {
  torrentName: string
  downloadPath: string
  downloadedFiles: TorrentContentFile[]
  downloadedSize: number
  onCancel: () => void
  onKeepFiles: () => void
  onDeleteFiles: () => void
}

export function RemoveDialog({
  torrentName,
  downloadPath,
  downloadedFiles,
  downloadedSize,
  onCancel,
  onKeepFiles,
  onDeleteFiles,
}: RemoveDialogProps): JSX.Element {
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
      onClick={onCancel}
    >
      <Box
        width="full"
        maxW="lg"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={0}>
          {/* Header */}
          <Box p={6} borderBottom="1px solid" borderColor="border.base">
            <Text fontSize="lg" fontWeight="semibold" color="text.primary">
              Remove Torrent
            </Text>
            <Text fontSize="sm" color="text.muted" mt={1} lineClamp={1}>
              {torrentName}
            </Text>
          </Box>

          {/* Body */}
          <Box p={6}>
            {downloadedFiles.length > 0 ? (
              <VStack align="stretch" gap={3}>
                <Text fontSize="sm" color="text.secondary">
                  {downloadedFiles.length} file(s) downloaded ({formatSize(downloadedSize)}) to:
                </Text>
                <Text fontSize="xs" color="text.muted" fontFamily="mono">
                  {downloadPath}
                </Text>
                <Box
                  maxH="200px"
                  overflowY="auto"
                  borderRadius="md"
                  bg="bg.elevated"
                  p={2}
                  borderWidth="1px"
                  borderColor="border.base"
                >
                  <VStack align="stretch" gap={1}>
                    {downloadedFiles.map((f) => (
                      <HStack key={f.path} justify="space-between" gap={2}>
                        <HStack gap={1} minW={0}>
                          <Icon as={isAudioFile(f.name) ? FiMusic : FiFile} boxSize={3} color="text.muted" flexShrink={0} />
                          <Text fontSize="xs" color="text.secondary" lineClamp={1}>
                            {f.name}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="text.muted" flexShrink={0}>
                          {formatSize(f.downloaded)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </VStack>
            ) : (
              <Text fontSize="sm" color="text.secondary">
                No files have been downloaded yet.
              </Text>
            )}
          </Box>

          {/* Footer */}
          <HStack p={6} pt={0} justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            {downloadedFiles.length > 0 ? (
              <>
                <Button variant="outline" onClick={onKeepFiles}>
                  Keep Files
                </Button>
                <Button colorPalette="red" onClick={onDeleteFiles}>
                  Delete Files
                </Button>
              </>
            ) : (
              <Button colorPalette="red" onClick={onKeepFiles}>
                Remove
              </Button>
            )}
          </HStack>
        </VStack>
      </Box>
    </Box>
  )
}
