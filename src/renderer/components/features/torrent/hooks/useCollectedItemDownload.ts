import { useState, useRef } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { useTorrentActivityStore } from '@/store/torrentActivityStore'
import { toaster } from '@/components/ui/toaster'
import type { CollectedTorrent, TorrentContentFile } from '@shared/types/torrent.types'

interface UseCollectedItemDownloadReturn {
  isDownloading: boolean
  downloadError: string | null
  showFileSelection: boolean
  fileSelectionFiles: TorrentContentFile[]
  handleDownload: () => Promise<void>
  handleFileSelectionConfirm: (selectedFileIndices: number[]) => Promise<void>
  handleFileSelectionCancel: () => void
}

/**
 * useCollectedItemDownload
 *
 * Manages the multi-step download flow:
 * 1. Check for local .torrent file
 * 2. Download from RuTracker via Puppeteer if needed
 * 3. Parse file list for selection dialog
 * 4. Prompt for download location and add to WebTorrent queue
 */
export function useCollectedItemDownload(
  torrent: CollectedTorrent,
  onMagnetLinkObtained: (torrentId: string, magnetUri: string) => void,
): UseCollectedItemDownloadReturn {
  const currentProject = useProjectStore((state) => state.currentProject)
  const addLog = useTorrentActivityStore((state) => state.addLog)

  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [showFileSelection, setShowFileSelection] = useState(false)
  const [fileSelectionFiles, setFileSelectionFiles] = useState<TorrentContentFile[]>([])
  const pendingDownloadRef = useRef<{
    magnetUri: string
    torrentFilePath?: string
    label: string
  } | null>(null)

  const addToQueue = async (
    magnetUri: string,
    torrentFilePath: string | undefined,
    label: string,
    selectedFileIndices?: number[],
  ) => {
    try {
      addLog(`[${label}] Prompting for download location...`, 'info')

      const savedPathResponse = await window.api.webtorrent.getDownloadPath(torrent.projectId)
      const defaultPath = savedPathResponse.data || currentProject?.projectDirectory || ''

      const selectedPath = await window.api.selectDirectory('Select Download Location')
      if (!selectedPath) {
        addLog(`[${label}] Download cancelled by user`, 'warning')
        setIsDownloading(false)
        return
      }

      const downloadPath = selectedPath || defaultPath
      if (!downloadPath) {
        addLog(`[${label}] No download directory selected`, 'error')
        throw new Error('Download directory not set. Please select a folder.')
      }

      await window.api.webtorrent.setDownloadPath(torrent.projectId, downloadPath)
      addLog(`[${label}] Download path: ${downloadPath}`, 'info')

      const source = torrentFilePath ? '.torrent file' : 'magnet link'
      addLog(`[${label}] Adding to download queue via ${source}...`, 'info')

      const result = await window.api.webtorrent.add({
        magnetUri: magnetUri || '',
        projectId: torrent.projectId,
        name: torrent.title,
        downloadPath,
        fromCollectedTorrentId: torrent.id,
        torrentFilePath,
        selectedFileIndices,
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
    } finally {
      setIsDownloading(false)
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
          addLog(`[${label}] No local .torrent file found`, 'info')
        }
      }

      // Step 2: If no .torrent file, always try to download from RuTracker first.
      // Magnet link (if any) is kept only as a fallback when download fails.
      if (!torrentFilePath) {
        addLog(`[${label}] Downloading .torrent from RuTracker...`, 'info')

        const extractResponse = await window.api.torrent.download({
          torrentId: torrent.torrentId,
          pageUrl: torrent.pageUrl,
          title: torrent.title,
          projectDirectory: currentProject?.projectDirectory,
        })

        if (extractResponse.success && extractResponse.torrent) {
          if (extractResponse.torrent.filePath) {
            torrentFilePath = extractResponse.torrent.filePath
            addLog(`[${label}] .torrent file saved: ${torrentFilePath}`, 'success')
          }

          if (extractResponse.torrent.magnetLink) {
            magnetUri = extractResponse.torrent.magnetLink
            onMagnetLinkObtained(torrent.id, magnetUri)
            addLog(`[${label}] Magnet link obtained from RuTracker`, 'info')
          }
        } else {
          addLog(`[${label}] .torrent download failed: ${extractResponse.error || 'unknown error'}`, 'warning')
        }

        if (!torrentFilePath && magnetUri) {
          addLog(`[${label}] Falling back to magnet link`, 'warning')
        } else if (!torrentFilePath && !magnetUri) {
          throw new Error('Could not obtain .torrent file or magnet link from RuTracker')
        }
      }

      // Step 3: Parse .torrent file to get file list for selection
      if (torrentFilePath) {
        addLog(`[${label}] Parsing torrent file list...`, 'info')

        const parseResult = await window.api.webtorrent.parseTorrentFiles(torrentFilePath)

        if (parseResult.success && parseResult.files && parseResult.files.length > 0) {
          addLog(`[${label}] Found ${parseResult.files.length} files, showing selection...`, 'info')

          pendingDownloadRef.current = { magnetUri: magnetUri || '', torrentFilePath, label }
          setFileSelectionFiles(parseResult.files)
          setShowFileSelection(true)
          return
        }

        addLog(`[${label}] Could not parse file list, will download all files`, 'warning')
      }

      // Step 4 (no file selection): Prompt for location and add to queue
      await addToQueue(magnetUri || '', torrentFilePath, label)
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
      setIsDownloading(false)
    }
  }

  const handleFileSelectionConfirm = async (selectedFileIndices: number[]) => {
    setShowFileSelection(false)
    setFileSelectionFiles([])

    const pending = pendingDownloadRef.current
    if (!pending) return
    pendingDownloadRef.current = null

    try {
      await addToQueue(pending.magnetUri, pending.torrentFilePath, pending.label, selectedFileIndices)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed'
      setDownloadError(errorMsg)
      addLog(`[${pending.label}] Error: ${errorMsg}`, 'error')

      toaster.create({
        title: 'Download failed',
        description: errorMsg,
        type: 'error',
        duration: 5000,
      })
      setIsDownloading(false)
    }
  }

  const handleFileSelectionCancel = () => {
    const pending = pendingDownloadRef.current
    const label = pending?.label || torrent.title
    addLog(`[${label}] File selection cancelled by user`, 'warning')

    setShowFileSelection(false)
    setFileSelectionFiles([])
    pendingDownloadRef.current = null
    setIsDownloading(false)
  }

  return {
    isDownloading,
    downloadError,
    showFileSelection,
    fileSelectionFiles,
    handleDownload,
    handleFileSelectionConfirm,
    handleFileSelectionCancel,
  }
}
