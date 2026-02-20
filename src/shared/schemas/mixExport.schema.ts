import { z } from 'zod'

/**
 * Zod schema for MixExportRequest — validated on the IPC boundary.
 */
export const MixExportRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  outputDirectory: z.string().min(1, 'Output directory is required'),
  outputFilename: z.string().min(1, 'Output filename is required'),
  format: z.enum(['wav', 'flac', 'mp3']),
  mp3Bitrate: z
    .union([z.literal(128), z.literal(192), z.literal(256), z.literal(320)])
    .optional(),
  normalization: z.boolean(),
  generateCueSheet: z.boolean(),
  defaultCrossfadeDuration: z.number().min(0).max(30),
})
