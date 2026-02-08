import { VStack } from '@chakra-ui/react'
import {
  TorrentCollection,
  DownloadQueue,
  DownloadManager,
  TorrentSettings,
} from '@/components/features/torrent'

export function TorrentTab(): JSX.Element {
  return (
    <VStack align="stretch" gap={6}>
      {/* Collected Torrents from Search */}
      <TorrentCollection />

      {/* Active Download Queue */}
      <DownloadQueue />

      {/* Download History (legacy .torrent file extractions) */}
      <DownloadManager />

      {/* Torrent Settings */}
      <TorrentSettings />
    </VStack>
  )
}
