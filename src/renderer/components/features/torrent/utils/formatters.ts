export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let speed = bytesPerSec
  let i = 0
  while (speed >= 1024 && i < units.length - 1) {
    speed /= 1024
    i++
  }
  return `${speed.toFixed(1)} ${units[i]}`
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export function formatEta(remainingBytes: number, speedBps: number): string {
  if (speedBps <= 0) return '∞'
  const seconds = Math.round(remainingBytes / speedBps)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

export const STATUS_COLOR: Record<string, string> = {
  queued: 'gray',
  downloading: 'blue',
  seeding: 'green',
  paused: 'yellow',
  completed: 'green',
  error: 'red',
  'awaiting-file-selection': 'purple',
}
