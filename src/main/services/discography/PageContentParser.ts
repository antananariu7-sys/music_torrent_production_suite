import type { Page } from 'puppeteer-core'
import type { DiscographyAlbumEntry, PageContentScanResult } from '@shared/types/discography.types'
import type { SearchResult } from '@shared/types/search.types'

/**
 * PageContentParser
 *
 * Parses a RuTracker page for discography album entries.
 * Handles structured (sp-wrap) and unstructured page formats.
 */
export async function parsePageContent(
  page: Page,
  albumName: string,
  artistName?: string
): Promise<Omit<PageContentScanResult, 'searchResult'>> {
  const result = await page.evaluate((albumNameArg: string, artistNameArg?: string) => {
    const allAlbums: Array<{
      title: string
      year?: string
      rawText: string
      duration?: string
      releaseInfo?: string
    }> = []

    const pageTitle = document.title || 'Unknown'

    const bodyText = document.body?.textContent?.toLowerCase() || ''
    const isDiscography = bodyText.includes('discography') ||
                         bodyText.includes('дискография') ||
                         bodyText.includes('studio album') ||
                         bodyText.includes('студийные альбомы')

    // Parse album entries from sp-wrap sections (RuTracker discography format)
    const spWrapSections = document.querySelectorAll('.sp-wrap')

    spWrapSections.forEach((section) => {
      const header = section.querySelector('.sp-head span')
      if (header) {
        const rawText = header.textContent?.trim() || ''

        // Format examples:
        // "1967 - The Piper At The Gates Of Dawn (1987, EMI CDP 7 46384 2, UK) (00:41:44)"
        const yearMatch = rawText.match(/^(\d{4})\s*-\s*/)
        const durationMatch = rawText.match(/\((\d{2}:\d{2}:\d{2})\)$/)
        const releaseInfoMatch = rawText.match(/\((\d{4},\s*[^)]+)\)/)

        let title = rawText
        if (yearMatch) {
          title = rawText.substring(yearMatch[0].length)
        }
        if (releaseInfoMatch) {
          title = title.replace(releaseInfoMatch[0], '').trim()
        }
        if (durationMatch) {
          title = title.replace(durationMatch[0], '').trim()
        }

        allAlbums.push({
          title: title.trim(),
          year: yearMatch ? yearMatch[1] : undefined,
          rawText,
          duration: durationMatch ? durationMatch[1] : undefined,
          releaseInfo: releaseInfoMatch ? releaseInfoMatch[1] : undefined,
        })
      }
    })

    // Fallback: check plain text in post body for year - album patterns
    const postBody = document.querySelector('.post_body')
    if (postBody && allAlbums.length === 0) {
      const text = postBody.textContent || ''
      const lines = text.split('\n')

      for (const line of lines) {
        const trimmedLine = line.trim()
        const albumPattern = /^(\d{4})\s*[-–]\s*(.+?)(?:\s*\(|$)/
        const match = trimmedLine.match(albumPattern)

        if (match) {
          allAlbums.push({
            title: match[2].trim(),
            year: match[1],
            rawText: trimmedLine,
          })
        }
      }
    }

    const albumNameLower = albumNameArg.toLowerCase()
    const artistNameLower = artistNameArg?.toLowerCase()

    const matchedAlbums = allAlbums.filter(album => {
      const titleLower = album.title.toLowerCase()
      const rawTextLower = album.rawText.toLowerCase()
      const albumMatches = titleLower.includes(albumNameLower) || rawTextLower.includes(albumNameLower)

      if (artistNameLower && albumMatches) {
        const pageText = document.body?.textContent?.toLowerCase() || ''
        return pageText.includes(artistNameLower)
      }

      return albumMatches
    })

    // Full-text fallback search
    let albumFoundInText = false
    if (matchedAlbums.length === 0) {
      const fullPageText = document.body?.textContent?.toLowerCase() || ''
      albumFoundInText = fullPageText.includes(albumNameLower)
    }

    return {
      allAlbums,
      matchedAlbums,
      albumFound: matchedAlbums.length > 0 || albumFoundInText,
      isDiscography: isDiscography || allAlbums.length > 3,
      pageTitle,
    }
  }, albumName, artistName)

  return {
    albumFound: result.albumFound,
    matchedAlbums: result.matchedAlbums as DiscographyAlbumEntry[],
    allAlbums: result.allAlbums as DiscographyAlbumEntry[],
    isDiscography: result.isDiscography,
    pageTitle: result.pageTitle,
  }
}

/**
 * Scan a single page for album content
 */
export async function scanSinglePage(
  browser: import('puppeteer-core').Browser,
  sessionCookies: Array<{ name: string; value: string; domain: string; path: string; expires: number }>,
  searchResult: SearchResult,
  albumName: string,
  artistName?: string,
  timeout: number = 30000
): Promise<PageContentScanResult> {
  let page: Page | null = null

  try {
    page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    if (sessionCookies.length > 0) {
      await page.setCookie(...sessionCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
      })))
    }

    await page.goto(searchResult.url, {
      waitUntil: 'domcontentloaded',
      timeout,
    })

    await page.waitForSelector('.post_body', { timeout: 10000 }).catch(() => {
      // Continue even if post_body not found
    })

    const parseResult = await parsePageContent(page, albumName, artistName)

    await page.close()

    return { searchResult, ...parseResult }
  } catch (error) {
    if (page) {
      await page.close().catch(() => {})
    }

    return {
      searchResult,
      albumFound: false,
      matchedAlbums: [],
      allAlbums: [],
      isDiscography: false,
      pageTitle: searchResult.title,
      error: error instanceof Error ? error.message : 'Failed to scan page',
    }
  }
}
