import { useCallback, type RefObject, type MutableRefObject } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { useAudioPlayerStore, type Track } from '@/store/audioPlayerStore'
import type { Song } from '@shared/types/project.types'
import type { CuePoint } from '@shared/types/waveform.types'

interface UseTimelineHandlersOptions {
  containerRef: RefObject<HTMLDivElement | null>
  pixelsPerSecond: number
  songs: Song[]
  didRegionSelectRef: MutableRefObject<boolean>
  handleTrimStartDrag: (songId: string, newTimestamp: number) => void
  handleTrimEndDrag: (songId: string, newTimestamp: number) => void
  handleTrimDragEnd: (songId: string) => void
}

export function useTimelineHandlers({
  containerRef,
  pixelsPerSecond,
  songs,
  didRegionSelectRef,
  handleTrimStartDrag,
  handleTrimEndDrag,
  handleTrimDragEnd,
}: UseTimelineHandlersOptions) {
  const setSelectedTrack = useTimelineStore((s) => s.setSelectedTrack)
  const openCrossfadePopover = useTimelineStore((s) => s.openCrossfadePopover)
  const openCuePointPopover = useTimelineStore((s) => s.openCuePointPopover)
  const clearActiveSelection = useTimelineStore((s) => s.clearActiveSelection)

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

  const handleCuePointClick = useCallback(
    (songId: string, posLeft: number, cpX: number, cuePoint: CuePoint) => {
      openCuePointPopover(
        songId,
        cuePoint.timestamp,
        { x: posLeft + cpX, y: 0 },
        cuePoint
      )
    },
    [openCuePointPopover]
  )

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

  const handleCrossfadeClick = useCallback(
    (e: React.MouseEvent, songId: string) => {
      e.stopPropagation()
      openCrossfadePopover(songId, { x: e.clientX, y: e.clientY })
    },
    [openCrossfadePopover]
  )

  const handleTrackClick = useCallback(
    (
      e: React.MouseEvent,
      song: Song,
      trackLeft: number,
      clickedIndex: number
    ) => {
      if (didRegionSelectRef.current) {
        didRegionSelectRef.current = false
        return
      }

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
      store.setLoopRegion({ startTime, endTime })
    },
    [songs, songToTrack]
  )

  return {
    handleCuePointClick,
    handleTrackDoubleClick,
    handleCrossfadeClick,
    handleTrackClick,
    handleTrimToSelection,
    handlePlaySelection,
    clearActiveSelection,
  }
}
