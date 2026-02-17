import { useState, useCallback } from 'react'
import { Box, HStack, VStack, Text, Button, Icon, IconButton } from '@chakra-ui/react'
import { FiDownload, FiCopy, FiTrash2, FiCheck, FiExternalLink, FiList, FiChevronUp } from 'react-icons/fi'
import { useTorrentCollectionStore } from '@/store/torrentCollectionStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useTorrentActivityStore } from '@/store/torrentActivityStore'
import { toaster } from '@/components/ui/toaster'
import type { CollectedTorrent } from '@shared/types/torrent.types'
import type { TorrentPageMetadata } from '@shared/types/torrentMetadata.types'
import { TorrentTrackListPreview, TorrentTrackListLoading, TorrentTrackListError } from '../search/TorrentTrackListPreview'

interface CollectedTorrentItemProps {
  torrent: CollectedTorrent
}

export function CollectedTorrentItem({ torrent }: CollectedTorrentItemProps): JSX.Element {
  const removeFromCollection = useTorrentCollectionStore((state) => state.removeFromCollection)
  const updateMagnetLink = useTorrentCollectionStore((state) => state.updateMagnetLink)
  const currentProject = useProjectStore((state) => state.currentProject)
  const addLog = useTorrentActivityStore((state) => state.addLog)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [previewMetadata, setPreviewMetadata] = useState<TorrentPageMetadata | null>(null)
  const [previewError, setPreviewError] = useState<string>('')
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)

  const formatSize = (bytes?: number): string => {
    if (!bytes) return ''
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const handleCopyMagnet = async () => {
    if (!torrent.magnetLink) return

    try {
      await navigator.clipboard.writeText(torrent.magnetLink)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)

      toaster.create({
        title: 'Magnet link copied',
        description: 'Open in your torrent client to start downloading.',
        type: 'success',
        duration: 3000,
      })
    } catch (err) {
      console.error('Failed to copy magnet link:', err)
      toaster.create({
        title: 'Failed to copy',
        description: 'Could not copy magnet link to clipboard.',
        type: 'error',
        duration: 3000,
      })
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)

    const label = torrent.title.length > 40 ? torrent.title.slice(0, 40) + '...' : torrent.title

    try {
      addLog(`[${label}] Starting download...`, 'info')

      let magnetUri = torrent.magnetLink
      let torrentFilePath: string | undefined

      // Step 1: Check for local .torrent file in project directory
      if (currentProject?.projectDirectory) {
        addLog(`[${label}] Checking for local .torrent file...`, 'info')

        const checkResult = await window.api.torrent.checkLocalFile({
          torrentId: torrent.torrentId,
          projectDirectory: currentProject.projectDirectory,
        })

        if (checkResult.found && checkResult.filePath) {
          torrentFilePath = checkResult.filePath
          addLog(`[${label}] Found local .torrent file: ${checkResult.filePath}`, 'success')
        } else {
          addLog(`[${label}] No local .torrent file found, will use magnet link`, 'info')
        }
      }

      // Step 2: If no .torrent file AND no magnet link, extract via Puppeteer
      if (!torrentFilePath && !magnetUri) {
        addLog(`[${label}] No magnet link available, extracting from RuTracker...`, 'info')

        const extractResponse = await window.api.torrent.download({
          torrentId: torrent.torrentId,
          pageUrl: torrent.pageUrl,
          title: torrent.title,
          projectDirectory: currentProject?.projectDirectory,
        })

        if (!extractResponse.success || !extractResponse.torrent?.magnetLink) {
          const err = extractResponse.error || 'Could not extract magnet link'
          addLog(`[${label}] Magnet extraction failed: ${err}`, 'error')
          throw new Error(err)
        }

        magnetUri = extractResponse.torrent.magnetLink
        addLog(`[${label}] Magnet link extracted successfully`, 'success')

        // Save the magnet link to collection for future downloads
        updateMagnetLink(torrent.id, magnetUri)
        addLog(`[${label}] Magnet link saved to collection`, 'info')
      }

      // Step 3: Prompt for download location
      addLog(`[${label}] Prompting for download location...`, 'info')

      const savedPathResponse = await window.api.webtorrent.getDownloadPath(torrent.projectId)
      const defaultPath = savedPathResponse.data || currentProject?.projectDirectory || ''

      const selectedPath = await window.api.selectDirectory('Select Download Location')
      if (!selectedPath) {
        addLog(`[${label}] Download cancelled by user`, 'warning')
        return
      }

      const downloadPath = selectedPath || defaultPath
      if (!downloadPath) {
        addLog(`[${label}] No download directory selected`, 'error')
        throw new Error('Download directory not set. Please select a folder.')
      }

      await window.api.webtorrent.setDownloadPath(torrent.projectId, downloadPath)
      addLog(`[${label}] Download path: ${downloadPath}`, 'info')

      // Step 4: Add to WebTorrent download queue
      const source = torrentFilePath ? '.torrent file' : 'magnet link'
      addLog(`[${label}] Adding to download queue via ${source}...`, 'info')

      const result = await window.api.webtorrent.add({
        magnetUri: magnetUri || '',
        projectId: torrent.projectId,
        name: torrent.title,
        downloadPath,
        fromCollectedTorrentId: torrent.id,
        torrentFilePath,
      })

      if (result.success) {
        addLog(`[${label}] Successfully added to download queue`, 'success')
        toaster.create({
          title: 'Added to download queue',
          description: torrent.title,
          type: 'success',
          duration: 5000,
        })
      } else {
        addLog(`[${label}] Failed to add to queue: ${result.error}`, 'error')
        throw new Error(result.error || 'Failed to add to queue')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed'
      setDownloadError(errorMsg)
      addLog(`[${label}] Error: ${errorMsg}`, 'error')

      toaster.create({
        title: 'Download failed',
        description: errorMsg,
        type: 'error',
        duration: 5000,
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRemove = () => {
    removeFromCollection(torrent.id)

    toaster.create({
      title: 'Removed from collection',
      description: torrent.title,
      type: 'info',
      duration: 3000,
    })
  }

  const handlePreviewClick = useCallback(async () => {
    if (previewState === 'loaded') {
      setIsPreviewExpanded(!isPreviewExpanded)
      return
    }

    setPreviewState('loading')
    setIsPreviewExpanded(true)

    try {
      const response = await window.api.torrentMetadata.parse({
        torrentUrl: torrent.pageUrl,
        torrentId: torrent.torrentId,
      })
      if (response.success && response.metadata) {
        setPreviewMetadata(response.metadata)
        setPreviewState('loaded')
      } else {
        setPreviewError(response.error || 'Unknown error')
        setPreviewState('error')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to load')
      setPreviewState('error')
    }
  }, [torrent.pageUrl, torrent.torrentId, previewState, isPreviewExpanded])

  const handleOpenPage = async () => {
    try {
      await window.api.search.openUrl(torrent.pageUrl)
    } catch (err) {
      console.error('Failed to open URL:', err)
    }
  }

  return (
    <Box
      p={4}
      borderRadius="md"
      bg="bg.elevated"
      borderWidth="1px"
      borderColor={downloadError ? 'red.500/50' : 'border.base'}
      transition="all 0.2s"
      _hover={{
        borderColor: downloadError ? 'red.500' : 'border.focus',
      }}
    >
      <HStack justify="space-between" align="start" gap={4}>
        {/* Torrent Info */}
        <VStack align="start" gap={2} flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="medium" color="text.primary" lineClamp={2}>
            {torrent.title}
          </Text>

          <HStack gap={3} flexWrap="wrap">
            {torrent.metadata?.size && (
              <Text fontSize="xs" color="text.muted">
                {torrent.metadata.sizeBytes
                  ? formatSize(torrent.metadata.sizeBytes)
                  : torrent.metadata.size}
              </Text>
            )}
            {torrent.metadata?.seeders !== undefined && (
              <Text fontSize="xs" color="green.500">
                ↑ {torrent.metadata.seeders}
              </Text>
            )}
            {torrent.metadata?.leechers !== undefined && (
              <Text fontSize="xs" color="orange.500">
                ↓ {torrent.metadata.leechers}
              </Text>
            )}
            <Text fontSize="xs" color="text.muted">
              Added {formatDate(torrent.addedAt)}
            </Text>
          </HStack>

          {downloadError && (
            <Text fontSize="xs" color="red.500">
              {downloadError}
            </Text>
          )}
        </VStack>

        {/* Actions */}
        <HStack gap={2} flexShrink={0}>
          <IconButton
            aria-label="Open torrent page"
            size="sm"
            variant="ghost"
            onClick={handleOpenPage}
            title="Open torrent page"
          >
            <Icon as={FiExternalLink} boxSize={4} />
          </IconButton>

          <IconButton
            aria-label="Copy magnet link"
            size="sm"
            variant="ghost"
            onClick={handleCopyMagnet}
            disabled={!torrent.magnetLink}
            title={torrent.magnetLink ? 'Copy magnet link' : 'Magnet link unavailable'}
          >
            <Icon as={isCopied ? FiCheck : FiCopy} boxSize={4} color={isCopied ? 'green.500' : undefined} />
          </IconButton>

          <Button
            size="sm"
            colorPalette="blue"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            <Icon as={FiDownload} mr={2} />
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>

          <IconButton
            aria-label="Remove from collection"
            size="sm"
            variant="ghost"
            colorPalette="red"
            onClick={handleRemove}
            title="Remove from collection"
          >
            <Icon as={FiTrash2} boxSize={4} />
          </IconButton>
        </HStack>
      </HStack>

      {/* Preview tracks button */}
      <HStack mt={2}>
        <Button
          size="xs"
          variant="outline"
          onClick={handlePreviewClick}
          loading={previewState === 'loading'}
        >
          <Icon as={isPreviewExpanded && previewState === 'loaded' ? FiChevronUp : FiList} boxSize={3} />
          {previewState === 'loaded' ? (isPreviewExpanded ? 'Hide tracks' : 'Show tracks') : 'Preview tracks'}
        </Button>
      </HStack>

      {/* Expandable track list preview */}
      {isPreviewExpanded && (
        <Box mt={2} pl={2}>
          {previewState === 'loading' && <TorrentTrackListLoading />}
          {previewState === 'error' && <TorrentTrackListError error={previewError} />}
          {previewState === 'loaded' && previewMetadata && <TorrentTrackListPreview metadata={previewMetadata} />}
        </Box>
      )}
    </Box>
  )
}
