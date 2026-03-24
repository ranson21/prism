import type { SummaryResponse } from '../store/api'
import { riskColor } from '../lib/risk'

interface Props {
  summary: SummaryResponse
  activeFilter: string | null
  onFilter: (level: string) => void
  showTerritories: boolean
  onToggleTerritories: () => void
}

export function SummaryBar({ summary, activeFilter, onFilter, showTerritories, onToggleTerritories }: Props) {
  const { distribution, total_counties_scored } = summary
  const levels = ['critical', 'elevated', 'moderate', 'low'] as const

  return (
    <div className="flex items-center gap-6 px-4 py-3 rounded-xl bg-[#111827] border border-white/10">
      <div>
        <p className="text-xs text-slate-400">Counties Scored</p>
        <p className="text-2xl font-bold text-slate-100">{total_counties_scored.toLocaleString()}</p>
      </div>
      <div className="h-8 w-px bg-white/10" />
      {levels.map((level) => {
        const active = activeFilter === level
        return (
          <button
            key={level}
            onClick={() => onFilter(level)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer
              ${active ? 'bg-white/10 ring-1 ring-white/30' : 'hover:bg-white/5'}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: riskColor(level), boxShadow: active ? `0 0 6px ${riskColor(level)}` : 'none' }}
            />
            <div className="text-left">
              <p className="text-xs text-slate-400 capitalize">{level}</p>
              <p className="text-sm font-semibold text-slate-200">{distribution[level]}</p>
            </div>
          </button>
        )
      })}
      {activeFilter && (
        <button
          onClick={() => onFilter(activeFilter)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Clear filter ×
        </button>
      )}
      <button
        onClick={onToggleTerritories}
        title="Toggle U.S. territories (PR, GU, VI, AS, MP) — not shown on map"
        className={`ml-auto text-[10px] px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
          showTerritories
            ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
            : 'border-white/10 text-slate-500 hover:text-slate-300'
        }`}
      >
        {showTerritories ? 'Territories on' : 'Territories off'}
      </button>
    </div>
  )
}
