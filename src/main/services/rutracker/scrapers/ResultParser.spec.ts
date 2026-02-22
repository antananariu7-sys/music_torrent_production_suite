import { describe, it, expect, jest, beforeEach } from '@jest/globals'

jest.mock('../utils/formatDetector', () => ({
  detectFileFormat: jest.fn((title: string) => {
    if (title.includes('FLAC')) return 'FLAC'
    if (title.includes('MP3')) return 'MP3'
    return undefined
  }),
}))

jest.mock('../utils/sizeParser', () => ({
  parseSizeToBytes: jest.fn((size: string) => {
    const num = parseFloat(size)
    return isNaN(num) ? undefined : num
  }),
}))

import { ResultParser } from './ResultParser'
import type { Page } from 'puppeteer-core'

function makePage(evaluateResult: any): Page {
  return {
    evaluate: jest.fn<any>().mockResolvedValue(evaluateResult),
  } as unknown as Page
}

describe('ResultParser', () => {
  let parser: ResultParser

  beforeEach(() => {
    jest.clearAllMocks()
    parser = new ResultParser()
  })

  describe('parseSearchResults', () => {
    it('should parse results and post-process with format detection and size parsing', async () => {
      const rawResults = [
        {
          id: '123',
          title: 'Artist - Album [FLAC]',
          author: 'uploader',
          size: '500000000',
          seeders: 10,
          leechers: 2,
          url: 'https://rutracker.org/forum/viewtopic.php?t=123',
        },
      ]

      const page = makePage(rawResults)
      const results = await parser.parseSearchResults(page)

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('123')
      expect(results[0].title).toBe('Artist - Album [FLAC]')
      expect(results[0].format).toBe('FLAC')
      expect(results[0].sizeBytes).toBe(500000000)
    })

    it('should return empty array when page.evaluate returns empty', async () => {
      const page = makePage([])
      const results = await parser.parseSearchResults(page)
      expect(results).toEqual([])
    })

    it('should return empty array on evaluate error', async () => {
      const page = {
        evaluate: jest.fn<any>().mockRejectedValue(new Error('Page crashed')),
      } as unknown as Page

      const results = await parser.parseSearchResults(page)
      expect(results).toEqual([])
    })

    it('should handle multiple results', async () => {
      const rawResults = [
        {
          id: '1',
          title: 'Album 1 [FLAC]',
          author: 'a',
          size: '100',
          seeders: 5,
          leechers: 1,
          url: '',
        },
        {
          id: '2',
          title: 'Album 2 [MP3]',
          author: 'b',
          size: '200',
          seeders: 3,
          leechers: 0,
          url: '',
        },
      ]

      const page = makePage(rawResults)
      const results = await parser.parseSearchResults(page)

      expect(results).toHaveLength(2)
      expect(results[0].format).toBe('FLAC')
      expect(results[1].format).toBe('MP3')
    })
  })

  describe('getTotalPages', () => {
    it('should return max page number from evaluate', async () => {
      const page = {
        evaluate: jest.fn<any>().mockResolvedValue(5),
      } as unknown as Page

      const totalPages = await parser.getTotalPages(page)
      expect(totalPages).toBe(5)
    })

    it('should return 1 on error', async () => {
      const page = {
        evaluate: jest.fn<any>().mockRejectedValue(new Error('fail')),
      } as unknown as Page

      const totalPages = await parser.getTotalPages(page)
      expect(totalPages).toBe(1)
    })
  })
})
