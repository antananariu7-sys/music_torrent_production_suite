import * as cheerio from 'cheerio'
import type { TorrentPageMetadata, ParsedAlbum, TorrentTrack } from '@shared/types/torrentMetadata.types'

/**
 * Parse numbered track lines from text content
 * Matches patterns like:
 *   "1. Track Title" or "01. Track Title (03:42)"  — numeric, duration at end
 *   "A1. Track Title" or "B3. Track Title"          — vinyl side+number
 *   "(03:42) 01. Track Title"                       — duration at beginning
 */
export function parseTracksFromText(text: string): TorrentTrack[] {
  const tracks: TorrentTrack[] = []
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)

  // Pattern 1: number first, optional duration at end — "01. Track Title (03:42)"
  const patternNumFirst = /^([A-Z]?\d{1,3})\.\s+(.+?)(?:\s+\((\d{1,2}:\d{2}(?::\d{2})?)\))?$/
  // Pattern 2: duration first — "(03:42) 01. Track Title"
  const patternDurFirst = /^\((\d{1,2}:\d{2}(?::\d{2})?)\)\s+([A-Z]?\d{1,3})\.\s+(.+)$/

  let seqPosition = 0
  for (const line of lines) {
    let rawNum: string | undefined
    let title: string | undefined
    let duration: string | undefined

    const m1 = line.match(patternNumFirst)
    if (m1) {
      rawNum = m1[1]
      title = m1[2].trim()
      duration = m1[3]
    } else {
      const m2 = line.match(patternDurFirst)
      if (m2) {
        duration = m2[1]
        rawNum = m2[2]
        title = m2[3].trim()
      }
    }

    if (rawNum && title) {
      seqPosition++
      // Use the numeric part if purely numeric, otherwise sequential counter
      const position = /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : seqPosition
      tracks.push({ position, title, duration })
    }
  }

  return tracks
}

/**
 * Parse track titles from CUE sheet content
 * Extracts TITLE lines from TRACK blocks
 */
export function parseTracksFromCue(cueContent: string): TorrentTrack[] {
  const tracks: TorrentTrack[] = []
  const titleMatches = cueContent.matchAll(/TRACK\s+(\d+)\s+AUDIO[\s\S]*?TITLE\s+"([^"]+)"/g)

  for (const match of titleMatches) {
    const position = parseInt(match[1], 10)
    const title = match[2].trim()
    // Skip placeholder titles
    if (title && title !== '-') {
      tracks.push({ position, title })
    }
  }

  return tracks
}

/**
 * Extract audio format and bitrate info from page HTML
 */
export function extractFormatInfo(html: string): { format?: string; bitrate?: string } {
  const result: { format?: string; bitrate?: string } = {}

  // Check page title/description for format info
  const lowerHtml = html.toLowerCase()

  if (lowerHtml.includes('flac')) {
    result.format = 'FLAC'
    if (lowerHtml.includes('lossless')) {
      result.bitrate = 'lossless'
    }
  } else if (lowerHtml.includes('mp3')) {
    result.format = 'MP3'
    // Try to find bitrate
    const bitrateMatch = html.match(/(\d{2,3})\s*kbps/i)
    if (bitrateMatch) {
      result.bitrate = `${bitrateMatch[1]} kbps`
    }
  } else if (lowerHtml.includes('wav')) {
    result.format = 'WAV'
    result.bitrate = 'lossless'
  } else if (lowerHtml.includes('ape')) {
    result.format = 'APE'
    result.bitrate = 'lossless'
  }

  return result
}

/**
 * Parse album header from sp-head span text
 * Patterns:
 *   "1986. Ноль - Музыка драчевых напильников"
 *   "1986. Ноль - Album Title (2CD)"
 */
function parseAlbumHeader(headerText: string): { title: string; year?: string } {
  // Normalize whitespace (HTML formatting causes multiline headers)
  const trimmed = headerText.replace(/\s+/g, ' ').trim()

  // Match: "YYYY. Title" or "YYYY. Artist - Title"
  const yearMatch = trimmed.match(/^(\d{4})\.\s+(.+)$/)
  if (yearMatch) {
    const rest = yearMatch[2]
    // Try to split "Artist - Title"
    const dashIndex = rest.indexOf(' - ')
    const title = dashIndex >= 0 ? rest.substring(dashIndex + 3).trim() : rest.trim()
    return { title, year: yearMatch[1] }
  }

  return { title: trimmed }
}

