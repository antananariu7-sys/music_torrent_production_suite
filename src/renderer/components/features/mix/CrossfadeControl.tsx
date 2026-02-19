import { useRef } from 'react'
import { Box, Flex, Text, Input, Icon } from '@chakra-ui/react'
import { FiRepeat } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'

interface CrossfadeControlProps {
  songId: string
  projectId: string
  value: number
}

export function CrossfadeControl({ songId, projectId, value }: CrossfadeControlProps): JSX.Element {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const raw = parseFloat(e.target.value)
    if (isNaN(raw)) return

    const clamped = Math.min(30, Math.max(0, raw))

    // Debounce persistence — save after 500ms of no input
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const response = await window.api.mix.updateSong({
        projectId,
        songId,
        updates: { crossfadeDuration: clamped },
      })
      if (response.success && response.data) {
        setCurrentProject(response.data)
      }
    }, 500)
  }

  return (
    <Box py={1} px={4}>
      <Flex align="center" justify="center" gap={2}>
        <Icon as={FiRepeat} boxSize={3} color="text.muted" />
        <Text fontSize="xs" color="text.muted" whiteSpace="nowrap">
          crossfade
        </Text>
        <Input
          size="xs"
          type="number"
          defaultValue={value}
          min={0}
          max={30}
          step={0.5}
          w="60px"
          textAlign="center"
          fontFamily="monospace"
          onChange={handleChange}
        />
        <Text fontSize="xs" color="text.muted">s</Text>
      </Flex>
    </Box>
  )
}
