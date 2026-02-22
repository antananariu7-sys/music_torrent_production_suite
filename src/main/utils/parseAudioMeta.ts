import { stat, readFile } from 'fs/promises'
import path from 'path'

export interface AudioMeta {
  title?: string
  artist?: string
  album?: string
  duration?: number
  format?: string
  bitrate?: number
  sampleRate?: number
  channels?: number
  year?: number
  genre?: string
  trackNumber?: number
  fileSize: number
}

/**
 * Parse audio metadata from a file path.
 *
 * FLAC files are parsed using a manual binary parser to work around a
 * music-metadata/strtok3 incompatibility where Uint8Array.toString() is called
 * instead of Buffer.toString(), causing "Invalid FLAC preamble" errors.
 * All other formats use music-metadata's parseFile.
 */
export async function parseAudioMeta(
  filePath: string
): Promise<AudioMeta | null> {
  const { size: fileSize } = await stat(filePath)

  // ── FLAC: use manual binary parser ──────────────────────────────────────
  if (path.extname(filePath).toLowerCase() === '.flac') {
    try {
      const buf = await readFile(filePath)
      const result = parseFlacManual(buf, fileSize)
      if (result) return result
    } catch (err) {
      console.warn(
        `[parseAudioMeta] FLAC manual parse failed for "${path.basename(filePath)}":`,
        err
      )
    }
    return null
  }

  // ── All other formats: music-metadata ───────────────────────────────────
  try {
    const mm = await import('music-metadata')
    const meta = await mm.parseFile(filePath, { duration: true })
    return metaToAudioMeta(meta, fileSize)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(
      `[parseAudioMeta] parseFile failed for "${path.basename(filePath)}": ${msg}`
    )
    return null
  }
}

// ── Manual FLAC parser ──────────────────────────────────────────────────────

interface FlacStreamInfo {
  sampleRate: number
  channels: number
  bitsPerSample: number
  totalSamples: number
}

/**
 * Parse FLAC metadata from a Buffer.
 * Handles files that begin directly with 'fLaC' and files with an ID3v2
 * header prepended before 'fLaC'.
 */
function parseFlacManual(buf: Buffer, fileSize: number): AudioMeta | null {
  // Locate the 'fLaC' sync word (0x664c6143)
  const flacMarker = Buffer.from([0x66, 0x4c, 0x61, 0x43])
  const flacStart = buf.indexOf(flacMarker)
  if (flacStart < 0) return null

  let offset = flacStart + 4 // skip 'fLaC'
  let streamInfo: FlacStreamInfo | null = null
  const tags: Record<string, string> = {}

  while (offset + 4 <= buf.length) {
    const headerByte = buf[offset]
    const isLast = (headerByte & 0x80) !== 0
    const blockType = headerByte & 0x7f
    const blockLength =
      (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]
    offset += 4

    if (offset + blockLength > buf.length) break

    if (blockType === 0 && blockLength >= 34) {
      // STREAMINFO
      streamInfo = parseStreamInfo(buf, offset)
    } else if (blockType === 4) {
      // VORBIS_COMMENT
      parseVorbisComment(buf, offset, blockLength, tags)
    }

    offset += blockLength
    if (isLast) break
  }

  if (!streamInfo) return null

  const duration =
    streamInfo.totalSamples > 0 && streamInfo.sampleRate > 0
      ? streamInfo.totalSamples / streamInfo.sampleRate
      : undefined

  const bitrate =
    duration && duration > 0
      ? Math.round((8 * fileSize) / duration / 1000)
      : undefined

  const trackStr = tags['TRACKNUMBER']
  const trackNumber = trackStr
    ? parseInt(trackStr.split('/')[0], 10)
    : undefined

  const dateStr = tags['DATE'] ?? tags['YEAR']
  const year = dateStr ? parseInt(dateStr, 10) : undefined

  return {
    title: tags['TITLE'],
    artist: tags['ARTIST'],
    album: tags['ALBUM'],
    duration,
    format: 'flac',
    bitrate: bitrate && !isNaN(bitrate) ? bitrate : undefined,
    sampleRate: streamInfo.sampleRate,
    channels: streamInfo.channels,
    year: year && !isNaN(year) ? year : undefined,
    genre: tags['GENRE'],
    trackNumber: trackNumber && !isNaN(trackNumber) ? trackNumber : undefined,
    fileSize,
  }
}

/**
 * Parse FLAC STREAMINFO block (34 bytes) at the given offset in buf.
 *
 * STREAMINFO bit layout (starting at byte 10 of block data):
 *   bits 0-19  (20 bits): sample rate in Hz
 *   bits 20-22 (3 bits):  (channels) - 1
 *   bits 23-27 (5 bits):  (bits per sample) - 1
 *   bits 28-63 (36 bits): total samples in stream
 */
function parseStreamInfo(buf: Buffer, offset: number): FlacStreamInfo {
  const b10 = buf[offset + 10]
  const b11 = buf[offset + 11]
  const b12 = buf[offset + 12]
  const b13 = buf[offset + 13]

  const sampleRate = (b10 << 12) | (b11 << 4) | ((b12 & 0xf0) >> 4)
  const channels = ((b12 & 0x0e) >> 1) + 1
  const bitsPerSample = (((b12 & 0x01) << 4) | ((b13 & 0xf0) >> 4)) + 1

  const totalSamplesHigh = b13 & 0x0f
  const totalSamplesLow = buf.readUInt32BE(offset + 14)
  const totalSamples = totalSamplesHigh * 0x100000000 + totalSamplesLow

  return { sampleRate, channels, bitsPerSample, totalSamples }
}

/**
 * Parse a FLAC VORBIS_COMMENT block into key=value pairs.
 * Keys are uppercased; multi-valued tags keep the last occurrence.
 */
function parseVorbisComment(
  buf: Buffer,
  offset: number,
  length: number,
  out: Record<string, string>
): void {
  const end = offset + length
  if (offset + 4 > end) return

  // skip vendor string
  const vendorLen = buf.readUInt32LE(offset)
  offset += 4 + vendorLen
  if (offset + 4 > end) return

  const commentCount = buf.readUInt32LE(offset)
  offset += 4

  for (let i = 0; i < commentCount && offset + 4 <= end; i++) {
    const commentLen = buf.readUInt32LE(offset)
    offset += 4
    if (offset + commentLen > end) break

    const comment = buf.toString('utf8', offset, offset + commentLen)
    offset += commentLen

    const eqIdx = comment.indexOf('=')
    if (eqIdx > 0) {
      out[comment.slice(0, eqIdx).toUpperCase()] = comment.slice(eqIdx + 1)
    }
  }
}

function metaToAudioMeta(
  meta: import('music-metadata').IAudioMetadata,
  fileSize: number
): AudioMeta {
  return {
    title: meta.common.title,
    artist: meta.common.artist,
    album: meta.common.album,
    duration: meta.format.duration,
    format: meta.format.container?.toLowerCase(),
    bitrate: meta.format.bitrate
      ? Math.round(meta.format.bitrate / 1000)
      : undefined,
    sampleRate: meta.format.sampleRate,
    channels: meta.format.numberOfChannels,
    year: meta.common.year,
    genre: meta.common.genre?.[0],
    trackNumber: meta.common.track?.no ?? undefined,
    fileSize,
  }
}
