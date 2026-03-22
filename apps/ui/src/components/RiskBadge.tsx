import { riskBadgeClass, type RiskLevel } from '../lib/risk'

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${riskBadgeClass(level)}`}>
      {level}
    </span>
  )
}
