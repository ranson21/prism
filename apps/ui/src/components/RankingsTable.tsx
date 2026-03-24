import { useEffect, useRef } from 'react'
import { RiskBadge } from './RiskBadge'
import { riskColor } from '../lib/risk'
import type { RankedCounty } from '../store/api'
import type { RiskLevel } from '../lib/risk'

const LIMITS = [25, 50, 100, null] as const
const LIMIT_LABELS: Record<string, string> = { '25': '25', '50': '50', '100': '100', 'null': 'All' }
const LEVELS: RiskLevel[] = ['critical', 'elevated', 'moderate', 'low']

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  hoveredFips: string | null
  onSelect: (fips: string) => void
  onHover: (fips: string | null) => void
  rankingLimit: number | null
  onLimitChange: (limit: number | null) => void
  levelFilter: string | null
  onLevelFilter: (level: string) => void
}

export function RankingsTable({
  rankings, selectedFips, hoveredFips, onSelect, onHover,
  rankingLimit, onLimitChange, levelFilter, onLevelFilter,
}: Props) {
  const selectedRowRef = useRef<HTMLTableRowElement>(null)
  const prevSelectedRef = useRef<string | null>(null)

  // Scroll selected row into view after rankings re-render (which may happen
  // after a filter update). Track prev to avoid firing on every filter change.
  useEffect(() => {
    if (selectedFips && selectedFips !== prevSelectedRef.current) {
      prevSelectedRef.current = selectedFips
    }
    if (selectedFips && selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({ behavior: 'instant', block: 'nearest' })
    }
  }, [selectedFips, rankings])

  return (
    <div className="rounded-xl bg-[#111827] border border-white/10 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/10 shrink-0 flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex-1">
          County Risk Rankings
        </h2>
        {/* Level filter pills */}
        <div className="flex items-center gap-1">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => onLevelFilter(level)}
              title={level}
              className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${levelFilter === level ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#111827] scale-125' : 'opacity-60 hover:opacity-100'}`}
              style={{ backgroundColor: riskColor(level) }}
            />
          ))}
        </div>
        <div className="w-px h-4 bg-white/10" />
        {/* Count limit selector */}
        <div className="flex items-center gap-0.5">
          {LIMITS.map(limit => (
            <button
              key={String(limit)}
              onClick={() => onLimitChange(limit)}
              className={`text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${rankingLimit === limit ? 'bg-white/15 text-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {LIMIT_LABELS[String(limit)]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        {rankings.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-slate-500">
            No counties match the current filter
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#111827] text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-right w-8">#</th>
                <th className="px-3 py-2 text-left">County, State</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-left">Level</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r) => {
                const isSelected = selectedFips === r.fips_code
                return (
                <tr
                  key={r.fips_code}
                  ref={isSelected ? selectedRowRef : null}
                  onClick={() => onSelect(r.fips_code)}
                  onMouseEnter={() => onHover(r.fips_code)}
                  onMouseLeave={() => onHover(null)}
                  style={isSelected ? { scrollMarginTop: '33px' } : undefined}
                  className={`cursor-pointer border-t border-white/5 transition-colors
                    ${isSelected
                      ? 'bg-white/10'
                      : hoveredFips === r.fips_code
                        ? 'bg-white/7'
                        : 'hover:bg-white/5'
                    }`}
                >
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{r.rank}</td>
                  <td className="px-3 py-2 text-slate-200 truncate max-w-0 w-full">
                    <span className="font-medium">{r.county_name}</span>
                    <span className="text-slate-500">, {r.state_abbr}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-mono text-slate-300 whitespace-nowrap">
                    {r.risk_score.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <RiskBadge level={r.risk_level} />
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
