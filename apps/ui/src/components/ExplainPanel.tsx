import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { RiskBadge } from './RiskBadge'
import { riskColor } from '../lib/risk'
import { formatDate } from '../lib/dates'
import { useGetCountyDetailQuery } from '../store/api'

const FACTOR_LABEL: Record<string, string> = {
  severe_weather_count:      'Severe Weather',
  hazard_frequency_score:    'Hazard Frequency',
  population_exposure:       'Population Exposure',
  earthquake_count:          'Earthquakes',
  max_earthquake_magnitude:  'Max Magnitude',
  disaster_count:            'Disasters',
}

interface Props {
  fips: string
}

export function ExplainPanel({ fips }: Props) {
  const { data, isLoading, isError } = useGetCountyDetailQuery(fips)

  if (isLoading) return <PanelShell><p className="text-slate-400 text-sm p-4">Loading...</p></PanelShell>
  if (isError || !data) return <PanelShell><p className="text-slate-400 text-sm p-4">County not found.</p></PanelShell>

  const chartData = data.top_drivers.map((d) => ({
    name: FACTOR_LABEL[d.factor] ?? d.factor,
    contribution: Math.round(d.contribution * 100),
    fill: riskColor(data.risk_level),
  }))

  return (
    <PanelShell>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{data.state_name}</p>
          <h2 className="text-base font-semibold text-slate-100">{data.county_name}</h2>
        </div>
        <RiskBadge level={data.risk_level} />
      </div>

      {/* Score */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-6">
        <div>
          <p className="text-xs text-slate-400 mb-1">Risk Score</p>
          <p className="text-4xl font-bold tabular-nums" style={{ color: riskColor(data.risk_level) }}>
            {data.risk_score.toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 mt-1">out of 100</p>
        </div>
        <div className="text-sm text-slate-400 space-y-1">
          <p>Population: <span className="text-slate-200">{data.population?.toLocaleString() ?? 'N/A'}</span></p>
          <p>Score date: <span className="text-slate-200">{formatDate(data.score_date)}</span></p>
          <p>FIPS: <span className="text-slate-200 font-mono">{data.fips_code}</span></p>
        </div>
      </div>

      {/* Top Drivers Chart */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Top Risk Drivers</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#cbd5e1' }} width={120} />
            <Tooltip
              formatter={(v) => [`${v}%`, 'Contribution']}
              contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Raw feature counts */}
      <div className="px-4 py-4 grid grid-cols-2 gap-2">
        {[
          ['Severe Weather Alerts', data.features.severe_weather_count],
          ['Earthquake Events', data.features.earthquake_count],
          ['Disaster Declarations', data.features.disaster_count],
          ['Major Disasters', data.features.major_disaster_count],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-[#1F2937] rounded-lg px-3 py-2">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-lg font-semibold text-slate-100">{val}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#111827] border border-white/10 overflow-hidden h-full">
      {children}
    </div>
  )
}
