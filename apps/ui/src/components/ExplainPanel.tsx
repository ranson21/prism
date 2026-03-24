import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts'
import { RiskBadge } from './RiskBadge'
import { riskColor } from '../lib/risk'
import { formatDate } from '../lib/dates'
import { useGetCountyDetailQuery, useGetCountyHistoryQuery } from '../store/api'

const FACTOR_LABEL: Record<string, string> = {
  major_disaster_count:      'Major Disasters (FEMA)',
  severe_weather_count:      'Severe Weather',
  hazard_frequency_score:    'Hazard Frequency',
  population_exposure:       'Population Exposure',
  economic_exposure:         'Economic Risk',
  earthquake_count:          'Earthquakes',
  max_earthquake_magnitude:  'Max Magnitude',
  disaster_count:            'Disasters',
  log_population:            'Population Scale',
  income_vulnerability:      'Income Vulnerability',
}

type PanelTab = 'drivers' | 'history'

interface Props {
  fips: string
}

export function ExplainPanel({ fips }: Props) {
  const [tab, setTab] = useState<PanelTab>('drivers')
  const { data, isLoading, isError } = useGetCountyDetailQuery(fips)

  if (isLoading) return <PanelShell tab={tab} onTab={setTab}><p className="text-slate-400 text-sm p-4">Loading...</p></PanelShell>
  if (isError || !data) return <PanelShell tab={tab} onTab={setTab}><p className="text-slate-400 text-sm p-4">County not found.</p></PanelShell>

  const chartData = data.top_drivers.map((d) => ({
    name: FACTOR_LABEL[d.factor] ?? d.factor,
    contribution: Math.round(d.contribution * 100),
    fill: riskColor(data.risk_level),
  }))

  return (
    <PanelShell tab={tab} onTab={setTab}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <p className="text-xs text-slate-400">{data.state_name}</p>
          <h2 className="text-base font-semibold text-slate-100">{data.county_name}</h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <RiskBadge level={data.risk_level} />
          {data.cluster_label && (
            <span className="text-[10px] font-medium text-slate-300 bg-slate-700/60 border border-white/10 rounded px-2 py-0.5 whitespace-nowrap">
              {data.cluster_label}
            </span>
          )}
        </div>
      </div>

      {/* Score row */}
      <div className="px-4 py-4 border-b border-white/10 shrink-0 space-y-3">
        <div className="flex items-center gap-6">
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
        <ConfidenceBar
          score={data.risk_score}
          lower={data.confidence_lower}
          upper={data.confidence_upper}
          color={riskColor(data.risk_level)}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'drivers' ? (
          <>
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
                ['Major Disasters (FEMA)', data.features.major_disaster_count],
                ['Median Household Income', data.median_household_income != null
                  ? `$${Number(data.median_household_income).toLocaleString('en-US')}`
                  : 'N/A'],
              ].map(([label, val]) => (
                <div key={String(label)} className="bg-[#1F2937] rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-lg font-semibold text-slate-100">{val}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <HistoryTab fips={fips} currentScore={data.risk_score} currentLevel={data.risk_level} />
        )}
      </div>
    </PanelShell>
  )
}

function ConfidenceBar({ score, lower, upper, color }: {
  score: number
  lower: number
  upper: number
  color: string
}) {
  const lo = Math.max(0, lower)
  const hi = Math.min(100, upper)
  const bandLeft = `${lo}%`
  const bandWidth = `${Math.max(0, hi - lo)}%`
  const scoreLeft = `${Math.min(100, Math.max(0, score))}%`

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span className="group relative inline-flex items-center gap-1 cursor-default">
          Confidence band
          <span className="text-slate-600 text-[10px] leading-none">ⓘ</span>
          <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-[#0F172A] border border-white/10 px-3 py-2 text-xs text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 shadow-xl">
            Range of risk scores across all decision trees in the model. A narrow band means the trees agree; a wide band signals higher uncertainty.
          </span>
        </span>
        <span className="tabular-nums">{lo.toFixed(1)} – {hi.toFixed(1)}</span>
      </div>
      <div className="relative h-3 rounded-full bg-[#1F2937] overflow-hidden">
        {/* Confidence band */}
        <div
          className="absolute top-0 h-full rounded-full"
          style={{ left: bandLeft, width: bandWidth, background: color, opacity: 0.2 }}
        />
        {/* Score tick */}
        <div
          className="absolute top-0 h-full w-0.5 rounded-full -translate-x-1/2"
          style={{ left: scoreLeft, background: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-0.5">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}

function HistoryTab({ fips: fipsCode, currentScore, currentLevel }: { fips: string; currentScore: number; currentLevel: string }) {
  const { data, isLoading } = useGetCountyHistoryQuery(fipsCode)

  if (isLoading) return <p className="text-slate-400 text-sm p-4">Loading history...</p>
  if (!data || data.history.length === 0) return <p className="text-slate-400 text-sm p-4">No historical data available.</p>

  const chartData = data.history.map((h) => ({
    date: h.score_date.slice(0, 7), // YYYY-MM
    score: h.risk_score,
    level: h.risk_level,
  }))

  const color = riskColor(currentLevel as any)
  const scores = chartData.map((d) => d.score)
  const min = Math.max(0, Math.floor((Math.min(...scores) - 10) / 5) * 5)
  const max = Math.min(100, Math.ceil((Math.max(...scores) + 10) / 5) * 5)

  return (
    <div className="px-4 pt-4 pb-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Risk Score Trend</p>
      <p className="text-xs text-slate-500 mb-4">Historical vs current prediction</p>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis domain={[min, max]} tickCount={6} tickFormatter={(v) => Math.round(v).toString()} tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
          <Tooltip
            formatter={(v) => [Number(v).toFixed(1), 'Risk Score']}
            contentStyle={{ background: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
          />
          <ReferenceLine y={currentScore} stroke={color} strokeDasharray="4 2" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-500 mt-3">Dashed line = current score. Each point is a monthly model run.</p>

      {/* Trend summary */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['First Score', chartData[0]?.score.toFixed(1) ?? '—'],
          ['Current', currentScore.toFixed(1)],
          ['Δ Change', (() => {
            const first = chartData[0]?.score
            if (first == null) return '—'
            const delta = currentScore - first
            return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`
          })()],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-[#1F2937] rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-base font-semibold text-slate-100">{val}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PanelShell({ tab, onTab, children }: {
  tab: PanelTab
  onTab: (t: PanelTab) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-[#111827] border border-white/10 h-full flex flex-col overflow-hidden">
      {/* Tab bar at top */}
      <div className="shrink-0 border-b border-white/10 flex">
        {(['drivers', 'history'] as PanelTab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
              tab === t
                ? 'text-slate-100 border-b-2 border-blue-500 bg-[#111827]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t === 'drivers' ? 'Risk Drivers' : 'History'}
          </button>
        ))}
      </div>
      {children}
    </div>
  )
}
