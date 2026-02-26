import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Flex,
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  IconButton,
  Button,
} from '@chakra-ui/react'
import { FiPlay, FiDownload, FiActivity, FiRotateCcw } from 'react-icons/fi'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { useMixExportStore } from '@/store/mixExportStore'
import { toaster } from '@/components/ui/toaster'
import { MixPrepTracklist } from './MixPrepTracklist'
import { TransitionDetail } from './TransitionDetail'
import { MixHealthDashboard } from './MixHealthDashboard'
import { usePairNavigation } from './hooks/usePairNavigation'
import { AddFilesDropZone } from '@/components/features/mix/AddFilesDropZone'
import { useKeyData } from '@/hooks/useKeyData'
import type { Song } from '@shared/types/project.types'
import type { Track } from '@/store/audioPlayerStore'

function songToTrack(song: Song): Track {
  return {
    filePath: song.localFilePath ?? song.externalFilePath ?? '',
    name: song.title,
    duration: song.duration,
  }
}

interface MixPrepViewProps {
  onOpenExportModal: () => void
}

export function MixPrepView({
  onOpenExportModal,
}: MixPrepViewProps): JSX.Element {
  const currentProject = useProjectStore((s) => s.currentProject)
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const playPlaylist = useAudioPlayerStore((s) => s.playPlaylist)
  const isExporting = useMixExportStore((s) => s.isExporting)

  // Sync assets/audio/ folder on mount
  useEffect(() => {
    if (!currentProject) return
    window.api.mix.syncAudioFolder(currentProject.id).then((response) => {
      if (
        response.success &&
        response.data &&
        response.newCount &&
        response.newCount > 0
      ) {
        setCurrentProject(response.data)
        toaster.create({
          title: `Synced ${response.newCount} new ${response.newCount === 1 ? 'track' : 'tracks'} from audio folder`,
          type: 'success',
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id])

  const songs = useMemo(
    () =>
      currentProject
        ? [...currentProject.songs].sort((a, b) => a.order - b.order)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject?.songs]
  )

  // Trigger batch key detection for songs missing key data
  useKeyData(currentProject?.id)

  const pairNav = usePairNavigation(songs)
  const { selectedIndex, outgoingTrack, incomingTrack, selectIndex } = pairNav
  const [showDashboard, setShowDashboard] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleResetMix = useCallback(async () => {
    if (songs.length === 0 || !currentProject) return

    const confirmed = window.confirm(
      'Reset all mix settings?\n\nThis will clear crossfade, tempo sync, trim points, and cue points for all tracks. BPM and key data will be kept.'
    )
    if (!confirmed) return

    setIsResetting(true)
    try {
      let lastProject: typeof currentProject | null = null
      for (const song of songs) {
        const response = await window.api.mix.updateSong({
          projectId: currentProject.id,
          songId: song.id,
          updates: {
            crossfadeDuration: undefined,
            crossfadeCurveType: undefined,
            tempoAdjustment: undefined,
            trimStart: undefined,
            trimEnd: undefined,
            cuePoints: undefined,
          },
        })
        if (response.success && response.data) {
          lastProject = response.data
        }
      }
      if (lastProject) {
        setCurrentProject(lastProject)
        toaster.create({ title: 'Mix settings reset', type: 'success' })
      }
    } finally {
      setIsResetting(false)
    }
  }, [songs, currentProject, setCurrentProject])

  if (!currentProject) return <></>

  const tracks = songs.map(songToTrack)

  function handlePlayAll(): void {
    if (tracks.length > 0) {
      playPlaylist(tracks, 0)
    }
  }

  return (
    <VStack align="stretch" gap={4} h="full">
      {/* Split-panel layout */}
      <Flex
        flex={1}
        minH={0}
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        overflow="hidden"
      >
        {/* Left panel: Tracklist */}
        <Box
          w="280px"
          flexShrink={0}
          borderRightWidth="1px"
          borderColor="border.base"
          bg="bg.card"
          display="flex"
          flexDirection="column"
        >
          {/* Tracklist header */}
          <Flex
            px={3}
            py={2}
            align="center"
            justify="space-between"
            borderBottomWidth="1px"
            borderColor="border.base"
          >
            <HStack gap={2}>
              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                Tracklist
              </Text>
              <Text fontSize="xs" color="text.muted">
                {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
              </Text>
            </HStack>
            <HStack gap={1}>
              <IconButton
                aria-label="Export mix"
                size="2xs"
                colorPalette="green"
                variant="ghost"
                onClick={onOpenExportModal}
                title="Export mix to file"
                disabled={isExporting || songs.length === 0}
              >
                <Icon as={FiDownload} boxSize={3} />
              </IconButton>
              <IconButton
                aria-label="Play all"
                size="2xs"
                colorPalette="blue"
                variant="ghost"
                onClick={handlePlayAll}
                title="Play all tracks"
                disabled={songs.length === 0}
              >
                <Icon as={FiPlay} boxSize={3} />
              </IconButton>
              <Button
                size="2xs"
                variant={showDashboard ? 'solid' : 'ghost'}
                colorPalette="teal"
                onClick={() => setShowDashboard((prev) => !prev)}
                title="Toggle mix health dashboard"
                disabled={songs.length < 2}
              >
                <Icon as={FiActivity} boxSize={3} />
              </Button>
              <IconButton
                aria-label="Reset mix settings"
                size="2xs"
                colorPalette="red"
                variant="ghost"
                onClick={handleResetMix}
                title="Reset crossfade, tempo sync, trims, and cue points for all tracks"
                disabled={songs.length === 0 || isResetting}
                loading={isResetting}
              >
                <Icon as={FiRotateCcw} boxSize={3} />
              </IconButton>
            </HStack>
          </Flex>

          {/* Track rows */}
          <MixPrepTracklist
            songs={songs}
            selectedIndex={selectedIndex}
            onSelectIndex={selectIndex}
          />

          {/* Add files zone at the bottom of tracklist */}
          <Box borderTopWidth="1px" borderColor="border.base" flexShrink={0}>
            <AddFilesDropZone />
          </Box>
        </Box>

        {/* Right panel: Transition detail or Mix Health dashboard */}
        {showDashboard ? (
          <MixHealthDashboard
            songs={songs}
            onNavigateToPair={(idx) => {
              pairNav.goToIndex(idx)
              setShowDashboard(false)
            }}
          />
        ) : (
          <TransitionDetail
            outgoingTrack={outgoingTrack}
            incomingTrack={incomingTrack}
            songCount={songs.length}
            projectId={currentProject.id}
            pairNav={pairNav}
          />
        )}
      </Flex>
    </VStack>
  )
}
