import { VStack } from '@chakra-ui/react'
import {
  TorrentCollection,
  DownloadManager,
  TorrentSettings,
} from '@/components/features/torrent'

export function TorrentTab(): JSX.Element {
  return (
    <VStack align="stretch" gap={6}>
      {/* Collected Torrents from Search */}
      <TorrentCollection />

      {/* Download Manager with History */}
      <DownloadManager />

      {/* Torrent Settings */}
      <TorrentSettings />
    </VStack>
  )
}
