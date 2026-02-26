import { useEffect, useMemo } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import type { Song } from '@shared/types/project.types'
import type { WaveformData } from '@shared/types/waveform.types'

interface TrackWaveformState {
  peaks: WaveformData | null
  song: Song
  isLoading: boolean
}

interface TransitionData {
  outgoing: TrackWaveformState | null
  incoming: TrackWaveformState | null
}

/**
 * Hook that loads waveform peaks for both tracks in the selected pair.
 * Reuses the timeline store's waveformCache — triggers generation via IPC if not cached.
 */
export function useTransitionData(
  outgoingTrack: Song | null,
  incomingTrack: Song | null
): TransitionData {
  const waveformCache = useTimelineStore((s) => s.waveformCache)

  // Determine which tracks need waveform generation
  const tracksToLoad = useMemo(() => {
    const tracks: Array<{ songId: string; filePath: string }> = []
    for (const song of [outgoingTrack, incomingTrack]) {
      if (!song) continue
      const filePath = song.localFilePath ?? song.externalFilePath
      if (!filePath) continue
      if (!waveformCache[song.id]) {
        tracks.push({ songId: song.id, filePath })
      }
    }
    return tracks
  }, [outgoingTrack, incomingTrack, waveformCache])

  // Trigger waveform generation for uncached tracks
  useEffect(() => {
    for (const track of tracksToLoad) {
      window.api.waveform.generate(track).then((response) => {
        if (response.success && response.data) {
          useTimelineStore.getState().setWaveform(track.songId, response.data)
        }
      })
    }
  }, [tracksToLoad])

  function makeTrackState(song: Song | null): TrackWaveformState | null {
    if (!song) return null
    const cached = waveformCache[song.id] ?? null
    const filePath = song.localFilePath ?? song.externalFilePath
    return {
      peaks: cached,
      song,
      isLoading: !cached && !!filePath,
    }
  }

  return {
    outgoing: makeTrackState(outgoingTrack),
    incoming: makeTrackState(incomingTrack),
  }
}
