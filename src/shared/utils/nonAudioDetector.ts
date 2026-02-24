import type { SearchResult } from '../types/search.types'

/**
 * Patterns that indicate primarily non-audio content.
 * Uses regex word boundaries to avoid false positives on music torrents
 * that include bonus video content (e.g. "[+Video]").
 */
const NON_AUDIO_PATTERNS: RegExp[] = [
  // PDFs / books
  /\bpdf\b/,
  /\bкниг[аи]\b/,
  /\bучебник/,
  /\bсамоучитель/,
  // Video-only content (not "+video" bonus in music torrents)
  /(?<!\+)\bvideo\s*(lesson|урок|курс|school)/i,
  /\bвидео\s*(урок|курс|школ)/,
  /\bdvd\b(?!.*(?:flac|mp3|ape|wav|aac|lossless))/,
  /\bblu-ray\b(?!.*(?:flac|mp3|ape|wav|aac|lossless))/,
  /\bconcert film\b/,
  // Guitar tabs / sheet music
  /\bguitar\s*pro\b/,
  /\bgtp\b/,
  /\bтабулатур/,
  /\bноты\b/,
  // Software / plugins
  /\bvst[i23]?\b/,
  /\bplugin\b/,
  /\bsoftware\b/,
  /\bпрограмм/,
  // Karaoke
  /\bkaraoke\b/,
  /\bкараоке\b/,
  /\bминус(?:овк[аи])?\b/,
]

/** Returns true if the result likely contains non-audio content */
export function isNonAudioResult(result: SearchResult): boolean {
  const title = result.title
  return NON_AUDIO_PATTERNS.some((re) => re.test(title))
}
