import { Badge } from '@chakra-ui/react'

interface DuplicateWarningBadgeProps {
  matchedFiles: string[]
  confidence: number
}

export function DuplicateWarningBadge({
  matchedFiles,
  confidence,
}: DuplicateWarningBadgeProps) {
  const tooltip = `Possible duplicate (${confidence}% match):\n${matchedFiles.join('\n')}`

  return (
    <Badge size="sm" colorPalette="orange" variant="subtle" title={tooltip}>
      DUP
    </Badge>
  )
}
