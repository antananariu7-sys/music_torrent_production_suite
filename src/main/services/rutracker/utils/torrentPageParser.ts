import * as cheerio from 'cheerio'
import type { TorrentPageMetadata, ParsedAlbum, TorrentTrack } from '@shared/types/torrentMetadata.types'

/**
 * Parse numbered track lines from text content
 * Matches patterns like: "1. Track Title" or "01. Track Title"
 */
export function parseTracksFromText(text: string): TorrentTrack[] {
  const tracks: TorrentTrack[] = []
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)

  for (const line of lines) {
    // Match: "N. Title" or "NN. Title"
    const match = line.match(/^(\d{1,3})\.\s+(.+?)(?:\s+\((\d{1,2}:\d{2}(?::\d{2})?)\))?$/)
    if (match) {
      tracks.push({
        position: parseInt(match[1], 10),
        title: match[2].trim(),
        duration: match[3],
      })
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
  const trimmed = headerText.trim()

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
 * Parse a full RuTracker torrent page HTML and extract album/track metadata
 *
 * Handles two main formats:
 * 1. Discography pages: Multiple .sp-wrap sections, each with album header + tracks
 * 2. Single album pages: Track list directly in .post_body
 */
export function parseAlbumsFromHtml(html: string): TorrentPageMetadata {
  const $ = cheerio.load(html)
  const albums: ParsedAlbum[] = []
  const formatInfo = extractFormatInfo(html)
  const totalDuration = extractTotalDuration($)

  // Strategy 1: Parse .sp-wrap sections (discography format)
  const postBody = $('.post_body').first()
  const spWraps = postBody.children('.sp-wrap')

  if (spWraps.length > 0) {
    spWraps.each((_index, spWrap) => {
      const $spWrap = $(spWrap)
      const headerSpan = $spWrap.children('.sp-head').find('span').first()
      const headerText = headerSpan.text()

      // Skip non-album sections (logs, CUE sheets)
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

      // Get text content of the body, excluding nested sp-wraps (logs, CUE sheets)
      // Clone, remove nested sp-wraps, then get text
      const bodyClone = body.clone()
      bodyClone.find('.sp-wrap').remove()

      // Convert <br> to newlines for parsing
      const bodyHtml = bodyClone.html() || ''
      const bodyText = bodyHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<span class="post-br"><br\s*\/?><\/span>/gi, '\n')
        .replace(/<[^>]+>/g, '') // strip remaining tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')

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
        })
      }

      if (title) {
        albums.push({ title, year, tracks })
      }
    })
  }

  // Strategy 2: If no sp-wrap albums found, try parsing track list directly from post body
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
