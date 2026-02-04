import { z } from 'zod'

export const FileFormatSchema = z.enum(['mp3', 'flac', 'wav', 'aac', 'ogg', 'alac', 'ape', 'any'])

export const SortBySchema = z.enum(['relevance', 'seeders', 'date', 'size', 'title'])

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
