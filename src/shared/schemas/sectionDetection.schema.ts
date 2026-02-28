import { z } from 'zod'

/**
 * Detect sections for a single song within a project
 */
export const SectionDetectRequestSchema = z.object({
  projectId: z.string().uuid(),
  songId: z.string().min(1),
})

/**
 * Batch section detection request (all songs in a project)
 */
export const SectionBatchRequestSchema = z.object({
  projectId: z.string().uuid(),
})
