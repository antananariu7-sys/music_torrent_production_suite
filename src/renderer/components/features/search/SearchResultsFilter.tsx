import { useState, useCallback, useEffect, useRef } from 'react'
import { Input, Box, IconButton, HStack } from '@chakra-ui/react'
import { FiX } from 'react-icons/fi'

interface SearchResultsFilterProps {
  value: string
  onChange: (value: string) => void
  totalCount: number
}

const DEBOUNCE_MS = 200

export function SearchResultsFilter({
  value,
  onChange,
  totalCount,
}: SearchResultsFilterProps) {
  const [localValue, setLocalValue] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync external value changes (e.g. clear on new search)
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value
      setLocalValue(next)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onChange(next)
      }, DEBOUNCE_MS)
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    setLocalValue('')
    onChange('')
  }, [onChange])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <HStack gap={2} mb={2}>
      <Box position="relative" flex={1} maxW="300px">
        <Input
          size="sm"
          pl={3}
          pr={localValue ? 8 : 3}
          placeholder={`Filter ${totalCount} results…`}
          value={localValue}
          onChange={handleChange}
          borderColor="border.base"
          _focus={{ borderColor: 'border.focus' }}
        />
        {localValue && (
          <Box
            position="absolute"
            right={1}
            top="50%"
            transform="translateY(-50%)"
            zIndex={1}
          >
            <IconButton
              aria-label="Clear filter"
              size="2xs"
              variant="ghost"
              onClick={handleClear}
            >
              <FiX />
            </IconButton>
          </Box>
        )}
      </Box>
    </HStack>
  )
}
