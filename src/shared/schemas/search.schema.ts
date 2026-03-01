import { z } from 'zod'

export const FileFormatSchema = z.enum([
  'mp3',
  'flac',
  'wav',
  'aac',
  'ogg',
  'alac',
  'ape',
  'any',
])

export const SortBySchema = z.enum([
  'relevance',
  'seeders',
  'date',
  'size',
  'title',
])

export const SortOrderSchema = z.enum(['asc', 'desc'])

export const SearchFiltersSchema = z.object({
  format: FileFormatSchema.optional(),
  minSeeders: z.number().int().nonnegative().optional(),
  minSize: z.number().nonnegative().optional(),
  maxSize: z.number().nonnegative().optional(),
  categories: z.array(z.string()).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
})

export const SearchSortSchema = z.object({
  by: SortBySchema,
  order: SortOrderSchema,
})

export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filters: SearchFiltersSchema.optional(),
  sort: SearchSortSchema.optional(),
  maxResults: z.number().int().positive().optional(),
})

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  size: z.string(),
  sizeBytes: z.number().nonnegative().optional(),
  seeders: z.number().int().nonnegative(),
  leechers: z.number().int().nonnegative(),
  url: z.string().url(),
  category: z.string().optional(),
  uploadDate: z.string().optional(),
  relevanceScore: z.number().min(0).max(100).optional(),
  format: FileFormatSchema.optional(),
})

export const SearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SearchResultSchema).optional(),
  error: z.string().optional(),
  query: z.string().optional(),
  appliedFilters: SearchFiltersSchema.optional(),
  totalResults: z.number().int().nonnegative().optional(),
})

export const LoadMoreRequestSchema = z.object({
  query: z.string().min(1),
  fromPage: z.number().int().positive(),
  toPage: z.number().int().positive(),
  filters: SearchFiltersSchema.optional(),
})

export const LoadMoreResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SearchResultSchema),
  loadedPages: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  isComplete: z.boolean(),
  error: z.string().optional(),
})

export const ProgressiveSearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  filters: SearchFiltersSchema.optional(),
  maxPages: z.number().int().positive().optional(),
})

export const DiscographySearchRequestSchema = z.object({
  searchResults: z.array(SearchResultSchema),
  albumName: z.string().min(1, 'Album name is required'),
  artistName: z.string().optional(),
  maxConcurrent: z.number().int().positive().optional(),
  pageTimeout: z.number().int().positive().optional(),
})

export const LoadSearchHistoryRequestSchema = z.object({
  projectId: z.string().uuid(),
  projectDirectory: z.string().min(1),
})

export const SaveSearchHistoryRequestSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  projectDirectory: z.string().min(1),
  history: z.array(
    z.object({
      id: z.string(),
      query: z.string(),
      timestamp: z.string(),
      status: z.enum(['completed', 'error', 'cancelled']),
      result: z.string().optional(),
    })
  ),
})

export const StreamPreviewStartRequestSchema = z.object({
  magnetUri: z.string().min(1, 'Magnet URI is required'),
  fileIndex: z.number().int().nonnegative(),
  trackName: z.string().min(1, 'Track name is required'),
})
