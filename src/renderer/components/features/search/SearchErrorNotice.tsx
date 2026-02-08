import { Box, Flex, Text, Icon, Button } from '@chakra-ui/react'
import { FiAlertCircle } from 'react-icons/fi'

interface SearchErrorNoticeProps {
  error: string
  onClose: () => void
}

export const SearchErrorNotice: React.FC<SearchErrorNoticeProps> = ({ error, onClose }) => {
  return (
    <Box
      p={4}
      borderRadius="md"
      bg="red.500/10"
      borderWidth="1px"
      borderColor="red.500/30"
    >
      <Flex align="flex-start" gap={3}>
        <Icon as={FiAlertCircle} boxSize={5} color="red.500" flexShrink={0} />
        <Box flex="1">
          <Text fontWeight="medium" color="red.500">
            Search Error
          </Text>
          <Text fontSize="sm" color="text.secondary">
            {error}
          </Text>
          <Button
            onClick={onClose}
            mt={2}
            size="sm"
            variant="ghost"
            color="red.500"
            _hover={{ bg: 'red.500/10' }}
          >
            Close
          </Button>
        </Box>
      </Flex>
    </Box>
  )
}
