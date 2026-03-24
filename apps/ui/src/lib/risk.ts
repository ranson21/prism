export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical'

export const RISK_COLOR: Record<RiskLevel, string> = {
  low:      '#2dd4bf',  // teal — colorblind-safe vs red
  moderate: '#facc15',  // vivid yellow
  elevated: '#f97316',  // orange — clearly between yellow and rose, more hue distance
  critical: '#e11d48',  // rose-red — deep magenta-red, more blue than pure red
}

export const RISK_BG: Record<RiskLevel, string> = {
  low:      'bg-teal-500/20 text-teal-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  elevated: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-rose-600/20 text-rose-400',
}

export function riskColor(level: RiskLevel): string {
  return RISK_COLOR[level] ?? '#6b7280'
}

// Continuous color interpolation for map fills based on 0–100 score.
// Stops are tuned for perceptual separation — moderate and elevated use
// more saturated/shifted hues so they stay distinct from each other and
// from low/critical at all opacity levels.
const GRADIENT_STOPS: [number, [number, number, number]][] = [
  [0,   [0x2d, 0xd4, 0xbf]],  // teal           (low)
  [25,  [0xfa, 0xcc, 0x15]],  // vivid yellow   (moderate)
  [50,  [0xf9, 0x73, 0x16]],  // orange         (elevated) — clear hue gap from yellow and rose
  [75,  [0xe1, 0x1d, 0x48]],  // rose-red       (critical onset) — magenta-shifted, more blue than pure red
  [100, [0xfb, 0x2f, 0x60]],  // bright rose    (critical peak) — vivid, high contrast
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
