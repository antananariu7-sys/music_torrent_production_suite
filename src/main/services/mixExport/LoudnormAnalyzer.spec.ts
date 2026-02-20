import { parseLoudnormOutput } from './LoudnormAnalyzer'

jest.mock('../../utils/ffmpegRunner', () => ({
  runFfmpeg: jest.fn(),
}))

import { runFfmpeg } from '../../utils/ffmpegRunner'
import { analyzeLoudness } from './LoudnormAnalyzer'

const mockRunFfmpeg = runFfmpeg as jest.MockedFunction<typeof runFfmpeg>

/**
 * Build a realistic FFmpeg stderr string with an embedded loudnorm JSON block.
 */
function buildStderr(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    input_i: '-20.50',
    input_tp: '-3.20',
    input_lra: '8.40',
    input_thresh: '-31.20',
    output_i: '-14.00',
    output_tp: '-1.00',
    output_lra: '7.00',
    output_thresh: '-24.50',
    normalization_type: 'dynamic',
    target_offset: '0.00',
  }
  const data = { ...defaults, ...overrides }

  return [
    "Input #0, flac, from '/path/to/track.flac':",
    '  Duration: 00:03:45.00, bitrate: 1411 kb/s',
    '  Stream #0:0: Audio: flac, 44100 Hz, stereo, s16',
    '[Parsed_loudnorm_0 @ 0x12345]',
    '{',
    ...Object.entries(data).map(([k, v], i, arr) =>
      `\t"${k}" : "${v}"${i < arr.length - 1 ? ',' : ''}`
    ),
    '}',
  ].join('\n')
}

describe('parseLoudnormOutput', () => {
  it('parses a valid loudnorm JSON block from FFmpeg stderr', () => {
    const result = parseLoudnormOutput(buildStderr())

    expect(result).toEqual({
      input_i: -20.5,
      input_tp: -3.2,
      input_lra: 8.4,
      input_thresh: -31.2,
    })
  })

  it('handles integer values without decimal places', () => {
    const result = parseLoudnormOutput(
      buildStderr({ input_i: '-14', input_tp: '-1', input_lra: '11', input_thresh: '-25' })
    )

    expect(result).toEqual({
      input_i: -14,
      input_tp: -1,
      input_lra: 11,
      input_thresh: -25,
    })
  })

  it('throws when no JSON block is found', () => {
    expect(() => parseLoudnormOutput('some FFmpeg output without JSON')).toThrow(
      /no JSON block found/
    )
  })

  it('throws when JSON block is malformed', () => {
    expect(() => parseLoudnormOutput('prefix { not valid json } suffix')).toThrow(
      /Failed to parse loudnorm JSON/
    )
  })

  it('finds the last JSON block when stderr contains multiple braces', () => {
    const stderr = [
      'some { early brace } in metadata',
      'more output...',
      '{',
      '\t"input_i" : "-18.00",',
      '\t"input_tp" : "-2.00",',
      '\t"input_lra" : "9.00",',
      '\t"input_thresh" : "-28.00",',
      '\t"output_i" : "-14.00",',
      '\t"output_tp" : "-1.00",',
      '\t"output_lra" : "7.00",',
      '\t"output_thresh" : "-24.00",',
      '\t"normalization_type" : "dynamic",',
      '\t"target_offset" : "0.00"',
      '}',
    ].join('\n')

    const result = parseLoudnormOutput(stderr)
    expect(result.input_i).toBe(-18)
    expect(result.input_tp).toBe(-2)
  })
})

describe('analyzeLoudness', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls runFfmpeg with correct loudnorm arguments', async () => {
    mockRunFfmpeg.mockResolvedValue({ code: 0, stdout: '', stderr: buildStderr() })

    await analyzeLoudness('/path/to/track.flac')

    expect(mockRunFfmpeg).toHaveBeenCalledWith([
      '-i',
      '/path/to/track.flac',
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ])
  })

  it('returns parsed loudness analysis', async () => {
    mockRunFfmpeg.mockResolvedValue({
      code: 0,
      stdout: '',
      stderr: buildStderr({ input_i: '-22.30', input_tp: '-4.50' }),
    })

    const result = await analyzeLoudness('/path/to/track.flac')
    expect(result.input_i).toBeCloseTo(-22.3)
    expect(result.input_tp).toBeCloseTo(-4.5)
  })

  it('propagates ffmpegRunner errors', async () => {
    mockRunFfmpeg.mockRejectedValue(new Error('FFmpeg exited with code 1'))

    await expect(analyzeLoudness('/bad/path.flac')).rejects.toThrow(
      'FFmpeg exited with code 1'
    )
  })
})