/**
 * Extract total duration from post body metadata
 */
function extractTotalDuration($: cheerio.CheerioAPI): string | undefined {
  const postBody = $('.post_body').first()
  if (!postBody.length) return undefined

  // Look for "Продолжительность: HH:MM:SS" pattern
  const bodyHtml = postBody.html() || ''
  const durationMatch = bodyHtml.match(/Продолжительность<\/span>:\s*([\d:]+)/i)
  return durationMatch ? durationMatch[1].trim() : undefined
}

/**
 * Convert sp-body HTML to plain text for track parsing
 */
function spBodyToText(body: ReturnType<cheerio.CheerioAPI>): string {
  // Clone, remove nested sp-wraps (logs, CUE sheets), then get text
  const bodyClone = body.clone()
  bodyClone.find('.sp-wrap').remove()

  const bodyHtml = bodyClone.html() || ''
  return bodyHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span class="post-br"><br\s*\/?><\/span>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

/**
 * Check if a sp-head text looks like an album header (starts with a year)
 */
function isAlbumHeader(headerText: string): boolean {
  return /^\d{4}\.?\s/.test(headerText.replace(/\s+/g, ' ').trim())
}

/**
 * Parse a full RuTracker torrent page HTML and extract album/track metadata
 *
 * Handles multiple page layouts:
 * 1. Flat discography: Albums are direct children of post_body
 * 2. Nested discography: Albums inside category/sub-category sp-wraps
 * 3. Single album: Track list directly in post_body (no sp-wraps)
 */
export function parseAlbumsFromHtml(html: string): TorrentPageMetadata {
  const $ = cheerio.load(html)
  const albums: ParsedAlbum[] = []
  const formatInfo = extractFormatInfo(html)
  const totalDuration = extractTotalDuration($)

  const postBody = $('.post_body').first()

  // Strategy 1: Find all sp-wraps with album headers (year-prefixed) at any depth
  const allSpWraps = postBody.find('.sp-wrap')

  if (allSpWraps.length > 0) {
    allSpWraps.each((_index, spWrap) => {
      const $spWrap = $(spWrap)
      const headerText = $spWrap.children('.sp-head').find('span').first().text()

      // Only process sp-wraps whose header starts with a year (album entries)
      if (!isAlbumHeader(headerText)) return

      // Skip log/CUE sections that happen to start with a number
      const headerLower = headerText.toLowerCase()
      if (
        headerLower.includes('лог') ||
        headerLower.includes('log') ||
        headerLower.includes('.cue') ||
        headerLower.includes('индексн')
      ) {
        return
      }

      const { title, year } = parseAlbumHeader(headerText)
      const body = $spWrap.children('.sp-body').first()

      const bodyText = spBodyToText(body)

      // Try parsing numbered tracks from text
      let tracks = parseTracksFromText(bodyText)

      // If no tracks found in text, try CUE sheets in nested sp-wraps
      if (tracks.length === 0) {
        body.find('.sp-wrap .post-pre').each((_i, pre) => {
          const preText = $(pre).text()
          if (preText.includes('TRACK') && preText.includes('TITLE')) {
            const cueTracks = parseTracksFromCue(preText)
            if (cueTracks.length > 0) {
              tracks = cueTracks
              return false // break after first successful CUE parse
            }
          }
          return undefined // continue iteration
        })
      }

      if (title) {
        albums.push({ title, year, tracks })
      }
    })
  }

  // Strategy 2: If no album sp-wraps found, try parsing track list directly from post body
  if (albums.length === 0 && postBody.length > 0) {
    const bodyHtml = postBody.html() || ''
    const bodyText = bodyHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<span class="post-br"><br\s*\/?><\/span>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')

    const tracks = parseTracksFromText(bodyText)
    if (tracks.length > 0) {
      // Try to extract album title from page title
      const pageTitle = $('title').text()
      const titleMatch = pageTitle.match(/(?:\([^)]+\)\s*)?(?:\[[^\]]+\]\s*)?(.+?)\s*(?:::?\s*RuTracker)/i)
      const albumTitle = titleMatch ? titleMatch[1].trim() : 'Unknown Album'

      albums.push({ title: albumTitle, tracks })
    }
  }

  return {
    albums,
    format: formatInfo.format,
    bitrate: formatInfo.bitrate,
    totalDuration,
  }
}
