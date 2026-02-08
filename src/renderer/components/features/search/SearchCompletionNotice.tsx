import { Box, Flex, Text, Icon } from '@chakra-ui/react'
import { FiDownload } from 'react-icons/fi'

export const SearchCompletionNotice: React.FC = () => {
  return (
    <Box
      p={4}
      borderRadius="md"
      bg="green.500/10"
      borderWidth="1px"
      borderColor="green.500/30"
    >
      <Flex align="center" gap={3}>
        <Icon as={FiDownload} boxSize={5} color="green.500" />
        <Box>
          <Text fontWeight="medium" color="green.500">
            Added to Collection!
          </Text>
          <Text fontSize="sm" color="text.secondary">
            Go to Torrent tab to manage downloads
          </Text>
        </Box>
      </Flex>
    </Box>
  )
}
