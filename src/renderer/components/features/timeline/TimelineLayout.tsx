import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Box, Text, VStack, Spinner } from '@chakra-ui/react'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useAudioPlayerStore, type Track } from '@/store/audioPlayerStore'
import { WaveformCanvas } from './WaveformCanvas'
import { TrackInfoOverlay } from './TrackInfoOverlay'
import { TimeRuler } from './TimeRuler'
import { CuePointMarker } from './CuePointMarker'
import { TrimOverlay } from './TrimOverlay'
import { CrossfadeCurveCanvas } from './CrossfadeCurveCanvas'
import { BeatGrid } from './BeatGrid'
import { Playhead } from './Playhead'
import { CrossfadePopover } from './CrossfadePopover'
import { CuePointPopover } from './CuePointPopover'
import { VirtualTrack } from './VirtualTrack'
import { RegionSelection } from './RegionSelection'
import { snapToNearestBeat } from './utils/snapToBeat'
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
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)

  const zoomLevel = useTimelineStore((s) => s.zoomLevel)
  const scrollPosition = useTimelineStore((s) => s.scrollPosition)
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId)
  const setSelectedTrack = useTimelineStore((s) => s.setSelectedTrack)
  const setScrollPosition = useTimelineStore((s) => s.setScrollPosition)
  const setViewportWidth = useTimelineStore((s) => s.setViewportWidth)
  const setZoomLevel = useTimelineStore((s) => s.setZoomLevel)

  const snapMode = useTimelineStore((s) => s.snapMode)
  const frequencyColorMode = useTimelineStore((s) => s.frequencyColorMode)
  const showBeatGrid = useTimelineStore((s) => s.showBeatGrid)

  const activeCrossfadePopover = useTimelineStore(
    (s) => s.activeCrossfadePopover
  )
  const activeCuePointPopover = useTimelineStore((s) => s.activeCuePointPopover)
  const openCrossfadePopover = useTimelineStore((s) => s.openCrossfadePopover)
  const closeCrossfadePopover = useTimelineStore((s) => s.closeCrossfadePopover)
  const openCuePointPopover = useTimelineStore((s) => s.openCuePointPopover)
  const closeCuePointPopover = useTimelineStore((s) => s.closeCuePointPopover)
  const activeSelection = useTimelineStore((s) => s.activeSelection)
  const setActiveSelection = useTimelineStore((s) => s.setActiveSelection)
  const clearActiveSelection = useTimelineStore((s) => s.clearActiveSelection)

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

  // Keep ref in sync for the wheel handler (avoids effect re-runs on every zoom tick)
  zoomRef.current.zoomLevel = zoomLevel
  zoomRef.current.totalWidth = totalWidth

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

  // Sync DOM scroll → store (also detect manual scroll during playback)
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el || isScrollSyncing.current) return
    setScrollPosition(el.scrollLeft)
    // If user manually scrolls during playback, disable auto-scroll
    if (useAudioPlayerStore.getState().isPlaying) {
      userScrolledRef.current = true
    }
  }, [setScrollPosition])

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    const unsub = useAudioPlayerStore.subscribe((state, prev) => {
      if (!state.isPlaying || !state.currentTrack) return
      // Reset user-scrolled flag when a new track starts playing
      if (state.currentTrack !== prev.currentTrack) {
        userScrolledRef.current = false
      }
      if (userScrolledRef.current) return

      const el = containerRef.current
      if (!el) return

      // Compute playhead pixel position
      const trackIndex = songs.findIndex(
        (s) =>
          (s.localFilePath ?? s.externalFilePath) ===
          state.currentTrack!.filePath
      )
      if (trackIndex === -1) return

      const pos = positions[trackIndex]
      const song = songs[trackIndex]
      const playheadX =
        pos.left + (state.currentTime - (song.trimStart ?? 0)) * pixelsPerSecond

      const viewportLeft = el.scrollLeft
      const viewportRight = el.scrollLeft + el.clientWidth

      // Scroll when playhead exits the visible viewport (with some margin)
      const margin = el.clientWidth * 0.15
      if (
        playheadX < viewportLeft + margin ||
        playheadX > viewportRight - margin
      ) {
        isScrollSyncing.current = true
        const newScroll = Math.max(0, playheadX - el.clientWidth * 0.3)
        el.scrollLeft = newScroll
        setScrollPosition(newScroll)
        requestAnimationFrame(() => {
          isScrollSyncing.current = false
        })
      }
    })
    return unsub
  }, [songs, positions, pixelsPerSecond, setScrollPosition])

  // Ctrl+scroll zoom with stable cursor point
  // Attached once via useEffect with { passive: false } so preventDefault() works.
  // Reads zoomLevel/totalWidth from ref to avoid re-attaching on every zoom tick.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()

      const { zoomLevel: currentZoom, totalWidth: currentTotalWidth } =
        zoomRef.current

      const rect = el.getBoundingClientRect()
      const cursorXInViewport = e.clientX - rect.left
      const cursorXInTimeline = cursorXInViewport + el.scrollLeft

      const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom * zoomFactor)
      )

      const cursorFraction =
        currentTotalWidth > 0 ? cursorXInTimeline / currentTotalWidth : 0
      const newTotalWidth = currentTotalWidth * (newZoom / currentZoom)
      const newScrollLeft = cursorFraction * newTotalWidth - cursorXInViewport

      setZoomLevel(newZoom)

      requestAnimationFrame(() => {
        isScrollSyncing.current = true
        el.scrollLeft = Math.max(0, newScrollLeft)
        setScrollPosition(Math.max(0, newScrollLeft))
        requestAnimationFrame(() => {
          isScrollSyncing.current = false
        })
      })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [setZoomLevel, setScrollPosition])

  // Click on cue point marker → open cue point popover for existing cue point
  const handleCuePointClick = useCallback(
    (
      songId: string,
      posLeft: number,
      cpX: number,
      cuePoint: import('@shared/types/waveform.types').CuePoint
    ) => {
      openCuePointPopover(
        songId,
        cuePoint.timestamp,
        { x: posLeft + cpX, y: 0 },
        cuePoint
      )
    },
    [openCuePointPopover]
  )

  // Double-click on track waveform → open cue point popover
  const handleTrackDoubleClick = useCallback(
    (e: React.MouseEvent, song: Song, trackLeft: number) => {
      e.stopPropagation()
      const clickX =
        e.clientX -
        containerRef.current!.getBoundingClientRect().left +
        containerRef.current!.scrollLeft -
        trackLeft
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

  // Convert Song to AudioPlayer Track
  const songToTrack = useCallback(
    (song: Song): Track => ({
      filePath: song.localFilePath ?? song.externalFilePath ?? '',
      name: song.title,
      duration: song.duration,
      trimStart: song.trimStart,
      trimEnd: song.trimEnd,
    }),
    []
  )

  // Single-click on track waveform → start playback at clicked position
  const handleTrackClick = useCallback(
    (
      e: React.MouseEvent,
      song: Song,
      trackLeft: number,
      clickedIndex: number
    ) => {
      // Skip play if this click followed a region selection drag
      if (didRegionSelectRef.current) {
        didRegionSelectRef.current = false
        return
      }

      // Clear any existing selection on plain click
      clearActiveSelection()
      setSelectedTrack(song.id)

      const clickX =
        e.clientX -
        containerRef.current!.getBoundingClientRect().left +
        containerRef.current!.scrollLeft -
        trackLeft
      const seekTime = clickX / pixelsPerSecond + (song.trimStart ?? 0)

      const tracks = songs.map(songToTrack)
      useAudioPlayerStore
        .getState()
        .playPlaylist(tracks, clickedIndex, seekTime)
    },
    [
      pixelsPerSecond,
      songs,
      songToTrack,
      setSelectedTrack,
      clearActiveSelection,
    ]
  )

  // --- Trim drag preview state ---
  const [previewTrims, setPreviewTrims] = useState<
    Record<string, { trimStart?: number; trimEnd?: number }>
  >({})
  const previewTrimsRef = useRef(previewTrims)
  previewTrimsRef.current = previewTrims

  const trimPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (trimPersistRef.current) clearTimeout(trimPersistRef.current)
    }
  }, [])

  const handleTrimStartDrag = useCallback(
    (songId: string, newTimestamp: number) => {
      setPreviewTrims((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], trimStart: newTimestamp },
      }))
    },
    []
  )

  const handleTrimEndDrag = useCallback(
    (songId: string, newTimestamp: number) => {
      setPreviewTrims((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], trimEnd: newTimestamp },
      }))
    },
    []
  )

  const handleTrimDragEnd = useCallback(
    (songId: string) => {
      const preview = previewTrimsRef.current[songId]
      if (!preview || !currentProject) return

      // Clear preview state
      setPreviewTrims((prev) => {
        const next = { ...prev }
        delete next[songId]
        return next
      })

      // Debounced persistence
      if (trimPersistRef.current) clearTimeout(trimPersistRef.current)
      const updates: Partial<{ trimStart: number; trimEnd: number }> = {}
      if (preview.trimStart !== undefined) updates.trimStart = preview.trimStart
      if (preview.trimEnd !== undefined) updates.trimEnd = preview.trimEnd

      trimPersistRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId: currentProject.id,
          songId,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, 300)
    },
    [currentProject, setCurrentProject]
  )

  // --- Cue point drag preview state ---
  // Maps songId → cuePointId → preview timestamp
  const [previewCuePoints, setPreviewCuePoints] = useState<
    Record<string, Record<string, number>>
  >({})

  const cuePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (cuePersistRef.current) clearTimeout(cuePersistRef.current)
    }
  }, [])

  const handleCuePointDrag = useCallback(
    (
      songId: string,
      cuePoint: import('@shared/types/waveform.types').CuePoint,
      newTimestamp: number
    ) => {
      setPreviewCuePoints((prev) => ({
        ...prev,
        [songId]: { ...prev[songId], [cuePoint.id]: newTimestamp },
      }))

      // If trim-type, also update trim preview
      if (cuePoint.type === 'trim-start') {
        handleTrimStartDrag(songId, newTimestamp)
      } else if (cuePoint.type === 'trim-end') {
        handleTrimEndDrag(songId, newTimestamp)
      }
    },
    [handleTrimStartDrag, handleTrimEndDrag]
  )

  const handleCuePointDragEnd = useCallback(
    (
      songId: string,
      cuePoint: import('@shared/types/waveform.types').CuePoint,
      newTimestamp: number
    ) => {
      // Clear cue point preview
      setPreviewCuePoints((prev) => {
        const next = { ...prev }
        if (next[songId]) {
          const songCues = { ...next[songId] }
          delete songCues[cuePoint.id]
          if (Object.keys(songCues).length === 0) {
            delete next[songId]
          } else {
            next[songId] = songCues
          }
        }
        return next
      })

      // Clear trim preview if trim-type
      if (cuePoint.type === 'trim-start' || cuePoint.type === 'trim-end') {
        setPreviewTrims((prev) => {
          const next = { ...prev }
          delete next[songId]
          return next
        })
      }

      if (!currentProject) return

      // Build updated cue points + trim fields
      const song = songs.find((s) => s.id === songId)
      if (!song) return

      const updatedCuePoints = (song.cuePoints ?? []).map((cp) =>
        cp.id === cuePoint.id ? { ...cp, timestamp: newTimestamp } : cp
      )

      const updates: Partial<Song> = { cuePoints: updatedCuePoints }
      // Sync trim fields for trim-type cue points
      if (cuePoint.type === 'trim-start') {
        updates.trimStart = newTimestamp
      } else if (cuePoint.type === 'trim-end') {
        updates.trimEnd = newTimestamp
      }

      if (cuePersistRef.current) clearTimeout(cuePersistRef.current)
      cuePersistRef.current = setTimeout(async () => {
        const response = await window.api.mix.updateSong({
          projectId: currentProject.id,
          songId,
          updates,
        })
        if (response.success && response.data) {
          setCurrentProject(response.data)
        }
      }, 300)
    },
    [currentProject, setCurrentProject, songs]
  )

  // --- Region selection drag state ---
  const regionDragRef = useRef<{
    songId: string
    startX: number
    startTime: number
    trimStart: number
    trimEnd: number
    isDragging: boolean
  } | null>(null)
  const didRegionSelectRef = useRef(false)
  const [pendingSelection, setPendingSelection] = useState<{
    songId: string
    startTime: number
    endTime: number
  } | null>(null)

  const handleRegionPointerDown = useCallback(
    (e: React.PointerEvent, song: Song, trackLeft: number) => {
      // Only left button
      if (e.button !== 0) return
      // Don't start region select if event originated from an interactive child
      const target = e.target as HTMLElement
      if (
        target.closest('[data-drag-handle]') ||
        target.closest('[data-cue-marker]')
      )
        return

      const el = containerRef.current
      if (!el) return

      const startX = e.clientX
      const clickXInTrack =
        e.clientX - el.getBoundingClientRect().left + el.scrollLeft - trackLeft
      const trimStart = song.trimStart ?? 0
      const trimEnd = song.trimEnd ?? song.duration ?? 0
      const startTime = Math.max(
        trimStart,
        Math.min(trimEnd, clickXInTrack / pixelsPerSecond + trimStart)
      )

      regionDragRef.current = {
        songId: song.id,
        startX,
        startTime,
        trimStart,
        trimEnd,
        isDragging: false,
      }

      const div = e.currentTarget as HTMLElement
      div.setPointerCapture(e.pointerId)
      const prevUserSelect = document.body.style.userSelect
      document.body.style.userSelect = 'none'

      const handleMove = (ev: PointerEvent): void => {
        const state = regionDragRef.current
        if (!state) return
        const deltaX = ev.clientX - state.startX
        if (!state.isDragging && Math.abs(deltaX) < 5) return
        state.isDragging = true

        let endTime = state.startTime + deltaX / pixelsPerSecond
        endTime = Math.max(state.trimStart, Math.min(state.trimEnd, endTime))

        // Snap if active
        const canSnap =
          snapMode === 'beat' &&
          song.bpm != null &&
          song.bpm > 0 &&
          song.firstBeatOffset != null
        if (canSnap) {
          endTime = snapToNearestBeat(endTime, song.bpm!, song.firstBeatOffset!)
          endTime = Math.max(state.trimStart, Math.min(state.trimEnd, endTime))
        }

        const [s, en] =
          state.startTime < endTime
            ? [state.startTime, endTime]
            : [endTime, state.startTime]

        setPendingSelection({ songId: state.songId, startTime: s, endTime: en })
      }

      const handleUp = (ev: PointerEvent): void => {
        const state = regionDragRef.current
        div.releasePointerCapture(ev.pointerId)
        div.removeEventListener('pointermove', handleMove)
        div.removeEventListener('pointerup', handleUp)
        document.body.style.userSelect = prevUserSelect

        if (state?.isDragging) {
          let endTime =
            state.startTime + (ev.clientX - state.startX) / pixelsPerSecond
          endTime = Math.max(state.trimStart, Math.min(state.trimEnd, endTime))

          const canSnap =
            snapMode === 'beat' &&
            song.bpm != null &&
            song.bpm > 0 &&
            song.firstBeatOffset != null
          if (canSnap) {
            endTime = snapToNearestBeat(
              endTime,
              song.bpm!,
              song.firstBeatOffset!
            )
            endTime = Math.max(
              state.trimStart,
              Math.min(state.trimEnd, endTime)
            )
          }

          const [s, en] =
            state.startTime < endTime
              ? [state.startTime, endTime]
              : [endTime, state.startTime]

          // Enforce minimum 0.5s selection
          if (en - s >= 0.5) {
            setActiveSelection({
              songId: state.songId,
              startTime: s,
              endTime: en,
            })
            didRegionSelectRef.current = true
          }
        }

        setPendingSelection(null)
        regionDragRef.current = null
      }

      div.addEventListener('pointermove', handleMove)
      div.addEventListener('pointerup', handleUp)
    },
    [pixelsPerSecond, snapMode, setActiveSelection]
  )

  const handleTrimToSelection = useCallback(
    (songId: string, startTime: number, endTime: number) => {
      handleTrimStartDrag(songId, startTime)
      handleTrimEndDrag(songId, endTime)
      handleTrimDragEnd(songId)
      clearActiveSelection()
    },
    [
      handleTrimStartDrag,
      handleTrimEndDrag,
      handleTrimDragEnd,
      clearActiveSelection,
    ]
  )

  const handlePlaySelection = useCallback(
    (_song: Song, startTime: number, endTime: number, clickedIndex: number) => {
      const tracks = songs.map(songToTrack)
      const store = useAudioPlayerStore.getState()
      store.playPlaylist(tracks, clickedIndex, startTime)
      // Set loop region after playPlaylist (which clears it) so it sticks
      store.setLoopRegion({ startTime, endTime })
    },
    [songs, songToTrack]
  )

  // --- Selection edge drag ---
  const selEdgeRef = useRef<{
    side: 'start' | 'end'
    initialStart: number
    initialEnd: number
    trimStart: number
    trimEnd: number
    songBpm?: number
    songFirstBeatOffset?: number
  } | null>(null)

  const handleSelectionEdgeDragStart = useCallback(
    (song: Song, side: 'start' | 'end') => {
      const sel = useTimelineStore.getState().activeSelection
      if (!sel) return
      selEdgeRef.current = {
        side,
        initialStart: sel.startTime,
        initialEnd: sel.endTime,
        trimStart: song.trimStart ?? 0,
        trimEnd: song.trimEnd ?? song.duration ?? 0,
        songBpm: song.bpm,
        songFirstBeatOffset: song.firstBeatOffset,
      }
    },
    []
  )

  const handleSelectionEdgeDrag = useCallback(
    (songId: string, side: 'start' | 'end', deltaSeconds: number) => {
      const ref = selEdgeRef.current
      if (!ref) return

      const canSnap =
        snapMode === 'beat' &&
        ref.songBpm != null &&
        ref.songBpm > 0 &&
        ref.songFirstBeatOffset != null

      if (side === 'start') {
        let newStart = ref.initialStart + deltaSeconds
        newStart = Math.max(
          ref.trimStart,
          Math.min(ref.initialEnd - 0.5, newStart)
        )
        if (canSnap) {
          newStart = snapToNearestBeat(
            newStart,
            ref.songBpm!,
            ref.songFirstBeatOffset!
          )
          newStart = Math.max(
            ref.trimStart,
            Math.min(ref.initialEnd - 0.5, newStart)
          )
        }
        setActiveSelection({
          songId,
          startTime: newStart,
          endTime: ref.initialEnd,
        })
      } else {
        let newEnd = ref.initialEnd + deltaSeconds
        newEnd = Math.min(ref.trimEnd, Math.max(ref.initialStart + 0.5, newEnd))
        if (canSnap) {
          newEnd = snapToNearestBeat(
            newEnd,
            ref.songBpm!,
            ref.songFirstBeatOffset!
          )
          newEnd = Math.min(
            ref.trimEnd,
            Math.max(ref.initialStart + 0.5, newEnd)
          )
        }
        setActiveSelection({
          songId,
          startTime: ref.initialStart,
          endTime: newEnd,
        })
      }
    },
    [snapMode, setActiveSelection]
  )

  const handleSelectionEdgeDragEnd = useCallback(() => {
    selEdgeRef.current = null
  }, [])

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
            const waveform = waveforms[song.id]
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
          {songs.length > 1 &&
            songs.map((song, index) => {
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
                  top={0}
                  w={`${overlapWidth}px`}
                  h={`${TRACK_HEIGHT}px`}
                  cursor="pointer"
                  onClick={(e) => handleCrossfadeClick(e, song.id)}
                  title="Click to edit crossfade"
                >
                  <CrossfadeCurveCanvas
                    width={overlapWidth}
                    height={TRACK_HEIGHT}
                    curveType={song.crossfadeCurveType ?? 'linear'}
                    colorA={TRACK_COLORS[index % TRACK_COLORS.length]}
                    colorB={TRACK_COLORS[(index + 1) % TRACK_COLORS.length]}
                  />
                </Box>
              )
            })}

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
