import type { SearchResult } from '../types/search.types'

/**
 * Patterns that indicate primarily non-audio content.
 * Uses regex word boundaries to avoid false positives on music torrents
 * that include bonus video content (e.g. "[+Video]").
 */
const NON_AUDIO_PATTERNS: RegExp[] = [
  // PDFs / books
  /\bpdf\b/i,
  /\bкниг[аи]\b/i,
  /\bучебник/i,
  /\bсамоучитель/i,
  // Video-only content (not "+video" bonus in music torrents)
  /(?<!\+)\bvideo\s*(lesson|урок|курс|school)/i,
  /\bвидео\s*(урок|курс|школ)/i,
  /\bdvd\b(?!.*(?:flac|mp3|ape|wav|aac|lossless))/i,
  /\bblu-ray\b(?!.*(?:flac|mp3|ape|wav|aac|lossless))/i,
  /\bconcert film\b/i,
  // Guitar tabs / sheet music
  /\bguitar\s*pro\b/i,
  /\bgtp\b/i,
  /\bтабулатур/i,
  /\bноты\b/i,
  // Software / plugins
  /\bvst[i23]?\b/i,
  /\bplugin\b/i,
  /\bsoftware\b/i,
  /\bпрограмм/i,
  // Karaoke
  /\bkaraoke\b/i,
  /\bкараоке\b/i,
  /\bминус(?:овк[аи])?\b/i,
]

/** Returns true if the result likely contains non-audio content */
export function isNonAudioResult(result: SearchResult): boolean {
  const title = result.title
  return NON_AUDIO_PATTERNS.some((re) => re.test(title))
}
