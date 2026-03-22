import { useState } from 'react'
import { useSimulateMutation, type SimResult } from '../store/api'
import { RiskBadge } from './RiskBadge'
import { riskColor } from '../lib/risk'

const PRESETS = [
  { label: 'Category 5 Hurricane', multiplier: 3.5, description: 'Major hurricane landfalls across Gulf and Atlantic coast counties' },
  { label: 'Severe Drought Season', multiplier: 2.0, description: 'Extended drought compounding wildfire and agricultural risk' },
  { label: 'Major Earthquake Swarm', multiplier: 4.0, description: 'Significant seismic sequence in high-exposure regions' },
  { label: 'Flooding Event', multiplier: 2.5, description: 'Regional flooding from prolonged precipitation' },
]

interface Props {
  onResults: (results: SimResult[] | null) => void
}

export function ScenarioPanel({ onResults }: Props) {
  const [simulate, { isLoading, data, reset }] = useSimulateMutation()
  const [multiplier, setMultiplier] = useState(2.0)
  const [scenarioName, setScenarioName] = useState('Custom Scenario')

  function applyPreset(preset: typeof PRESETS[number]) {
    setMultiplier(preset.multiplier)
    setScenarioName(preset.label)
  }

  async function run() {
    const result = await simulate({ name: scenarioName, severity_multiplier: multiplier })
    if ('data' in result && result.data) onResults(result.data.results)
  }

  function clear() {
    reset()
    onResults(null)
  }

  return (
    <div className="rounded-xl bg-[#111827] border border-white/10 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Scenario Simulator</h2>
          <p className="text-xs text-slate-400 mt-0.5">Apply severity multipliers and compare against baseline</p>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-white/10 space-y-4">
        {/* Presets */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="text-left rounded-lg bg-[#1F2937] hover:bg-[#374151] px-3 py-2 transition-colors"
              >
                <p className="text-xs font-medium text-slate-200">{p.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{p.multiplier}× severity</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom controls */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Scenario Name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Severity Multiplier — <span className="text-slate-200 font-mono">{multiplier.toFixed(1)}×</span>
            </label>
            <input
              type="range"
              min={0.1}
              max={5.0}
              step={0.1}
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0.1× (minimal)</span>
              <span>5.0× (catastrophic)</span>
            </div>
          </div>
        </div>

        <button
          onClick={run}
          disabled={isLoading || !scenarioName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {isLoading ? 'Running simulation…' : 'Run Simulation'}
        </button>
      </div>

      {/* Results */}
      {data && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{data.name} — {data.total} counties</p>
            <button onClick={clear} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          </div>
          <div className="divide-y divide-white/5">
            {data.results.slice(0, 50).map((r) => (
              <ResultRow key={r.fips_code} result={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultRow({ result: r }: { result: SimResult }) {
  const deltaColor = r.delta_from_baseline > 5
    ? '#ef4444'
    : r.delta_from_baseline > 0
    ? '#f97316'
    : '#22c55e'

  return (
    <div className="px-4 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{r.county_name}, {r.state_abbr}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-slate-500">
            Baseline <span className="font-mono text-slate-400">{r.baseline_score.toFixed(1)}</span>
          </span>
          <span className="text-[10px] text-slate-500">→</span>
          <span className="text-[10px] font-mono" style={{ color: riskColor(r.simulated_risk_level) }}>
            {r.simulated_risk_score.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-mono font-medium" style={{ color: deltaColor }}>
          {r.delta_from_baseline > 0 ? '+' : ''}{r.delta_from_baseline.toFixed(1)}
        </span>
        <RiskBadge level={r.simulated_risk_level} />
      </div>
    </div>
  )
}
