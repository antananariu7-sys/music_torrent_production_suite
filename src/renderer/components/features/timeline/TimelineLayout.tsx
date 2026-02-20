import { useRef, useEffect, useCallback } from 'react'
import { Box, Text, VStack } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/useProjectStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrackInfoOverlay } from './TrackInfoOverlay'
import { TimeRuler } from './TimeRuler'
import { CuePointMarker } from './CuePointMarker'
import { TrimOverlay } from './TrimOverlay'
import { BeatGrid } from './BeatGrid'
import { CrossfadePopover } from './CrossfadePopover'
import { CuePointPopover } from './CuePointPopover'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

interface TimelineLayoutProps {
  songs: Song[]
  waveforms: Record<string, WaveformData>
  defaultCrossfade?: number
}

/** Base pixels per second at zoom 1x */
export const PX_PER_SEC = 10

/** Track height in pixels */
const TRACK_HEIGHT = 120

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
    const effectiveDuration = (song.trimEnd ?? song.duration ?? 0) - (song.trimStart ?? 0)
    const width = effectiveDuration * pixelsPerSecond
    const position: TrackPosition = { songId: song.id, left: currentOffset, width }
    const crossfade = i < songs.length - 1
      ? (song.crossfadeDuration ?? defaultCrossfade)
      : 0
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

  const currentProject = useProjectStore((s) => s.currentProject)

  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const scrollPosition = useTimelineStore((s) => s.scrollPosition)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const setSelectedTrack = useTimelineStore((s) => s.setSelectedTrack)
  const setScrollPosition = useTimelineStore((s) => s.setScrollPosition)
  const setViewportWidth = useTimelineStore((s) => s.setViewportWidth)
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)

  const activeCrossfadePopover = useTimelineStore((s) => s.activeCrossfadePopover)
  const activeCuePointPopover = useTimelineStore((s) => s.activeCuePointPopover)
  const openCrossfadePopover = useTimelineStore((s) => s.openCrossfadePopover)
  const closeCrossfadePopover = useTimelineStore((s) => s.closeCrossfadePopover)
  const openCuePointPopover = useTimelineStore((s) => s.openCuePointPopover)
  const closeCuePointPopover = useTimelineStore((s) => s.closeCuePointPopover)

  const pixelsPerSecond = PX_PER_SEC * zoomLevel
  const positions = computeTrackPositions(songs, pixelsPerSecond, defaultCrossfade)
  const totalWidth = positions.length > 0
    ? Math.max(...positions.map((p) => p.left + p.width))
    : 0

  // Measure container width and track viewport size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setViewportWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [setViewportWidth])

  // Sync store scroll position → DOM scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (Math.abs(el.scrollLeft - scrollPosition) > 1) {
      isScrollSyncing.current = true
      el.scrollLeft = scrollPosition
      requestAnimationFrame(() => {
        isScrollSyncing.current = false
      })
    }
  }, [scrollPosition])

  // Sync DOM scroll → store
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || isScrollSyncing.current) return
    setScrollPosition(el.scrollLeft)
  }, [setScrollPosition])

  // Ctrl+scroll zoom with stable cursor point
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()

      const el = containerRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const cursorXInViewport = e.clientX - rect.left
      const cursorXInTimeline = cursorXInViewport + el.scrollLeft

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newZoom = Math.max(1, Math.min(50, zoomLevel * zoomFactor))

      const cursorFraction = totalWidth > 0 ? cursorXInTimeline / totalWidth : 0
      const newTotalWidth = totalWidth * (newZoom / zoomLevel)
      const newScrollLeft = cursorFraction * newTotalWidth - cursorXInViewport

      setZoomLevel(newZoom)

      requestAnimationFrame(() => {
        if (el) {
          isScrollSyncing.current = true
          el.scrollLeft = Math.max(0, newScrollLeft)
          setScrollPosition(Math.max(0, newScrollLeft))
          requestAnimationFrame(() => {
            isScrollSyncing.current = false
          })
        }
      })
    },
    [zoomLevel, totalWidth, setZoomLevel, setScrollPosition]
  )

  // Double-click on track waveform → open cue point popover
  const handleTrackDoubleClick = useCallback(
    (e: React.MouseEvent, song: Song, trackLeft: number) => {
      e.stopPropagation()
      const clickX = e.clientX - containerRef.current!.getBoundingClientRect().left + containerRef.current!.scrollLeft - trackLeft
      const timestamp = clickX / pixelsPerSecond + (song.trimStart ?? 0)
      openCuePointPopover(song.id, timestamp, { x: e.clientX, y: e.clientY })
    },
    [pixelsPerSecond, openCuePointPopover]
  )

  // Click on crossfade zone → open crossfade popover
  const handleCrossfadeClick = useCallback(
    (e: React.MouseEvent, songId: string) => {
      e.stopPropagation()
      openCrossfadePopover(songId, { x: e.clientX, y: e.clientY })
    },
    [openCrossfadePopover]
  )

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
        overflowX="auto"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.base"
        borderRadius="md"
        p={3}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        {/* Time ruler */}
        <TimeRuler totalWidth={totalWidth} pixelsPerSecond={pixelsPerSecond} />

        {/* Track area */}
        <Box position="relative" h={`${TRACK_HEIGHT + 30}px`} minW={`${totalWidth}px`}>
          {songs.map((song, index) => {
            const pos = positions[index]
            const waveform = waveforms[song.id]
            const color = TRACK_COLORS[index % TRACK_COLORS.length]
            const isSelected = selectedTrackId === song.id
            const cuePoints = song.cuePoints ?? []

            return (
              <Box
                key={song.id}
                position="absolute"
                left={`${pos.left}px`}
                top={0}
                w={`${pos.width}px`}
                onClick={() => setSelectedTrack(song.id)}
                onDoubleClick={(e) => handleTrackDoubleClick(e, song, pos.left)}
              >
                {/* Track label */}
                <Text
                  fontSize="2xs"
                  color="text.muted"
                  mb={0.5}
                  isTruncated
                  maxW={`${pos.width}px`}
                  title={song.title}
                >
                  {song.title}
                </Text>

                {/* Waveform or placeholder */}
                <Box position="relative">
                  <TrackInfoOverlay song={song} />

                  {waveform ? (
                    <WaveformCanvas
                      peaks={waveform.peaks}
                      width={pos.width}
                      height={TRACK_HEIGHT}
                      color={color}
                      isSelected={isSelected}
                    />
                  ) : (
                    <WaveformPlaceholder width={pos.width} height={TRACK_HEIGHT} />
                  )}

                  {/* Beat grid overlay */}
                  {song.bpm != null && song.bpm > 0 && (
                    <BeatGrid
                      bpm={song.bpm}
                      firstBeatOffset={song.firstBeatOffset ?? 0}
                      trackWidth={pos.width}
                      trackHeight={TRACK_HEIGHT}
                      pixelsPerSecond={pixelsPerSecond}
                      trimStart={song.trimStart ?? 0}
                    />
                  )}

                  {/* Trim overlay */}
                  {(song.trimStart != null || song.trimEnd != null) && (
                    <TrimOverlay
                      trimStart={song.trimStart}
                      trimEnd={song.trimEnd}
                      trackWidth={pos.width}
                      trackHeight={TRACK_HEIGHT}
                      pixelsPerSecond={pixelsPerSecond}
                      songDuration={song.duration ?? 0}
                    />
                  )}

                  {/* Cue point markers */}
                  {cuePoints.map((cp) => {
                    const cpX = (cp.timestamp - (song.trimStart ?? 0)) * pixelsPerSecond
                    if (cpX < 0 || cpX > pos.width) return null
                    return (
                      <CuePointMarker
                        key={cp.id}
                        cuePoint={cp}
                        x={cpX}
                        trackHeight={TRACK_HEIGHT}
                        onClick={(clickedCp) => {
                          openCuePointPopover(
                            song.id,
                            clickedCp.timestamp,
                            { x: pos.left + cpX, y: 0 },
                            clickedCp
                          )
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            )
          })}

          {/* Crossfade overlap zones */}
          {songs.length > 1 && songs.map((song, index) => {
            if (index >= songs.length - 1) return null
            const thisPos = positions[index]
            const nextPos = positions[index + 1]
            const overlapStart = nextPos.left
            const overlapEnd = thisPos.left + thisPos.width
            const overlapWidth = overlapEnd - overlapStart
            if (overlapWidth <= 0) return null

            return (
              <Box
                key={`xfade-${song.id}`}
                position="absolute"
                left={`${overlapStart}px`}
                top="14px"
                w={`${overlapWidth}px`}
                h={`${TRACK_HEIGHT}px`}
                bg="whiteAlpha.100"
                borderRadius="sm"
                cursor="pointer"
                onClick={(e) => handleCrossfadeClick(e, song.id)}
                title="Click to edit crossfade"
              />
            )
          })}
        </Box>
      </Box>

      {/* Crossfade popover */}
      {activeCrossfadePopover && crossfadeSong && currentProject && (
        <CrossfadePopover
          songId={crossfadeSong.id}
          projectId={currentProject.id}
          currentValue={crossfadeSong.crossfadeDuration ?? defaultCrossfade}
          position={activeCrossfadePopover.position}
          onClose={closeCrossfadePopover}
        />
      )}

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

function WaveformPlaceholder({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Box
      w={`${width}px`}
      h={`${height}px`}
      bg="bg.elevated"
      borderRadius="sm"
      borderWidth="1px"
      borderColor="border.base"
    >
      <VStack h="100%" justify="center">
        <Text fontSize="xs" color="text.muted">Loading...</Text>
      </VStack>
    </Box>
  )
}
