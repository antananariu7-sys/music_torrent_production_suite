/**
 * Parse size string to bytes
 *
 * @param sizeStr - Size string (e.g., "1.5 GB", "500 MB")
 * @returns Size in bytes or undefined
 */
export function parseSizeToBytes(sizeStr: string): number | undefined {
  const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB|TB)/i)
  if (!match) return undefined

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  const multipliers: Record<string, number> = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  }

  return value * (multipliers[unit] || 1)
}
