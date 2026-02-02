import { z } from 'zod'

/**
 * Audio metadata schema
 */
export const AudioMetadataSchema = z.object({
  duration: z.number().positive().optional(),
  format: z.string().optional(),
  bitrate: z.number().positive().optional(),
  sampleRate: z.number().positive().optional(),
  fileSize: z.number().nonnegative().optional(),
  artist: z.string().optional(),
  title: z.string().optional(),
  album: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  genre: z.string().optional(),
  trackNumber: z.number().int().positive().optional(),
  channels: z.number().int().positive().optional(),
  codec: z.string().optional(),
})

/**
 * Song schema
 */
export const SongSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Song title is required'),
  artist: z.string().optional(),
  album: z.string().optional(),
  duration: z.number().positive().optional(),
  format: z.string().optional(),
  bitrate: z.number().positive().optional(),
  sampleRate: z.number().positive().optional(),
  fileSize: z.number().nonnegative().optional(),
  downloadId: z.string().uuid().optional(),
  externalFilePath: z.string().optional(),
  localFilePath: z.string().optional(),
  addedAt: z.date(),
  order: z.number().int().nonnegative(),
  metadata: AudioMetadataSchema.optional(),
})

/**
 * Mix metadata schema
 */
export const MixMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  coverImagePath: z.string().optional(),
  tags: z.array(z.string()),
  genre: z.string().optional(),
  estimatedDuration: z.number().nonnegative().optional(),
  createdBy: z.string().optional(),
})

/**
 * Project schema
 */
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  projectDirectory: z.string().min(1, 'Project directory is required'),
  songs: z.array(SongSchema),
  mixMetadata: MixMetadataSchema,
  isActive: z.boolean(),
})

/**
 * Recent project schema
 */
export const RecentProjectSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  projectDirectory: z.string().min(1),
  lastOpened: z.date(),
  songCount: z.number().int().nonnegative(),
  coverImagePath: z.string().optional(),
})

/**
 * Project stats schema
 */
export const ProjectStatsSchema = z.object({
  totalSongs: z.number().int().nonnegative(),
  totalDuration: z.number().nonnegative(),
  totalSize: z.number().nonnegative(),
  downloadedSongs: z.number().int().nonnegative(),
  externalSongs: z.number().int().nonnegative(),
  formatBreakdown: z.record(z.string(), z.number().int().nonnegative()),
})

/**
 * Project lock schema
 */
export const ProjectLockSchema = z.object({
  projectId: z.string().uuid(),
  lockedBy: z.object({
    pid: z.number().int().positive(),
    hostname: z.string().min(1),
  }),
  lockedAt: z.date(),
})

/**
 * Create project request schema
 */
export const CreateProjectRequestSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .refine(
      (name) => !/[<>:"/\\|?*]/.test(name),
      'Project name contains invalid characters'
    ),
  location: z.string().min(1, 'Project location is required'),
  description: z.string().optional(),
})

/**
 * Add song request schema
 */
export const AddSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Song title is required'),
  downloadId: z.string().uuid().optional(),
  externalFilePath: z.string().optional(),
  order: z.number().int().nonnegative(),
  metadata: AudioMetadataSchema.partial().optional(),
}).refine(
  (data) => data.downloadId || data.externalFilePath,
  'Either downloadId or externalFilePath must be provided'
)

/**
 * Update song request schema
 */
export const UpdateSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  songId: z.string().uuid(),
  updates: SongSchema.partial().omit({ id: true, addedAt: true }),
})

/**
 * Remove song request schema
 */
export const RemoveSongRequestSchema = z.object({
  projectId: z.string().uuid(),
  songId: z.string().uuid(),
})

/**
 * Update mix metadata request schema
 */
export const UpdateMixMetadataRequestSchema = z.object({
  projectId: z.string().uuid(),
  metadata: MixMetadataSchema.partial(),
})

/**
 * Open project request schema
 */
export const OpenProjectRequestSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
})

/**
 * Save project request schema
 */
export const SaveProjectRequestSchema = z.object({
  project: ProjectSchema,
})

/**
 * Remove from recent request schema
 */
export const RemoveFromRecentRequestSchema = z.object({
  filePath: z.string().min(1),
})

/**
 * Get project info request schema
 */
export const GetProjectInfoRequestSchema = z.object({
  projectId: z.string().uuid(),
})

/**
 * Get project stats request schema
 */
export const GetProjectStatsRequestSchema = z.object({
  projectId: z.string().uuid(),
})

/**
 * Validate project request schema
 */
export const ValidateProjectRequestSchema = z.object({
  filePath: z.string().min(1),
})

/**
 * Select audio file request schema
 */
export const SelectAudioFileRequestSchema = z.object({
  filters: z.array(z.object({
    name: z.string(),
    extensions: z.array(z.string()),
  })).optional(),
})

/**
 * Get audio metadata request schema
 */
export const GetAudioMetadataRequestSchema = z.object({
  filePath: z.string().min(1),
})

/**
 * Export project request schema
 */
export const ExportProjectRequestSchema = z.object({
  projectId: z.string().uuid(),
  targetPath: z.string().min(1),
})

/**
 * Import project request schema
 */
export const ImportProjectRequestSchema = z.object({
  sourcePath: z.string().min(1),
})

/**
 * Duplicate project request schema
 */
export const DuplicateProjectRequestSchema = z.object({
  projectId: z.string().uuid(),
  newName: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .refine(
      (name) => !/[<>:"/\\|?*]/.test(name),
      'Project name contains invalid characters'
    ),
})

/**
 * Select file response schema
 */
export const SelectFileResponseSchema = z.object({
  filePath: z.string(),
  cancelled: z.boolean(),
})

/**
 * Legacy schemas (for backward compatibility)
 */
export const CreateProjectSchema = CreateProjectRequestSchema
export const ProjectIdSchema = z.string().uuid()
