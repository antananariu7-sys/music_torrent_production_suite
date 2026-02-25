import type { SearchResult } from '../types/search.types'

/**
 * Matches common audio format keywords anywhere in the title.
 * Used to exempt video-format patterns when audio content is present.
 */
const AUDIO_FORMAT_RE = /\b(?:flac|mp3|ape|wav|aac|lossless|dsd)\b/i

/**
 * Notes on boundaries:
 * - \b works for Latin/ASCII words only.
 * - For Cyrillic patterns, use (?:^|[^а-яА-ЯёЁ]) as a leading boundary
 *   and (?:[^а-яА-ЯёЁ]|$) as a trailing boundary. Abbreviated as CYR_B / CYR_E.
 */
const CYR_B = '(?:^|[^а-яА-ЯёЁ])'
const CYR_E = '(?:[^а-яА-ЯёЁ]|$)'

/**
 * Patterns that always indicate non-audio content,
 * regardless of whether audio format keywords are present.
 */
const STRICT_NON_AUDIO_PATTERNS: RegExp[] = [
  // PDFs / books / audiobooks
  /\bpdf\b/i,
  new RegExp(`${CYR_B}книг[аи]${CYR_E}`, 'i'),
  new RegExp(`${CYR_B}учебник`, 'i'),
  new RegExp(`${CYR_B}самоучитель`, 'i'),
  /\baudiobook\b/i,
  new RegExp(`${CYR_B}аудиокниг`, 'i'),

  // Movie voice-over / dubbing (uniquely film content in RuTracker)
  /\b[DAM]VO\b/,

  // Video-only content (not "+video" bonus in music torrents)
  /(?<!\+)\bvideo\s*(lesson|урок|курс|school)/i,
  new RegExp(`${CYR_B}видео\\s*(урок|курс|школ)`, 'i'),
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

  // E-book formats
  /\b(?:fb2|epub|djvu?|mobi)\b/i,

  // Video game indicators
  /\bdlc\b/i,

  // Documentary
  /\bdocumentary\b/i,
  new RegExp(`${CYR_B}документальн`, 'i'),

  // Low-bitrate MP3 (audiobook indicator: 16–64 kbps)
  /\b(?:16|24|32|48|56|64)\s*kbps\b/i,
]

/**
 * Patterns that indicate non-audio only when no audio format keyword
 * (flac, mp3, aac, etc.) appears anywhere in the title.
 * These are video formats that can co-exist with audio in music torrents.
 */
const VIDEO_FORMAT_PATTERNS: RegExp[] = [
  // Movie / TV video rip formats
  /\b(?:BD|HD|WEB|CAM|TV|SAT|DVD)Rip\b/i,
  /\bWEB-DL\b/i,
  /\bBDRemux\b/i,
  /\bRemux\b/i,

  // DVD / Blu-ray
  /\bdvd\b/i,
  /\bblu-ray\b/i,

  // Video disc formats
  /\b(?:dvd[59]|ntsc)\b/i,
  /\bpal\b/i,
]

/** Returns true if the result likely contains non-audio content */
export function isNonAudioResult(result: SearchResult): boolean {
  const title = result.title

  // Strict patterns always indicate non-audio
  if (STRICT_NON_AUDIO_PATTERNS.some((re) => re.test(title))) return true

  // Video format patterns are only non-audio when no audio format is present
  // anywhere in the title (fixes false positives like "AAC ... WEB-DL")
  if (AUDIO_FORMAT_RE.test(title)) return false
  return VIDEO_FORMAT_PATTERNS.some((re) => re.test(title))
}
