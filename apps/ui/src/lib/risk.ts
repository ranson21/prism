export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical'

export const RISK_COLOR: Record<RiskLevel, string> = {
  low:      '#22c55e',
  moderate: '#eab308',
  elevated: '#f97316',
  critical: '#ef4444',
}

export const RISK_BG: Record<RiskLevel, string> = {
  low:      'bg-green-500/20 text-green-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  elevated: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
}

export function riskColor(level: RiskLevel): string {
  return RISK_COLOR[level] ?? '#6b7280'
}

// Continuous color interpolation for map fills based on 0–100 score.
// Stops match the 4 risk level boundaries: 0=low, 25=moderate, 50=elevated, 75+=critical.
const GRADIENT_STOPS: [number, [number, number, number]][] = [
  [0,   [0x22, 0xc5, 0x5e]],  // green  (low)
  [25,  [0xea, 0xb3, 0x08]],  // yellow (moderate)
  [50,  [0xf9, 0x73, 0x16]],  // orange (elevated)
  [100, [0xef, 0x44, 0x44]],  // red    (critical)
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
