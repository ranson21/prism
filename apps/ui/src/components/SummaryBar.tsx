import type { SummaryResponse } from '../store/api'
import { riskColor } from '../lib/risk'

interface Props {
  summary: SummaryResponse
}

export function SummaryBar({ summary }: Props) {
  const { distribution, total_counties_scored } = summary
  const levels = ['critical', 'elevated', 'moderate', 'low'] as const

  return (
    <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-[#111827] border border-white/10">
      <div>
        <p className="text-xs text-slate-400">Counties Scored</p>
        <p className="text-2xl font-bold text-slate-100">{total_counties_scored.toLocaleString()}</p>
      </div>
      <div className="h-8 w-px bg-white/10" />
      {levels.map((level) => (
        <div key={level} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: riskColor(level) }}
          />
          <div>
            <p className="text-xs text-slate-400 capitalize">{level}</p>
            <p className="text-sm font-semibold text-slate-200">{distribution[level]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
