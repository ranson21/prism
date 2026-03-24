export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical'

export const RISK_COLOR: Record<RiskLevel, string> = {
  low:      '#2dd4bf',  // teal — distinguishable from red under red-green colorblindness
  moderate: '#facc15',
  elevated: '#f97316',
  critical: '#ef4444',
}

export const RISK_BG: Record<RiskLevel, string> = {
  low:      'bg-teal-500/20 text-teal-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  elevated: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
}

export function riskColor(level: RiskLevel): string {
  return RISK_COLOR[level] ?? '#6b7280'
}

// Continuous color interpolation for map fills based on 0–100 score.
// Stops are tuned for perceptual separation — moderate and elevated use
// more saturated/shifted hues so they stay distinct from each other and
// from low/critical at all opacity levels.
const GRADIENT_STOPS: [number, [number, number, number]][] = [
  [0,   [0x2d, 0xd4, 0xbf]],  // teal (low) — colorblind-safe, distinct from red
  [25,  [0xfa, 0xcc, 0x15]],  // vivid yellow   (moderate)
  [50,  [0xf9, 0x73, 0x16]],  // saturated orange (elevated)
  [75,  [0xef, 0x44, 0x44]],  // red            (critical onset)
  [100, [0xdc, 0x26, 0x26]],  // deep red       (critical peak)
]

export function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(100, score))
  for (let i = 1; i < GRADIENT_STOPS.length; i++) {
    const [lo, cLo] = GRADIENT_STOPS[i - 1]
    const [hi, cHi] = GRADIENT_STOPS[i]
    if (s <= hi) {
      const t = (s - lo) / (hi - lo)
      const r = Math.round(cLo[0] + t * (cHi[0] - cLo[0]))
      const g = Math.round(cLo[1] + t * (cHi[1] - cLo[1]))
      const b = Math.round(cLo[2] + t * (cHi[2] - cLo[2]))
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }
  }
  return '#ef4444'
}

export function riskBadgeClass(level: RiskLevel): string {
  return RISK_BG[level] ?? 'bg-gray-500/20 text-gray-400'
}
