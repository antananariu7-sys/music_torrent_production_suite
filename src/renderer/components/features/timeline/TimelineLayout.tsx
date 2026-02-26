import { useRef, useMemo } from 'react'
import { Box, Text, VStack, Spinner } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore } from '@/store/audioPlayerStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrackInfoOverlay } from './TrackInfoOverlay'
import { TimeRuler } from './TimeRuler'
import { CuePointMarker } from './CuePointMarker'
import { TrimOverlay } from './TrimOverlay'
import { BeatGrid } from './BeatGrid'
import { Playhead } from './Playhead'
import { CrossfadePopover } from './CrossfadePopover'
import { CuePointPopover } from './CuePointPopover'
import { VirtualTrack } from './VirtualTrack'
import { RegionSelection } from './RegionSelection'
import { CrossfadeZones } from './CrossfadeZones'
import { useRegionSelection } from './hooks/useRegionSelection'
import { useTimelineScroll } from './hooks/useTimelineScroll'
import { useTimelineZoom } from './hooks/useTimelineZoom'
import { useTrimDrag } from './hooks/useTrimDrag'
import { useCuePointDrag } from './hooks/useCuePointDrag'
import { useSelectionEdgeDrag } from './hooks/useSelectionEdgeDrag'
import { useTimelineHandlers } from './hooks/useTimelineHandlers'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

interface TimelineLayoutProps {
  songs: Song[]
  waveforms: Record<string, WaveformData>
  defaultCrossfade?: number
}

/** Base pixels per second at zoom 1x */
export const PX_PER_SEC = 10

/** Zoom limits */
export const MIN_ZOOM = 1
export const MAX_ZOOM = 10

/** Track height in pixels */
const TRACK_HEIGHT = 240

/** Alternating track colors for visual distinction */
export const TRACK_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4']

export interface TrackPosition {
  songId: string
  left: number
  width: number
}

