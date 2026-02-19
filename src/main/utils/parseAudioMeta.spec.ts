/**
 * Unit tests for the manual FLAC binary parser in parseAudioMeta.
 *
 * These tests verify correct bit-level extraction from synthetic FLAC buffers,
 * covering STREAMINFO and VORBIS_COMMENT block parsing.
 */

// We test the exported parseAudioMeta indirectly via a helper that builds
// minimal valid FLAC buffers, since the manual parser is not exported directly.

// To avoid mocking 'fs/promises' and 'fs', we test by writing temp files and
// calling parseAudioMeta. However, that requires real I/O. Instead, we expose
// the internal helpers via a test-only re-export at the bottom of this file
// by reaching into the module's unexported functions via a thin wrapper.

// Since the helpers are private, we validate via the exported parseAudioMeta
// by providing a minimal in-memory Buffer written to a temp file.

import { writeFile, mkdtemp } from 'fs/promises'
import os from 'os'
import path from 'path'
import { parseAudioMeta } from './parseAudioMeta'

/**
 * Build a minimal valid FLAC file buffer with given parameters.
 */
function buildFlacBuffer(params: {
  sampleRate: number
  channels: number
  bitsPerSample: number
  totalSamples: number
  tags?: Record<string, string>
}): Buffer {
  const { sampleRate, channels, bitsPerSample, totalSamples, tags = {} } = params

  // ── STREAMINFO (34 bytes) ────────────────────────────────────────────────
  const si = Buffer.alloc(34)
  si.writeUInt16BE(4096, 0)  // min block size
  si.writeUInt16BE(4096, 2)  // max block size
  si.writeUInt16BE(0, 4)     // min frame size (unknown)
  si.writeUInt16BE(0, 6)     // max frame size (unknown)
  // Byte 4 of frame sizes is the 3rd byte; we need 24-bit writes for 4-6 and 7-9
  // Overwrite with proper 24-bit values:
  si[4] = 0; si[5] = 0; si[6] = 0   // min frame size = 0
  si[7] = 0; si[8] = 0; si[9] = 0   // max frame size = 0

  // Pack sample_rate (20b) | channels-1 (3b) | bps-1 (5b) | total_samples (36b)
  const sr = sampleRate & 0xFFFFF          // 20 bits
  const ch = (channels - 1) & 0x7          // 3 bits
  const bps = (bitsPerSample - 1) & 0x1F   // 5 bits
  const tsHigh = Math.floor(totalSamples / 0x100000000) & 0xF   // top 4 bits
  const tsLow = totalSamples >>> 0           // bottom 32 bits (unsigned)

  si[10] = (sr >> 12) & 0xFF
  si[11] = (sr >> 4) & 0xFF
  si[12] = ((sr & 0xF) << 4) | ((ch & 0x7) << 1) | ((bps >> 4) & 0x1)
  si[13] = ((bps & 0xF) << 4) | (tsHigh & 0xF)
  si.writeUInt32BE(tsLow, 14)
  // bytes 18-33: MD5 (zeros ok)

  // ── VORBIS_COMMENT block ─────────────────────────────────────────────────
  let vcBuf = Buffer.alloc(0)
  if (Object.keys(tags).length > 0) {
    const vendor = Buffer.from('test', 'utf8')
    const comments: Buffer[] = []
    for (const [k, v] of Object.entries(tags)) {
      const entry = Buffer.from(`${k}=${v}`, 'utf8')
      const lenBuf = Buffer.alloc(4)
      lenBuf.writeUInt32LE(entry.length, 0)
      comments.push(lenBuf, entry)
    }
    const vendorLenBuf = Buffer.alloc(4)
    vendorLenBuf.writeUInt32LE(vendor.length, 0)
    const countBuf = Buffer.alloc(4)
    countBuf.writeUInt32LE(Object.keys(tags).length, 0)
    vcBuf = Buffer.concat([vendorLenBuf, vendor, countBuf, ...comments])
  }

  // ── Assemble blocks ──────────────────────────────────────────────────────
  const blocks: Buffer[] = []

  // STREAMINFO header: not last (0x00), type=0, length=34
  const siHeader = Buffer.from([0x00, 0x00, 0x00, 34])
  blocks.push(siHeader, si)

  if (vcBuf.length > 0) {
    // VORBIS_COMMENT header: last block (0x84), type=4
    const vcHeader = Buffer.alloc(4)
    vcHeader[0] = 0x84  // last=1, type=4
    vcHeader.writeUInt16BE(0, 1)
    vcHeader[3] = vcBuf.length & 0xFF
    // For simplicity, assume vcBuf.length fits in 1 byte (for test data)
    vcHeader[1] = (vcBuf.length >> 16) & 0xFF
    vcHeader[2] = (vcBuf.length >> 8) & 0xFF
    vcHeader[3] = vcBuf.length & 0xFF
    blocks.push(vcHeader, vcBuf)
  } else {
    // Mark STREAMINFO as last if no VC block
    blocks[0][0] = 0x80  // last=1, type=0
  }

  return Buffer.concat([Buffer.from('fLaC'), ...blocks])
}

