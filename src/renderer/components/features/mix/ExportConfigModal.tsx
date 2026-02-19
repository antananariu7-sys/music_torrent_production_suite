import { useState } from 'react'
import { Box, Button, Heading, HStack, Input, Text, VStack, Switch } from '@chakra-ui/react'
import { FiFolder } from 'react-icons/fi'
import { useMixExportStore } from '@/store/mixExportStore'
import { formatFileSize } from '@/pages/ProjectOverview/utils'
import type { Song } from '@shared/types/project.types'
import type { MixExportConfig, OutputFormat, Mp3Bitrate, MixExportRequest } from '@shared/types/mixExport.types'

interface ExportConfigModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  songs: Song[]
  defaultCrossfade: number
  exportConfig?: MixExportConfig
}

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'mp3', label: 'MP3' },
]

const BITRATE_OPTIONS: Mp3Bitrate[] = [128, 192, 256, 320]

function estimateOutputSize(
  songs: Song[],
  format: OutputFormat,
  mp3Bitrate: Mp3Bitrate,
  defaultCrossfade: number,
): number {
  // Calculate total mix duration accounting for crossfade overlap
  let totalDuration = 0
  for (let i = 0; i < songs.length; i++) {
    totalDuration += songs[i].duration ?? 0
    if (i < songs.length - 1) {
      totalDuration -= songs[i].crossfadeDuration ?? defaultCrossfade
    }
  }
  totalDuration = Math.max(0, totalDuration)

  // Bytes per second by format (stereo, 44.1kHz)
  const bps: Record<OutputFormat, number> = {
    wav: 44100 * 2 * 3, // 24-bit = 3 bytes/sample
    flac: 44100 * 2 * 3 * 0.6, // ~60% of WAV
    mp3: (mp3Bitrate * 1000) / 8,
  }

  return totalDuration * bps[format]
}

export function ExportConfigModal({
  isOpen,
  onClose,
  projectId,
  songs,
  defaultCrossfade,
  exportConfig,
}: ExportConfigModalProps): JSX.Element | null {
  const startExport = useMixExportStore((s) => s.startExport)

  const [format, setFormat] = useState<OutputFormat>(exportConfig?.outputFormat ?? 'flac')
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3Bitrate>(exportConfig?.mp3Bitrate ?? 320)
  const [normalization, setNormalization] = useState(exportConfig?.normalization ?? true)
  const [generateCueSheet, setGenerateCueSheet] = useState(exportConfig?.generateCueSheet ?? true)
  const [outputDirectory, setOutputDirectory] = useState('')
  const [filename, setFilename] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const estimatedSize = estimateOutputSize(songs, format, mp3Bitrate, defaultCrossfade)
  const canExport = outputDirectory.length > 0 && filename.trim().length > 0 && songs.length > 0

  async function handleBrowse(): Promise<void> {
    const dir = await window.api.selectDirectory('Select Export Directory')
    if (dir) setOutputDirectory(dir)
  }

  async function handleExport(): Promise<void> {
    if (!canExport) return
    setIsSubmitting(true)

    const request: MixExportRequest = {
      projectId,
      outputDirectory,
      outputFilename: filename.trim(),
      format,
      mp3Bitrate: format === 'mp3' ? mp3Bitrate : undefined,
      normalization,
      generateCueSheet,
      defaultCrossfadeDuration: defaultCrossfade,
    }

    await startExport(request)
    setIsSubmitting(false)
    onClose()
  }

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
      bg="blackAlpha.700"
      backdropFilter="blur(12px)"
      onClick={onClose}
    >
      <Box
        width="full"
        maxW="lg"
        borderRadius="xl"
        bg="bg.surface"
        border="1px solid"
        borderColor="border.base"
        shadow="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <VStack align="stretch" gap={0}>
          {/* Header */}
          <Box p={6} borderBottom="1px solid" borderColor="border.base">
            <Heading size="lg" color="text.primary">
              Export Mix
            </Heading>
          </Box>

          {/* Body */}
          <VStack align="stretch" gap={5} p={6}>
            {/* Output Format */}
            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Output Format
              </Text>
              <HStack gap={2}>
                {FORMAT_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={format === opt.value ? 'solid' : 'outline'}
                    colorPalette={format === opt.value ? 'blue' : undefined}
                    onClick={() => setFormat(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </HStack>
            </VStack>

            {/* MP3 Bitrate (conditional) */}
            {format === 'mp3' && (
              <VStack align="stretch" gap={2}>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  MP3 Bitrate
                </Text>
                <HStack gap={2}>
                  {BITRATE_OPTIONS.map((br) => (
                    <Button
                      key={br}
                      size="sm"
                      variant={mp3Bitrate === br ? 'solid' : 'outline'}
                      colorPalette={mp3Bitrate === br ? 'blue' : undefined}
                      onClick={() => setMp3Bitrate(br)}
                    >
                      {br}k
                    </Button>
                  ))}
                </HStack>
              </VStack>
            )}

            {/* Normalization Toggle */}
            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  Loudness Normalization
                </Text>
                <Text fontSize="xs" color="text.muted">
                  EBU R128 (-14 LUFS) — recommended for consistent volume
                </Text>
              </VStack>
              <Switch.Root
                checked={normalization}
                onCheckedChange={() => setNormalization(!normalization)}
                colorPalette="blue"
                size="lg"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </HStack>

            {/* CUE Sheet Toggle */}
            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                  Generate CUE Sheet
                </Text>
                <Text fontSize="xs" color="text.muted">
                  Track markers for CD burning / playback
                </Text>
              </VStack>
              <Switch.Root
                checked={generateCueSheet}
                onCheckedChange={() => setGenerateCueSheet(!generateCueSheet)}
                colorPalette="blue"
                size="lg"
              >
                <Switch.HiddenInput />
                <Switch.Control />
              </Switch.Root>
            </HStack>

            {/* Output Directory */}
            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Output Directory
              </Text>
              <HStack>
                <Box
                  flex={1}
                  px={3}
                  py={2}
                  borderRadius="md"
                  bg="bg.card"
                  border="1px solid"
                  borderColor="border.base"
                  minH="36px"
                >
                  <Text fontSize="sm" color={outputDirectory ? 'text.primary' : 'text.muted'} truncate>
                    {outputDirectory || 'No directory selected'}
                  </Text>
                </Box>
                <Button size="sm" variant="outline" onClick={handleBrowse}>
                  <FiFolder />
                  Browse
                </Button>
              </HStack>
            </VStack>

            {/* Filename */}
            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Filename
              </Text>
              <HStack>
                <Input
                  size="sm"
                  placeholder="my-mix"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  flex={1}
                />
                <Text fontSize="sm" color="text.muted">
                  .{format}
                </Text>
              </HStack>
            </VStack>

            {/* Estimated Size */}
            {estimatedSize > 0 && (
              <Text fontSize="xs" color="text.muted">
                Estimated output size: ~{formatFileSize(estimatedSize)}
              </Text>
            )}
          </VStack>

          {/* Footer */}
          <HStack p={6} pt={0} justify="flex-end" gap={3}>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              colorPalette="blue"
              onClick={handleExport}
              disabled={!canExport}
              loading={isSubmitting}
            >
              Export
            </Button>
          </HStack>
        </VStack>
      </Box>
    </Box>
  )
}
