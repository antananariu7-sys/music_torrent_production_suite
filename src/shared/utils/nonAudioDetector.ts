import type { SearchResult } from '../types/search.types'

/**
 * Negative lookahead: skip if common audio formats appear later in the title.
 * Used for video format indicators that could appear alongside audio in
 * music torrents with bonus video (e.g. "[+Video, WEB-DL, 480p] FLAC").
 */
const NOT_AUDIO = '(?!.*(?:flac|mp3|ape|wav|aac|lossless|dsd))'

/**
 * Patterns that indicate primarily non-audio content.
 *
 * Notes on boundaries:
 * - \b works for Latin/ASCII words only.
 * - For Cyrillic patterns, use (?:^|[^а-яА-ЯёЁ]) as a leading boundary
 *   and (?:[^а-яА-ЯёЁ]|$) as a trailing boundary. Abbreviated as CYR_B / CYR_E.
 */
const CYR_B = '(?:^|[^а-яА-ЯёЁ])'
const CYR_E = '(?:[^а-яА-ЯёЁ]|$)'

const NON_AUDIO_PATTERNS: RegExp[] = [
  // PDFs / books / audiobooks
  /\bpdf\b/i,
  new RegExp(`${CYR_B}книг[аи]${CYR_E}`, 'i'),
  new RegExp(`${CYR_B}учебник`, 'i'),
  new RegExp(`${CYR_B}самоучитель`, 'i'),
  /\baudiobook\b/i,
  new RegExp(`${CYR_B}аудиокниг`, 'i'),

  // Movie / TV video rip formats (skip when audio formats present)
  new RegExp(`\\b(?:BD|HD|WEB|CAM|TV|SAT|DVD)Rip\\b${NOT_AUDIO}`, 'i'),
  new RegExp(`\\bWEB-DL\\b${NOT_AUDIO}`, 'i'),
  new RegExp(`\\bBDRemux\\b${NOT_AUDIO}`, 'i'),
  new RegExp(`\\bRemux\\b${NOT_AUDIO}`, 'i'),

  // Movie voice-over / dubbing (uniquely film content in RuTracker)
  /\b[DAM]VO\b/,

  // Video-only content (not "+video" bonus in music torrents)
  /(?<!\+)\bvideo\s*(lesson|урок|курс|school)/i,
  new RegExp(`${CYR_B}видео\\s*(урок|курс|школ)`, 'i'),
  new RegExp(`\\bdvd\\b${NOT_AUDIO}`, 'i'),
  new RegExp(`\\bblu-ray\\b${NOT_AUDIO}`, 'i'),
  /\bconcert film\b/i,

  // Guitar tabs / sheet music
  /\bguitar\s*pro\b/i,
  /\bgtp\b/i,
  new RegExp(`${CYR_B}табулатур`, 'i'),
  new RegExp(`${CYR_B}ноты${CYR_E}`, 'i'),

  // Software / plugins
  /\bvst[i23]?\b/i,
  /\bplugin\b/i,
  /\bsoftware\b/i,
  new RegExp(`${CYR_B}программ`, 'i'),

  // Karaoke
  /\bkaraoke\b/i,
  new RegExp(`${CYR_B}караоке${CYR_E}`, 'i'),
  new RegExp(`${CYR_B}минусовк`, 'i'),
]

/** Returns true if the result likely contains non-audio content */
export function isNonAudioResult(result: SearchResult): boolean {
  const title = result.title
  return NON_AUDIO_PATTERNS.some((re) => re.test(title))
}
