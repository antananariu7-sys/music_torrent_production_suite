/**
 * Camelot wheel mapping and compatibility checker.
 * Maps standard musical keys to Camelot notation for DJ mixing compatibility.
 */

/** Standard key → Camelot notation mapping */
const KEY_TO_CAMELOT: Record<string, string> = {
  // Major keys (B side)
  'C major': '8B',
  'Db major': '3B',
  'D major': '10B',
  'Eb major': '5B',
  'E major': '12B',
  'F major': '7B',
  'F# major': '2B',
  'Gb major': '2B',
  'G major': '9B',
  'Ab major': '4B',
  'A major': '11B',
  'Bb major': '6B',
  'B major': '1B',

  // Minor keys (A side)
  'C minor': '5A',
  'C# minor': '12A',
  'Db minor': '12A',
  'D minor': '7A',
  'D# minor': '2A',
  'Eb minor': '2A',
  'E minor': '9A',
  'F minor': '4A',
  'F# minor': '11A',
  'Gb minor': '11A',
  'G minor': '6A',
  'G# minor': '1A',
  'Ab minor': '1A',
  'A minor': '8A',
  'A# minor': '3A',
  'Bb minor': '3A',
  'B minor': '10A',
}

/**
 * Convert standard key notation to Camelot notation.
 * @param key Standard key string, e.g. "C major", "A minor"
 * @returns Camelot notation, e.g. "8B", "8A", or null if unrecognized
 */
export function toCamelot(key: string): string | null {
  return KEY_TO_CAMELOT[key] ?? null
}

/**
 * Parse a Camelot key string into its components.
 * @returns { number, letter } or null if invalid
 */
export function parseCamelot(
  camelot: string
): { number: number; letter: 'A' | 'B' } | null {
  const match = camelot.match(/^(\d{1,2})([AB])$/)
  if (!match) return null
  const num = parseInt(match[1], 10)
  if (num < 1 || num > 12) return null
  return { number: num, letter: match[2] as 'A' | 'B' }
}

/**
 * Check if two Camelot keys are compatible for harmonic mixing.
 *
 * Compatible pairs:
 * - Same key (e.g. 8A → 8A)
 * - +1/-1 on same letter (e.g. 8A → 7A, 8A → 9A) — wraps around 12→1
 * - Same number, different letter (e.g. 8A → 8B)
 */
export function isCompatible(keyA: string, keyB: string): boolean {
  const a = parseCamelot(keyA)
  const b = parseCamelot(keyB)
  if (!a || !b) return false

  // Same key
  if (a.number === b.number && a.letter === b.letter) return true

  // Same number, different letter (relative major/minor)
  if (a.number === b.number && a.letter !== b.letter) return true

  // Adjacent number on same letter (wrapping 12→1)
  if (a.letter === b.letter) {
    const diff = Math.abs(a.number - b.number)
    if (diff === 1 || diff === 11) return true // 11 = wrapping (e.g. 12→1)
  }

  return false
}

/**
 * Get compatibility label for display.
 */
export function getCompatibilityLabel(
  keyA: string | undefined,
  keyB: string | undefined
): { label: string; compatible: boolean | null } {
  if (!keyA || !keyB) {
    return { label: '—', compatible: null }
  }
  if (isCompatible(keyA, keyB)) {
    return { label: 'Compatible', compatible: true }
  }
  return { label: 'Key clash', compatible: false }
}
