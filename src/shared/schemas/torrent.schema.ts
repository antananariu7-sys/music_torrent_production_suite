import { z } from 'zod'

export const TorrentStatusSchema = z.enum(['pending', 'downloading', 'completed', 'failed'])

export const TorrentDownloadRequestSchema = z.object({
  torrentId: z.string().min(1, 'Torrent ID is required'),
  pageUrl: z.string().url('Valid page URL is required'),
  title: z.string().optional(),
})

export const TorrentFileSchema = z.object({
  id: z.string(),
  title: z.string(),
  filePath: z.string(),
  pageUrl: z.string().url(),
  downloadedAt: z.date(),
  size: z.number().nonnegative().optional(),
  metadata: z
    .object({
      author: z.string().optional(),
      seeders: z.number().int().nonnegative().optional(),
      leechers: z.number().int().nonnegative().optional(),
      category: z.string().optional(),
    })
    .optional(),
})

export const TorrentDownloadResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  torrent: TorrentFileSchema.optional(),
})

export const TorrentDownloadProgressSchema = z.object({
  torrentId: z.string(),
  status: TorrentStatusSchema,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
})

export const TorrentSettingsSchema = z.object({
  torrentsFolder: z.string().min(1, 'Torrents folder is required'),
  autoOpen: z.boolean().optional(),
  keepHistory: z.boolean().optional(),
})
