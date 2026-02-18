import { Box, Text } from '@chakra-ui/react'
import { formatEta } from '../utils/formatters'

interface TorrentProgressBarProps {
  progress: number
  status: string
  downloadSpeed: number
  downloaded: number
  totalSize: number
}

export function TorrentProgressBar({
  progress,
  status,
  downloadSpeed,
  downloaded,
  totalSize,
}: TorrentProgressBarProps): JSX.Element {
  return (
    <Box>
      <div
        style={{
          height: 8,
          background: 'var(--chakra-colors-bg-surface, #1a1a2e)',
          borderRadius: 9999,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: status === 'paused'
              ? 'var(--chakra-colors-yellow-500, #ecc94b)'
              : 'var(--chakra-colors-blue-500, #3b82f6)',
            borderRadius: 9999,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <Text fontSize="xs" color="text.muted" mt={1}>
        {progress}%
        {status === 'downloading' && downloadSpeed > 0 && totalSize > 0 && (
          <> — ETA {formatEta(totalSize - downloaded, downloadSpeed)}</>
        )}
      </Text>
    </Box>
  )
}
