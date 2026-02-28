/**
 * Shared gain-curve generators for crossfade and volume automation.
 *
 * Used by WebAudioEngine (crossfade scheduling) and potentially
 * future volume envelope features.
 */

import type { CrossfadeCurveType } from '@shared/types/project.types'

export function generateFadeOutCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    switch (type) {
      case 'linear':
        curve[i] = 1 - t
        break
      case 'equal-power':
        curve[i] = Math.cos(t * Math.PI * 0.5)
        break
      case 's-curve':
        curve[i] = (1 + Math.cos(t * Math.PI)) / 2
        break
    }
  }
  return curve
}

export function generateFadeInCurve(
  type: CrossfadeCurveType,
  samples: number
): Float32Array {
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    switch (type) {
      case 'linear':
        curve[i] = t
        break
      case 'equal-power':
        curve[i] = Math.sin(t * Math.PI * 0.5)
        break
      case 's-curve':
        curve[i] = (1 - Math.cos(t * Math.PI)) / 2
        break
    }
  }
  return curve
}