export function computeTrackPositions(
  songs: Song[],
  pixelsPerSecond: number,
  defaultCrossfade: number
): TrackPosition[] {
  let currentOffset = 0
  return songs.map((song, i) => {
    const effectiveDuration =
      (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
    const width = effectiveDuration * pixelsPerSecond
    const position: TrackPosition = {
      songId: song.id,
      left: currentOffset,
      width,
    }
    const crossfade =
      i < songs.length - 1 ? (song.crossfadeDuration ?? defaultCrossfade) : 0
    currentOffset += (effectiveDuration - crossfade) * pixelsPerSecond
    return position
  })
}

export function TimelineLayout({
  songs,
  waveforms,
  defaultCrossfade = 5,
}: TimelineLayoutProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrollSyncing = useRef(false)
  const userScrolledRef = useRef(false)
  const zoomRef = useRef({ zoomLevel: 1, totalWidth: 0 })

  const currentProject = useProjectStore((s) => s.currentProject)

  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const snapMode = useTimelineStore((s) => s.snapMode)
  const frequencyColorMode = useTimelineStore((s) => s.frequencyColorMode)
  const showBeatGrid = useTimelineStore((s) => s.showBeatGrid)

  const activeCrossfadePopover = useTimelineStore(
    (s) => s.activeCrossfadePopover
  )
  const activeCuePointPopover = useTimelineStore((s) => s.activeCuePointPopover)
  const closeCrossfadePopover = useTimelineStore((s) => s.closeCrossfadePopover)
  const closeCuePointPopover = useTimelineStore((s) => s.closeCuePointPopover)
  const activeSelection = useTimelineStore((s) => s.activeSelection)

  const pixelsPerSecond = PX_PER_SEC * zoomLevel
  const positions = useMemo(
    () => computeTrackPositions(songs, pixelsPerSecond, defaultCrossfade),
    [songs, pixelsPerSecond, defaultCrossfade]
  )
  const totalWidth = useMemo(
    () =>
      positions.length > 0
        ? Math.max(...positions.map((p) => p.left + p.width))
        : 0,
    [positions]
  )

  // Slice waveform peaks to the committed trim region so the waveform
  // matches the trimmed track width (avoids compression/stretching).
  const slicedWaveforms = useMemo(() => {
    const result: Record<string, WaveformData> = {}
    for (const song of songs) {
      const wf = waveforms[song.id]
      if (!wf) continue
      const dur = song.duration ?? 0
      const ts = song.trimStart ?? 0
      const te = song.trimEnd ?? dur
      if (dur > 0 && (ts > 0 || te < dur)) {
        const si = Math.round((ts / dur) * wf.peaks.length)
        const ei = Math.round((te / dur) * wf.peaks.length)
        result[song.id] = {
          ...wf,
          peaks: wf.peaks.slice(si, ei),
          peaksLow: wf.peaksLow?.slice(si, ei),
          peaksMid: wf.peaksMid?.slice(si, ei),
          peaksHigh: wf.peaksHigh?.slice(si, ei),
        }
      } else {
        result[song.id] = wf
      }
    }
    return result
  }, [songs, waveforms])

  // Keep ref in sync for the wheel handler (avoids effect re-runs on every zoom tick)
  zoomRef.current.zoomLevel = zoomLevel
  zoomRef.current.totalWidth = totalWidth

  // --- Extracted hooks ---
  const { handleScroll } = useTimelineScroll({
    containerRef,
    isScrollSyncing,
    userScrolledRef,
    songs,
    positions,
    pixelsPerSecond,
  })

  useTimelineZoom({ containerRef, isScrollSyncing, zoomRef })

  const {
    previewTrims,
    handleTrimStartDrag,
    handleTrimEndDrag,
    handleTrimDragEnd,
    clearTrimPreview,
  } = useTrimDrag()

  const { previewCuePoints, handleCuePointDrag, handleCuePointDragEnd } =
    useCuePointDrag({
      songs,
      handleTrimStartDrag,
      handleTrimEndDrag,
      clearTrimPreview,
    })

  const {
    handleSelectionEdgeDragStart,
    handleSelectionEdgeDrag,
    handleSelectionEdgeDragEnd,
  } = useSelectionEdgeDrag()

  const {
    pendingSelection,
    didRegionSelect: didRegionSelectRef,
    handleRegionPointerDown,
  } = useRegionSelection({ pixelsPerSecond, snapMode, containerRef })

  // --- Click handlers (extracted) ---
  const {
    handleCuePointClick,
    handleTrackDoubleClick,
    handleCrossfadeClick,
    handleTrackClick,
    handleTrimToSelection,
    handlePlaySelection,
    clearActiveSelection,
  } = useTimelineHandlers({
    containerRef,
    pixelsPerSecond,
    songs,
    didRegionSelectRef,
    handleTrimStartDrag,
    handleTrimEndDrag,
    handleTrimDragEnd,
  })

  // Get data for active popovers
  const crossfadeSong = activeCrossfadePopover
    ? songs.find((s) => s.id === activeCrossfadePopover.songId)
    : null
  const cuePointSong = activeCuePointPopover
    ? songs.find((s) => s.id === activeCuePointPopover.songId)
    : null

  return (
    <>
      <Box
        ref={containerRef}
        data-timeline-scroll
        overflowX="auto"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        p={3}
        onScroll={handleScroll}
      >
        {/* Time ruler */}
        <TimeRuler totalWidth={totalWidth} pixelsPerSecond={pixelsPerSecond} />

        {/* Track area */}
        <Box
          position="relative"
          h={`${TRACK_HEIGHT}px`}
          minW={`${totalWidth}px`}
        >
          {songs.map((song, index) => {
            const pos = positions[index]
            const waveform = slicedWaveforms[song.id]
            const color = TRACK_COLORS[index % TRACK_COLORS.length]
            const isSelected = selectedTrackId === song.id
            const cuePoints = song.cuePoints ?? []

            return (
              <VirtualTrack
                key={song.id}
                left={pos.left}
                width={pos.width}
                height={TRACK_HEIGHT}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleTrackClick(e, song, pos.left, index)}
                  onDoubleClick={(e) =>
                    handleTrackDoubleClick(e, song, pos.left)
                  }
                  onPointerDown={(e) =>
                    handleRegionPointerDown(e, song, pos.left)
                  }
                  style={{ position: 'relative' }}
                >
                  <TrackInfoOverlay song={song} />

                  {waveform ? (
                    <WaveformCanvas
                      songId={song.id}
                      peaks={waveform.peaks}
                      peaksLow={waveform.peaksLow}
                      peaksMid={waveform.peaksMid}
                      peaksHigh={waveform.peaksHigh}
                      frequencyColorMode={frequencyColorMode}
                      width={pos.width}
                      height={TRACK_HEIGHT}
                      color={color}
                      isSelected={isSelected}
                    />
                  ) : (
                    <WaveformPlaceholder
                      width={pos.width}
                      height={TRACK_HEIGHT}
                    />
                  )}

                  {/* Beat grid overlay */}
                  {showBeatGrid && song.bpm != null && song.bpm > 0 && (
                    <BeatGrid
                      bpm={song.bpm}
                      firstBeatOffset={song.firstBeatOffset ?? 0}
                      trackWidth={pos.width}
                      trackHeight={TRACK_HEIGHT}
                      pixelsPerSecond={pixelsPerSecond}
                      trimStart={song.trimStart ?? 0}
                    />
                  )}

                  {/* Trim overlay + handles */}
                  <TrimOverlay
                    trimStart={
                      previewTrims[song.id]?.trimStart ?? song.trimStart
                    }
                    trimEnd={previewTrims[song.id]?.trimEnd ?? song.trimEnd}
                    trackStartTime={song.trimStart ?? 0}
                    trackWidth={pos.width}
                    trackHeight={TRACK_HEIGHT}
                    pixelsPerSecond={pixelsPerSecond}
                    songDuration={song.duration ?? 0}
                    onTrimStartDrag={(ts) => handleTrimStartDrag(song.id, ts)}
                    onTrimEndDrag={(ts) => handleTrimEndDrag(song.id, ts)}
                    onTrimDragEnd={() => handleTrimDragEnd(song.id)}
                    snapMode={snapMode}
                    bpm={song.bpm}
                    firstBeatOffset={song.firstBeatOffset}
                    trackIndex={index}
                    trackCount={songs.length}
                  />

                  {/* Cue point markers */}
                  {cuePoints.map((cp) => {
                    const previewTs = previewCuePoints[song.id]?.[cp.id]
                    const effectiveTs = previewTs ?? cp.timestamp
                    const cpX =
                      (effectiveTs - (song.trimStart ?? 0)) * pixelsPerSecond
                    if (cpX < 0 || cpX > pos.width) return null
                    return (
                      <CuePointMarker
                        key={cp.id}
                        cuePoint={cp}
                        x={cpX}
                        trackHeight={TRACK_HEIGHT}
                        pixelsPerSecond={pixelsPerSecond}
                        onClick={(clickedCp) =>
                          handleCuePointClick(song.id, pos.left, cpX, clickedCp)
                        }
                        onDrag={(draggedCp, ts) =>
                          handleCuePointDrag(song.id, draggedCp, ts)
                        }
                        onDragEnd={(draggedCp, ts) =>
                          handleCuePointDragEnd(song.id, draggedCp, ts)
                        }
                        snapMode={snapMode}
                        bpm={song.bpm}
                        firstBeatOffset={song.firstBeatOffset}
                        minTimestamp={song.trimStart ?? 0}
                        maxTimestamp={song.trimEnd ?? song.duration ?? 0}
                      />
                    )
                  })}

                  {/* Region selection overlay */}
                  {(() => {
                    const sel =
                      activeSelection?.songId === song.id
                        ? activeSelection
                        : pendingSelection?.songId === song.id
                          ? pendingSelection
                          : null
                    if (!sel) return null
                    const isFinalized = activeSelection?.songId === song.id
                    return (
                      <RegionSelection
                        startTime={sel.startTime}
                        endTime={sel.endTime}
                        pixelsPerSecond={pixelsPerSecond}
                        trackHeight={TRACK_HEIGHT}
                        trimStart={song.trimStart ?? 0}
                        showToolbar={isFinalized}
                        onTrimToSelection={() =>
                          handleTrimToSelection(
                            song.id,
                            sel.startTime,
                            sel.endTime
                          )
                        }
                        onPlaySelection={() =>
                          handlePlaySelection(
                            song,
                            sel.startTime,
                            sel.endTime,
                            index
                          )
                        }
                        onClear={() => {
                          clearActiveSelection()
                          useAudioPlayerStore.getState().clearLoopRegion()
                        }}
                        onEdgeDragStart={(side) =>
                          handleSelectionEdgeDragStart(song, side)
                        }
                        onEdgeDrag={(side, delta) =>
                          handleSelectionEdgeDrag(song.id, side, delta)
                        }
                        onEdgeDragEnd={handleSelectionEdgeDragEnd}
                      />
                    )
                  })()}
                </div>
              </VirtualTrack>
            )
          })}

          {/* Crossfade overlap zones */}
          <CrossfadeZones
            songs={songs}
            positions={positions}
            trackHeight={TRACK_HEIGHT}
            onCrossfadeClick={handleCrossfadeClick}
          />

          {/* Playhead */}
          <Playhead
            positions={positions}
            songs={songs}
            pixelsPerSecond={pixelsPerSecond}
            trackHeight={TRACK_HEIGHT}
          />
        </Box>
      </Box>

      {/* Crossfade popover */}
      {activeCrossfadePopover &&
        crossfadeSong &&
        currentProject &&
        (() => {
          const cfIndex = songs.findIndex((s) => s.id === crossfadeSong.id)
          const nextSong = cfIndex >= 0 ? songs[cfIndex + 1] : undefined
          return (
            <CrossfadePopover
              songId={crossfadeSong.id}
              projectId={currentProject.id}
              currentValue={crossfadeSong.crossfadeDuration ?? defaultCrossfade}
              currentCurveType={crossfadeSong.crossfadeCurveType ?? 'linear'}
              trackA={{
                filePath:
                  crossfadeSong.localFilePath ??
                  crossfadeSong.externalFilePath ??
                  '',
                duration: crossfadeSong.duration ?? 0,
                trimEnd: crossfadeSong.trimEnd,
              }}
              nextSong={
                nextSong
                  ? {
                      filePath:
                        nextSong.localFilePath ??
                        nextSong.externalFilePath ??
                        '',
                      trimStart: nextSong.trimStart,
                    }
                  : null
              }
              position={activeCrossfadePopover.position}
              onClose={closeCrossfadePopover}
            />
          )
        })()}

      {/* Cue point popover */}
      {activeCuePointPopover && cuePointSong && currentProject && (
        <CuePointPopover
          songId={cuePointSong.id}
          projectId={currentProject.id}
          existingCuePoints={cuePointSong.cuePoints ?? []}
          cuePoint={activeCuePointPopover.cuePoint}
          timestamp={activeCuePointPopover.timestamp}
          position={activeCuePointPopover.position}
          bpm={cuePointSong.bpm}
          firstBeatOffset={cuePointSong.firstBeatOffset}
          onClose={closeCuePointPopover}
        />
      )}
    </>
  )
}

function WaveformPlaceholder({
  width,
  height,
}: {
  width: number
  height: number
}): JSX.Element {
  return (
    <Box
      w={`${width}px`}
      h={`${height}px`}
      bg="bg.elevated"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border.base"
    >
      <VStack h="100%" justify="center" gap={2}>
        <Spinner size="sm" color="blue.400" />
        <Text fontSize="xs" color="text.muted">
          Extracting waveform...
        </Text>
      </VStack>
    </Box>
  )
}