describe('parseAudioMeta — FLAC manual parser', () => {
  let tmpDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'flac-test-'))
  })

  afterAll(async () => {
    // cleanup: ignore errors
  })

  async function writeTmp(name: string, buf: Buffer): Promise<string> {
    const p = path.join(tmpDir, name)
    await writeFile(p, buf)
    return p
  }

  test('parses STREAMINFO: 44100 Hz stereo 16-bit', async () => {
    const totalSamples = 44100 * 120  // 120 seconds
    const buf = buildFlacBuffer({ sampleRate: 44100, channels: 2, bitsPerSample: 16, totalSamples })
    const p = await writeTmp('test1.flac', buf)
    const meta = await parseAudioMeta(p)
    expect(meta).not.toBeNull()
    expect(meta!.sampleRate).toBe(44100)
    expect(meta!.channels).toBe(2)
    expect(meta!.format).toBe('flac')
    expect(meta!.duration).toBeCloseTo(120, 1)
    expect(meta!.fileSize).toBe(buf.length)
  })

  test('parses STREAMINFO: 96000 Hz stereo 24-bit', async () => {
    const totalSamples = 96000 * 60
    const buf = buildFlacBuffer({ sampleRate: 96000, channels: 2, bitsPerSample: 24, totalSamples })
    const p = await writeTmp('test2.flac', buf)
    const meta = await parseAudioMeta(p)
    expect(meta).not.toBeNull()
    expect(meta!.sampleRate).toBe(96000)
    expect(meta!.channels).toBe(2)
    expect(meta!.duration).toBeCloseTo(60, 1)
  })

  test('parses VORBIS_COMMENT tags', async () => {
    const totalSamples = 44100 * 200
    const buf = buildFlacBuffer({
      sampleRate: 44100, channels: 2, bitsPerSample: 16, totalSamples,
      tags: {
        TITLE: 'My Song',
        ARTIST: 'The Artist',
        ALBUM: 'Greatest Hits',
        DATE: '2020',
        GENRE: 'Electronic',
        TRACKNUMBER: '3',
      },
    })
    const p = await writeTmp('test3.flac', buf)
    const meta = await parseAudioMeta(p)
    expect(meta).not.toBeNull()
    expect(meta!.title).toBe('My Song')
    expect(meta!.artist).toBe('The Artist')
    expect(meta!.album).toBe('Greatest Hits')
    expect(meta!.year).toBe(2020)
    expect(meta!.genre).toBe('Electronic')
    expect(meta!.trackNumber).toBe(3)
  })

  test('parses TRACKNUMBER in N/Total format', async () => {
    const buf = buildFlacBuffer({
      sampleRate: 44100, channels: 1, bitsPerSample: 16, totalSamples: 44100,
      tags: { TRACKNUMBER: '5/12' },
    })
    const p = await writeTmp('test4.flac', buf)
    const meta = await parseAudioMeta(p)
    expect(meta!.trackNumber).toBe(5)
  })

  test('handles fLaC with ID3v2 prefix', async () => {
    // Prepend fake ID3v2-like bytes before fLaC
    const flacBuf = buildFlacBuffer({ sampleRate: 48000, channels: 2, bitsPerSample: 24, totalSamples: 48000 * 30 })
    const prefix = Buffer.alloc(128, 0)
    prefix.write('ID3', 0, 'ascii')  // fake ID3 prefix (not valid but our parser just looks for fLaC)
    const full = Buffer.concat([prefix, flacBuf])
    const p = await writeTmp('test5.flac', full)
    const meta = await parseAudioMeta(p)
    expect(meta).not.toBeNull()
    expect(meta!.sampleRate).toBe(48000)
    expect(meta!.duration).toBeCloseTo(30, 1)
  })

  test('returns null for non-FLAC extension', async () => {
    const buf = Buffer.from('not audio data')
    const p = await writeTmp('test6.mp3', buf)
    // music-metadata will fail on invalid mp3, should return null
    const meta = await parseAudioMeta(p)
    expect(meta).toBeNull()
  })
})
