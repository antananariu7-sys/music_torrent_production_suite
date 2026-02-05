import React, { useState } from 'react'
import { Box, Button, Flex, Input, Spinner, Text, Icon } from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'
import { useSmartSearchStore } from '@/store/smartSearchStore'

interface SmartSearchBarProps {
  placeholder?: string
}

export const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  placeholder = 'Search for artist, album, or song...',
}) => {
  const [query, setQuery] = useState('')
  const { startSearch, isLoading, step } = useSmartSearchStore()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return
    if (isLoading) return

    startSearch(query.trim())
  }

  const handleClear = () => {
    setQuery('')
  }

  const isActive = step !== 'idle' && step !== 'completed' && step !== 'error'

  return (
    <Box as="form" onSubmit={handleSubmit} position="relative">
      <Box position="relative">
        {/* Search Icon */}
        <Box
          position="absolute"
          left={4}
          top="50%"
          transform="translateY(-50%)"
          color="text.muted"
          zIndex={1}
        >
          {isLoading && <Spinner size="sm" color="text.muted" />}
        </Box>

        {/* Input */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          width="full"
          borderRadius="lg"
          border="1px solid"
          borderColor={isActive ? 'border.focus' : 'border.base'}
          bg="bg.elevated"
          py={3}
          pl={12}
          pr={24}
          color="text.primary"
          _placeholder={{ color: 'text.muted' }}
          _focus={{
            outline: 'none',
            ring: 2,
            ringColor: 'interactive.base',
            borderColor: 'border.focus',
          }}
          _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
          ring={isActive ? 2 : 0}
          ringColor={isActive ? 'interactive.base' : undefined}
        />

        {/* Clear/Search Button */}
        <Flex
          position="absolute"
          right={2}
          top="50%"
          transform="translateY(-50%)"
          align="center"
          gap={2}
        >
          {query && (
            <Button
              type="button"
              onClick={handleClear}
              disabled={isLoading}
              size="sm"
              p={1.5}
              minW="auto"
              bg="transparent"
              color="text.muted"
              _hover={{ bg: 'bg.hover', color: 'text.primary' }}
            >
              <Icon as={FiX} boxSize={5} />
            </Button>
          )}

          <Button
            type="submit"
            disabled={!query.trim() || isLoading}
            size="sm"
            px={4}
            bg="interactive.base"
            color="white"
            _hover={{ bg: 'interactive.hover' }}
          >
            Search
          </Button>
        </Flex>
      </Box>

      {/* Status indicator */}
      {isActive && (
        <Flex mt={2} align="center" gap={2} fontSize="sm">
          <Box
            h={2}
            w={2}
            borderRadius="full"
            bg="interactive.base"
            animation="pulse 2s infinite"
          />
          <Text color="text.secondary">
            {step === 'classifying' && 'Classifying search...'}
            {step === 'user-choice' && "Choose what you're searching for"}
            {step === 'selecting-album' && 'Select an album'}
            {step === 'searching-rutracker' && 'Searching RuTracker...'}
            {step === 'selecting-torrent' && 'Select a torrent'}
            {step === 'downloading' && 'Downloading torrent file...'}
          </Text>
        </Flex>
      )}
    </Box>
  )
}
