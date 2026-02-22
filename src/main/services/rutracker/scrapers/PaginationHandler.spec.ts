import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('../utils/urlBuilder', () => ({
  buildSearchUrl: jest.fn(
    (query: string, page: number) =>
      `https://rutracker.org/search?q=${query}&p=${page}`
  ),
}))

jest.mock('../utils/relevanceScorer', () => ({
  calculateRelevanceScores: jest.fn((results: any[]) => results),
}))

import { PaginationHandler } from './PaginationHandler'
import type { Browser, Page } from 'puppeteer-core'
import type { SearchProgressEvent } from '@shared/types/search.types'

function makeMockPage(): Page {
  return {
    close: jest.fn<any>().mockResolvedValue(undefined),
  } as unknown as Page
}

function makeMockBrowser(): Browser {
  return {
    newPage: jest.fn<any>().mockResolvedValue(makeMockPage()),
  } as unknown as Browser
}

describe('PaginationHandler', () => {
  let handler: PaginationHandler
  let browser: Browser

  beforeEach(() => {
    jest.clearAllMocks()
    handler = new PaginationHandler()
    browser = makeMockBrowser()

    // Mock internal dependencies via prototype
    const pageScraper = (handler as any).pageScraper
    pageScraper.createPageWithCookies = jest
      .fn<any>()
      .mockResolvedValue(makeMockPage())
    pageScraper.navigateToSearchUrl = jest
      .fn<any>()
      .mockResolvedValue(undefined)

    const resultParser = (handler as any).resultParser
    resultParser.parseSearchResults = jest.fn<any>().mockResolvedValue([])
    resultParser.getTotalPages = jest.fn<any>().mockResolvedValue(1)

    const filtersApplier = (handler as any).filtersApplier
    filtersApplier.applyFilters = jest.fn((results: any[]) => results)
  })

  it('should return results from single page when totalPages is 1', async () => {
    const mockResults = [
      { id: '1', title: 'Result 1' },
      { id: '2', title: 'Result 2' },
    ]
    ;(handler as any).resultParser.parseSearchResults.mockResolvedValue(
      mockResults
    )
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(1)

    const results = await handler.executeProgressiveSearch(
      browser,
      'test query',
      [],
      { maxPages: 5, concurrentPages: 3 }
    )

    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('1')
  })

  it('should cap maxPages at 10', async () => {
    ;(handler as any).resultParser.parseSearchResults.mockResolvedValue([])
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(20)

    const onProgress = jest.fn<(e: SearchProgressEvent) => void>()

    await handler.executeProgressiveSearch(
      browser,
      'query',
      [],
      { maxPages: 15, concurrentPages: 2 },
      undefined,
      onProgress
    )

    // Should report totalPages as 10 (capped), not 15 or 20
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ totalPages: 10 })
    )
  })

  it('should deduplicate results across pages', async () => {
    // Page 1 returns results
    ;(handler as any).resultParser.parseSearchResults
      .mockResolvedValueOnce([
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
      ])
      // Page 2 returns overlapping results
      .mockResolvedValueOnce([
        { id: '2', title: 'B' },
        { id: '3', title: 'C' },
      ])
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(2)

    const results = await handler.executeProgressiveSearch(
      browser,
      'query',
      [],
      { maxPages: 5, concurrentPages: 2 }
    )

    expect(results).toHaveLength(3)
    const ids = results.map((r) => r.id)
    expect(ids).toEqual(['1', '2', '3'])
  })

  it('should call progress callback for each batch', async () => {
    ;(handler as any).resultParser.parseSearchResults.mockResolvedValue([
      { id: '1' },
    ])
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(3)

    const onProgress = jest.fn<(e: SearchProgressEvent) => void>()

    await handler.executeProgressiveSearch(
      browser,
      'query',
      [],
      { maxPages: 5, concurrentPages: 2 },
      undefined,
      onProgress
    )

    expect(onProgress).toHaveBeenCalled()
    // First call for page 1
    expect(onProgress.mock.calls[0][0]).toMatchObject({ currentPage: 1 })
    // Last call should be complete
    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
    expect(lastCall.isComplete).toBe(true)
  })

  it('should handle page fetch failure gracefully', async () => {
    ;(handler as any).resultParser.parseSearchResults
      .mockResolvedValueOnce([{ id: '1' }]) // page 1 success
      .mockRejectedValueOnce(new Error('timeout')) // page 2 fails
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(2)

    // fetchPage uses navigateToSearchUrl + parseSearchResults, let's mock at that level
    ;(handler as any).pageScraper.navigateToSearchUrl
      .mockResolvedValueOnce(undefined) // page 1
      .mockRejectedValueOnce(new Error('timeout')) // page 2

    const results = await handler.executeProgressiveSearch(
      browser,
      'query',
      [],
      { maxPages: 5, concurrentPages: 2 }
    )

    // Should still return page 1 results
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('should apply filters when provided', async () => {
    ;(handler as any).resultParser.parseSearchResults.mockResolvedValue([
      { id: '1' },
    ])
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(1)

    const filters = { minSeeders: 5 }

    await handler.executeProgressiveSearch(
      browser,
      'query',
      [],
      { maxPages: 1, concurrentPages: 1 },
      filters as any
    )

    expect((handler as any).filtersApplier.applyFilters).toHaveBeenCalledWith(
      expect.any(Array),
      filters
    )
  })

  it('should close all pages after completion', async () => {
    const mockPage = makeMockPage()
    ;(handler as any).pageScraper.createPageWithCookies.mockResolvedValue(
      mockPage
    )
    ;(handler as any).resultParser.parseSearchResults.mockResolvedValue([])
    ;(handler as any).resultParser.getTotalPages.mockResolvedValue(1)

    await handler.executeProgressiveSearch(browser, 'query', [], {
      maxPages: 1,
      concurrentPages: 1,
    })

    expect(mockPage.close).toHaveBeenCalled()
  })
})
