import { HStack, Button, Icon, Text } from '@chakra-ui/react'
import { FiScissors, FiTrash2 } from 'react-icons/fi'

interface WaveformEditorProps {
  isEditing: boolean
  onToggleEditing: () => void
  onClearAll: () => void
  regionCount: number
}

/**
 * Small toolbar for waveform region editing controls.
 */
export function WaveformEditor({
  isEditing,
  onToggleEditing,
  onClearAll,
  regionCount,
}: WaveformEditorProps): JSX.Element {
  return (
    <HStack gap={2}>
      <Button
        size="2xs"
        variant={isEditing ? 'solid' : 'outline'}
        onClick={onToggleEditing}
        title="Toggle waveform region editing"
      >
        <Icon as={FiScissors} boxSize={3} />
        Edit
      </Button>
      {regionCount > 0 && (
        <>
          <Button
            size="2xs"
            variant="ghost"
            onClick={onClearAll}
            title="Clear all regions"
          >
            <Icon as={FiTrash2} boxSize={3} />
            Clear
          </Button>
          <Text fontSize="2xs" color="text.muted">
            {regionCount} region{regionCount !== 1 ? 's' : ''}
          </Text>
        </>
      )}
    </HStack>
  )
}
