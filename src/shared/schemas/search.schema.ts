import { z } from 'zod'

export const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
})

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  size: z.string(),
  seeders: z.number().int().nonnegative(),
  leechers: z.number().int().nonnegative(),
  url: z.string().url(),
  category: z.string().optional(),
})

export const SearchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(SearchResultSchema).optional(),
  error: z.string().optional(),
  query: z.string().optional(),
})
