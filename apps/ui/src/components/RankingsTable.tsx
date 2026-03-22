import { RiskBadge } from './RiskBadge'
import type { RankedCounty } from '../store/api'

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  onSelect: (fips: string) => void
}

export function RankingsTable({ rankings, selectedFips, onSelect }: Props) {
  return (
    <div className="rounded-xl bg-[#111827] border border-white/10 overflow-hidden flex flex-col">
      <div className="px-3 py-3 border-b border-white/10 shrink-0">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          County Risk Rankings
        </h2>
      </div>
      <div className="overflow-y-auto flex-1">
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
            {rankings.map((r) => (
              <tr
                key={r.fips_code}
                onClick={() => onSelect(r.fips_code)}
                className={`cursor-pointer border-t border-white/5 transition-colors
                  ${selectedFips === r.fips_code
                    ? 'bg-white/10'
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
