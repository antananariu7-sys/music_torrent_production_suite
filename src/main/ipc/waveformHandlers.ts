import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants'
import {
  WaveformGenerateRequestSchema,
  WaveformBatchRequestSchema,
} from '@shared/schemas/waveform.schema'
import type { WaveformExtractor } from '../services/waveform/WaveformExtractor'

export function registerWaveformHandlers(
  waveformExtractor: WaveformExtractor
): void {
  ipcMain.handle(IPC_CHANNELS.WAVEFORM_GENERATE, async (_event, request: unknown) => {
    try {
      const { songId, filePath } = WaveformGenerateRequestSchema.parse(request)
      const data = await waveformExtractor.generate(songId, filePath)
      return { success: true, data }
    } catch (error) {
      console.error('[waveformHandlers] Failed to generate waveform:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate waveform',
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.WAVEFORM_GENERATE_BATCH, async (_event, request: unknown) => {
    try {
      const { projectId } = WaveformBatchRequestSchema.parse(request)
      const data = await waveformExtractor.generateBatch(projectId)
      return { success: true, data }
    } catch (error) {
      console.error('[waveformHandlers] Failed to generate batch waveforms:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate batch waveforms',
      }
    }
  })
}
