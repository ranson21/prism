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

export function riskBadgeClass(level: RiskLevel): string {
  return RISK_BG[level] ?? 'bg-gray-500/20 text-gray-400'
}
