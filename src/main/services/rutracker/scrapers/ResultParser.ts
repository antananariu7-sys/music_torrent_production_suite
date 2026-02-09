import type { Page } from 'puppeteer-core'
import type { SearchResult } from '@shared/types/search.types'
import { detectFileFormat } from '../utils/formatDetector'
import { parseSizeToBytes } from '../utils/sizeParser'

/**
 * ResultParser
 *
 * Parses RuTracker search results from HTML pages
 */
export class ResultParser {
  /**
   * Parse search results from RuTracker page
   *
   * @param page - Puppeteer page with search results
   * @returns Array of search results
   */
  async parseSearchResults(page: Page): Promise<SearchResult[]> {
    try {
      // RuTracker search results are in a table with ID 'tor-tbl'
      // Each result is a row <tr> with torrent data
      const results = await page.evaluate(() => {
        const resultsArray: Array<{
          id: string
          title: string
          author: string
          size: string
          seeders: number
          leechers: number
          url: string
          category?: string
          uploadDate?: string
        }> = []

        // Find the results table using the correct ID
        const table = document.querySelector('#tor-tbl')
        console.log('[Browser] Looking for table with ID tor-tbl')

        if (!table) {
          console.log('[Browser] No results table found with ID tor-tbl')
          // Try to find any table as fallback
          const allTables = document.querySelectorAll('table')
          console.log(`[Browser] Found ${allTables.length} total tables on page`)
          return resultsArray
        }

        console.log('[Browser] Found tor-tbl table')

        // Get all rows in the table
        const allRows = table.querySelectorAll('tr')
        console.log(`[Browser] Total rows in table: ${allRows.length}`)

        // Get all result rows - look for rows with data-topic_id attribute
        const rows = table.querySelectorAll('tr[data-topic_id]')
        console.log(`[Browser] Found ${rows.length} result rows with data-topic_id`)

        // If no rows with data-topic_id, try tbody tr as fallback
        if (rows.length === 0) {
          const tbodyRows = table.querySelectorAll('tbody tr')
          console.log(`[Browser] Trying tbody tr fallback: ${tbodyRows.length} rows`)
        }

        rows.forEach((row: Element, index: number) => {
          try {
            // Extract topic ID from data attribute
            const topicId = row.getAttribute('data-topic_id') || `unknown-${index}`

            // Title - try multiple selectors
            const titleCell = row.querySelector('.t-title a.tLink') ||
                            row.querySelector('.t-title a') ||
                            row.querySelector('a.tLink')
            const title = titleCell?.textContent?.trim() || 'Unknown Title'
            const href = titleCell?.getAttribute('href') || ''
            const url = href ? `https://rutracker.org/forum/${href}` : ''

            // Author - try multiple selectors
            const authorCell = row.querySelector('.u-name a') ||
                              row.querySelector('td:nth-child(6) a')
            const author = authorCell?.textContent?.trim() || 'Unknown Author'

            // Size - try multiple selectors
            const sizeCell = row.querySelector('.tor-size[data-ts_text]') ||
                           row.querySelector('.tor-size') ||
                           row.querySelector('td:nth-child(5)')
            const size = sizeCell?.getAttribute('data-ts_text') ||
                        sizeCell?.textContent?.trim() ||
                        '0'

            // Seeders - try multiple selectors
            const seedersCell = row.querySelector('.seedmed') ||
                               row.querySelector('.seed') ||
                               row.querySelector('td:nth-child(7)')
            const seedersText = seedersCell?.textContent?.trim() || '0'
            const seeders = parseInt(seedersText.replace(/[^0-9]/g, '')) || 0

            // Leechers - try multiple selectors
            const leechersCell = row.querySelector('.leechmed') ||
                                row.querySelector('.leech') ||
                                row.querySelector('td:nth-child(8)')
            const leechersText = leechersCell?.textContent?.trim() || '0'
            const leechers = parseInt(leechersText.replace(/[^0-9]/g, '')) || 0

            console.log(`[Browser] Parsed row ${index}: ${title} (S:${seeders} L:${leechers})`)

            resultsArray.push({
              id: topicId,
              title,
              author,
              size,
              seeders,
              leechers,
              url,
              category: undefined, // Will be populated if available
              uploadDate: undefined, // Will be populated if available
            })
          } catch (error) {
            console.error(`[Browser] Error parsing row ${index}:`, error)
          }
        })

        console.log(`[Browser] Successfully parsed ${resultsArray.length} results`)
        return resultsArray
      })

      console.log(`[ResultParser] Parser returned ${results.length} results`)

      // Post-process results: detect format and parse size
      const processedResults = results.map(result => ({
        ...result,
        format: detectFileFormat(result.title),
        sizeBytes: parseSizeToBytes(result.size),
      }))

      // Log first result for debugging
      if (processedResults.length > 0) {
        console.log('[ResultParser] Sample result:', JSON.stringify(processedResults[0], null, 2))
      }

      return processedResults
    } catch (error) {
      console.error('[ResultParser] Failed to parse results:', error)
      return []
    }
  }

  /**
   * Get total number of pages from pagination
   *
   * @param page - Puppeteer page with search results
   * @returns Total number of pages
   */
  async getTotalPages(page: Page): Promise<number> {
    try {
      const totalPages = await page.evaluate(() => {
        // Look for pagination links with class="pg"
        const pgLinks = document.querySelectorAll('a.pg')
        let maxPage = 1

        pgLinks.forEach(link => {
          const text = link.textContent?.trim() || ''
          const pageNum = parseInt(text, 10)
          if (!isNaN(pageNum) && pageNum > maxPage) {
            maxPage = pageNum
          }
        })

        return maxPage
      })

      return totalPages
    } catch {
      return 1
    }
  }
}
