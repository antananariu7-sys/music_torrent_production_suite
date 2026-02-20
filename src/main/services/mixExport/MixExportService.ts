import { BrowserWindow } from 'electron'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS } from '@shared/constants'
import type { MixExportRequest, MixExportProgress, LoudnormAnalysis } from '@shared/types/mixExport.types'
import type { Song } from '@shared/types/project.types'
import type { ProjectService } from '../ProjectService'
import type { ChildProcess } from 'child_process'
import { spawnFfmpeg } from '../../utils/ffmpegRunner'
import { validateSongs, resolveSongPath, clampCrossfade } from './MixValidator'
import { analyzeLoudness } from './LoudnormAnalyzer'
import { buildFilterGraph, buildRenderArgs, type TrackInfo } from './FilterGraphBuilder'
import { generateCueSheet, type CueTrackInfo } from './CueSheetGenerator'

interface ActiveJob {
  jobId: string
  process: ChildProcess | null
  cancelled: boolean
  outputPath: string
}

export class MixExportService {
  private activeJob: ActiveJob | null = null

  constructor(private projectService: ProjectService) {}

  async startExport(request: MixExportRequest): Promise<{ jobId: string }> {
    if (this.activeJob) {
      throw new Error('An export is already in progress')
    }

    const jobId = uuidv4()
    const ext = request.format === 'mp3' ? 'mp3' : request.format === 'wav' ? 'wav' : 'flac'
    const outputPath = path.join(request.outputDirectory, `${request.outputFilename}.${ext}`)

    console.log(`[MixExport] Starting export job ${jobId}`)
    console.log(`[MixExport] Format: ${request.format}, Normalization: ${request.normalization}, CUE: ${request.generateCueSheet}`)
    console.log(`[MixExport] Output: ${outputPath}`)

    this.activeJob = { jobId, process: null, cancelled: false, outputPath }

    // Run pipeline async — don't block the IPC response
    this.runPipeline(request, jobId, outputPath).catch((err) => {
      console.error(`[MixExport] Pipeline failed:`, err)
      if (!this.activeJob?.cancelled) {
        this.broadcastProgress({
          phase: 'error',
          currentTrackIndex: 0,
          currentTrackName: '',
          totalTracks: 0,
          percentage: 0,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      this.activeJob = null
    })

    return { jobId }
  }

  cancelExport(): void {
    if (!this.activeJob) return

    console.log(`[MixExport] Cancelling export job ${this.activeJob.jobId}`)
    this.activeJob.cancelled = true
    if (this.activeJob.process) {
      this.activeJob.process.kill('SIGTERM')
    }

    // Clean up partial output
    if (existsSync(this.activeJob.outputPath)) {
      try { unlinkSync(this.activeJob.outputPath) } catch { /* best effort */ }
    }

    this.broadcastProgress({
      phase: 'cancelled',
      currentTrackIndex: 0,
      currentTrackName: '',
      totalTracks: 0,
      percentage: 0,
    })

    this.activeJob = null
  }

  cleanup(): void {
    this.cancelExport()
  }

  // ── Private pipeline ─────────────────────────────────────────────────────

  private async runPipeline(
    request: MixExportRequest,
    jobId: string,
    outputPath: string,
  ): Promise<void> {
    const project = this.projectService.getActiveProject()
    if (!project) throw new Error('No active project')

    const songs = [...project.songs].sort((a, b) => a.order - b.order)
    if (songs.length === 0) throw new Error('No songs in mix')

    console.log(`[MixExport] Project "${project.name}" — ${songs.length} songs`)

    // ── Phase 1: Validate ───────────────────────────────────────────────
    this.broadcastProgress({
      phase: 'validating',
      currentTrackIndex: 0,
      currentTrackName: '',
      totalTracks: songs.length,
      percentage: 0,
    })

    const { valid, missing } = validateSongs(songs)
    console.log(`[MixExport] Validation: ${valid.length} valid, ${missing.length} missing`)
    if (missing.length > 0) {
      console.error(`[MixExport] Missing files:`, missing.map((m) => m.title))
      throw new Error(
        `Missing audio files: ${missing.map((m) => m.title).join(', ')}`
      )
    }
    if (this.activeJob?.cancelled) return

    // Resolve crossfade durations with clamping
    const crossfades = valid.map((song, i) => {
      if (i === valid.length - 1) return 0
      const raw = song.crossfadeDuration ?? request.defaultCrossfadeDuration
      const { value } = clampCrossfade(raw, song.duration, valid[i + 1]?.duration)
      return value
    })

    console.log(`[MixExport] Crossfades: [${crossfades.join(', ')}]`)

    // ── Phase 2: Analyze loudness ───────────────────────────────────────
    console.log(`[MixExport] Analyzing loudness (normalization=${request.normalization})...`)
    const loudnormResults: (LoudnormAnalysis | undefined)[] = []

    for (let i = 0; i < valid.length; i++) {
      if (this.activeJob?.cancelled) return

      this.broadcastProgress({
        phase: 'analyzing',
        currentTrackIndex: i,
        currentTrackName: valid[i].title,
        totalTracks: valid.length,
        percentage: Math.round((i / valid.length) * 20),
      })

      if (request.normalization) {
        const filePath = resolveSongPath(valid[i])!
        console.log(`[MixExport] Analyzing track ${i + 1}/${valid.length}: "${valid[i].title}" — ${filePath}`)
        const analysis = await analyzeLoudness(filePath)
        console.log(`[MixExport] Track ${i + 1} loudness: I=${analysis.input_i}, TP=${analysis.input_tp}, LRA=${analysis.input_lra}`)
        loudnormResults.push(analysis)
      } else {
        loudnormResults.push(undefined)
      }
    }

    if (this.activeJob?.cancelled) return

    // ── Phase 3: Render ─────────────────────────────────────────────────
    this.broadcastProgress({
      phase: 'rendering',
      currentTrackIndex: 0,
      currentTrackName: 'Building mix...',
      totalTracks: valid.length,
      percentage: 20,
    })

    // Build filter graph
    const trackInfos: TrackInfo[] = valid.map((song, i) => ({
      index: i,
      loudnorm: loudnormResults[i],
      crossfadeDuration: crossfades[i],
    }))

    const filterGraph = buildFilterGraph(trackInfos, request.normalization)
    console.log(`[MixExport] Filter graph:\n${filterGraph}`)
    const inputFiles = valid.map((s) => resolveSongPath(s)!)

    const renderArgs = buildRenderArgs(
      inputFiles,
      filterGraph,
      outputPath,
      request.format,
      request.mp3Bitrate,
    )

    // Compute total mix duration for progress
    const totalMixDuration = this.computeTotalDuration(valid, crossfades)
    console.log(`[MixExport] Total mix duration: ${totalMixDuration.toFixed(1)}s — spawning FFmpeg render...`)

    // Spawn FFmpeg render
    const { process, promise } = spawnFfmpeg(renderArgs, (elapsedSeconds) => {
      if (this.activeJob?.cancelled) return
      const renderPercent = totalMixDuration > 0
        ? Math.min(100, 20 + (elapsedSeconds / totalMixDuration) * 80)
        : 20
      this.broadcastProgress({
        phase: 'rendering',
        currentTrackIndex: 0,
        currentTrackName: 'Rendering mix...',
        totalTracks: valid.length,
        percentage: Math.round(renderPercent),
        eta: totalMixDuration > 0
          ? Math.max(0, Math.round(totalMixDuration - elapsedSeconds))
          : undefined,
      })
    })

    this.activeJob!.process = process

    const result = await promise

    if (this.activeJob?.cancelled) return

    if (result.code !== 0) {
      console.error(`[MixExport] FFmpeg exited with code ${result.code}`)
      console.error(`[MixExport] FFmpeg stderr (last 500 chars):\n${result.stderr.slice(-500)}`)
      throw new Error(
        `FFmpeg render failed (code ${result.code}):\n${result.stderr.slice(-500)}`
      )
    }

    console.log(`[MixExport] FFmpeg render complete — output: ${outputPath}`)

    // ── Phase 4: Cue sheet ──────────────────────────────────────────────
    if (request.generateCueSheet) {
      const cueTrackInfos: CueTrackInfo[] = valid.map((song, i) => ({
        title: song.title,
        artist: song.artist,
        duration: song.duration ?? 0,
        crossfadeDuration: crossfades[i],
      }))

      const mixTitle = project.mixMetadata?.title || project.name || 'Mix'
      const cueContent = generateCueSheet(
        cueTrackInfos,
        mixTitle,
        path.basename(outputPath),
      )

      const cuePath = path.join(request.outputDirectory, `${request.outputFilename}.cue`)
      writeFileSync(cuePath, cueContent, 'utf-8')
      console.log(`[MixExport] CUE sheet written: ${cuePath}`)
    }

    // ── Phase 5: Complete ───────────────────────────────────────────────
    console.log(`[MixExport] Export complete! Output: ${outputPath}`)
    this.broadcastProgress({
      phase: 'complete',
      currentTrackIndex: valid.length - 1,
      currentTrackName: valid[valid.length - 1].title,
      totalTracks: valid.length,
      percentage: 100,
      outputPath,
    })

    // Persist last-used export settings (non-fatal)
    try {
      await this.projectService.updateMixMetadata(request.projectId, {
        exportConfig: {
          defaultCrossfadeDuration: request.defaultCrossfadeDuration,
          normalization: request.normalization,
          outputFormat: request.format,
          mp3Bitrate: request.mp3Bitrate ?? 320,
          generateCueSheet: request.generateCueSheet,
        },
      })
    } catch (err) {
      console.warn('[MixExport] Failed to persist export config:', err)
    }

    this.activeJob = null
  }

  private computeTotalDuration(songs: Song[], crossfades: number[]): number {
    let total = 0
    for (let i = 0; i < songs.length; i++) {
      total += songs[i].duration ?? 0
      if (i < crossfades.length) {
        total -= crossfades[i]
      }
    }
    return Math.max(0, total)
  }

  private broadcastProgress(progress: MixExportProgress): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.MIX_EXPORT_PROGRESS, progress)
      }
    }
  }
}
