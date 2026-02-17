import { Box, Flex, HStack, Text, Icon, Button } from '@chakra-ui/react'
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi'

interface SearchErrorNoticeProps {
  error: string
  onClose: () => void
  onRetry?: () => void
}

export const SearchErrorNotice: React.FC<SearchErrorNoticeProps> = ({ error, onClose, onRetry }) => {
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
          <HStack mt={2} gap={2}>
            {onRetry && (
              <Button
                onClick={onRetry}
                size="sm"
                colorPalette="red"
                variant="solid"
                _hover={{ bg: 'red.600' }}
              >
                <Icon as={FiRefreshCw} />
                Retry
              </Button>
            )}
            <Button
              onClick={onClose}
              size="sm"
              variant="ghost"
              color="red.500"
              _hover={{ bg: 'red.500/10' }}
            >
              Close
            </Button>
          </HStack>
        </Box>
      </Flex>
    </Box>
  )
}
