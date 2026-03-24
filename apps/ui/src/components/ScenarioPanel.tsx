import { useState } from 'react'
import { RotateCcw, Info } from 'lucide-react'
import { useSimulateMutation, type SimResult, type RankedCounty } from '../store/api'
import { RiskBadge } from './RiskBadge'
import { riskColor } from '../lib/risk'
import { InfoPanel } from './InfoPanel'

const PRESETS = [
  { label: 'Category 5 Hurricane', multiplier: 3.5, description: 'Major hurricane landfalls across Gulf and Atlantic coast counties' },
  { label: 'Severe Drought Season', multiplier: 2.0, description: 'Extended drought compounding wildfire and agricultural risk' },
  { label: 'Major Earthquake Swarm', multiplier: 4.0, description: 'Significant seismic sequence in high-exposure regions' },
  { label: 'Flooding Event', multiplier: 2.5, description: 'Regional flooding from prolonged precipitation' },
]

interface Props {
  onResults: (results: SimResult[] | null) => void
  onReset: () => void
  selectedCounties: RankedCounty[]
  onToggleCounty: (fips: string) => void
  onClearCounties: () => void
}

export function ScenarioPanel({ onResults, onReset, selectedCounties, onToggleCounty, onClearCounties }: Props) {
  const [simulate, { isLoading, data, reset }] = useSimulateMutation()
  const [multiplier, setMultiplier] = useState(2.0)
  const [scenarioName, setScenarioName] = useState('Custom Scenario')
  const [resourceUnits, setResourceUnits] = useState(50)
  const [showInfo, setShowInfo] = useState(false)

  function applyPreset(preset: typeof PRESETS[number]) {
    setMultiplier(preset.multiplier)
    setScenarioName(preset.label)
  }

  async function run() {
    const body = {
      name: scenarioName,
      severity_multiplier: multiplier,
      resource_units: resourceUnits,
      ...(selectedCounties.length > 0 && { fips_codes: selectedCounties.map((c) => c.fips_code) }),
    }
    const result = await simulate(body)
    if ('data' in result && result.data) onResults(result.data.results)
  }

  function handleReset() {
    reset()
    onReset()
  }

  return (
    <>
    {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}
    <div className="rounded-xl bg-[#111827] border border-white/10 overflow-hidden flex flex-col min-h-[500px] lg:h-full lg:min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={`cursor-pointer transition-colors ${showInfo ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'}`}
            aria-label="How the scenario simulator works"
          >
            <Info size={16} />
          </button>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Scenario Simulator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Apply severity multipliers and compare against baseline</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={!data}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed
            bg-red-900/40 text-red-400 hover:bg-red-900/70 hover:text-red-300 disabled:hover:bg-red-900/40 disabled:hover:text-red-400"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Scrollable controls — hidden entirely on short viewports when results are present */}
      <div
        className={`overflow-y-auto min-h-0 px-4 py-4 space-y-4${data ? ' [@media(max-height:900px)]:hidden' : ''}`}
        style={{ flex: data ? '0 1 auto' : '1 1 auto' }}
      >
        {/* Presets */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="text-left rounded-lg bg-[#1F2937] hover:bg-[#374151] px-3 py-2 transition-colors cursor-pointer"
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
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Resource Units — <span className="text-slate-200 font-mono">{resourceUnits}</span>
              <span className="ml-1 text-slate-600 text-[10px]">(teams pre-positioned)</span>
            </label>
            <input
              type="range"
              min={0}
              max={500}
              step={5}
              value={resourceUnits}
              onChange={(e) => setResourceUnits(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
              <span>0 (none)</span>
              <span>500 (max)</span>
            </div>
          </div>
        </div>

        {/* County selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Target Counties
              <span className="ml-2 normal-case text-slate-500">
                {selectedCounties.length === 0 ? '— all counties' : `${selectedCounties.length} selected`}
              </span>
            </p>
            {selectedCounties.length > 0 && (
              <button onClick={onClearCounties} className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer">
                Clear
              </button>
            )}
          </div>
          {selectedCounties.length === 0 ? (
            <p className="text-[11px] text-slate-600 bg-[#1F2937] rounded-lg px-3 py-2">
              Click counties on the map to target specific areas, or leave empty to simulate all.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {selectedCounties.map((c) => (
                <button
                  key={c.fips_code}
                  onClick={() => onToggleCounty(c.fips_code)}
                  className="inline-flex items-center gap-1 bg-sky-900/50 border border-sky-500/30 text-sky-300 text-[11px] rounded px-2 py-0.5 cursor-pointer hover:bg-sky-900 transition-colors"
                >
                  {c.county_name}, {c.state_abbr}
                  <span className="text-sky-500 leading-none">×</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run button — always visible, pinned above results */}
      <div className="px-4 py-3 border-t border-b border-white/10 shrink-0">
        <button
          onClick={run}
          disabled={isLoading || !scenarioName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {isLoading ? 'Running simulation…' : 'Run Simulation'}
        </button>
      </div>

      {/* Results */}
      {data && (
        <div className="min-h-[300px] lg:flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 shrink-0 space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">{data.name} — {data.total} counties</p>
            {data.resource_units > 0 && (
              <div className="flex gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  {data.total_allocated} allocated
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  {data.total_unmet} unmet need
                </span>
              </div>
            )}
          </div>
          <div className="divide-y divide-white/5">
            {data.results.slice(0, 50).map((r) => (
              <ResultRow key={r.fips_code} result={r} showAllocation={data.resource_units > 0} />
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function ResultRow({ result: r, showAllocation }: { result: SimResult; showAllocation: boolean }) {
  const deltaColor = r.delta_from_baseline > 5
    ? '#ef4444'
    : r.delta_from_baseline > 0
    ? '#f97316'
    : '#22c55e'

  return (
    <div className={`px-4 py-2.5 flex items-center gap-3 ${r.allocated_resources > 0 ? 'bg-emerald-950/30' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-slate-200 truncate">{r.county_name}, {r.state_abbr}</p>
          {showAllocation && r.allocated_resources > 0 && (
            <span className="shrink-0 text-[9px] font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-700/40 rounded px-1.5 py-0.5">
              DEPLOYED
            </span>
          )}
          {showAllocation && r.unmet_need && (
            <span className="shrink-0 text-[9px] font-medium bg-amber-900/60 text-amber-300 border border-amber-700/40 rounded px-1.5 py-0.5">
              UNMET
            </span>
          )}
        </div>
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
