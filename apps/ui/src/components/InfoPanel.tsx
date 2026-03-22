import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

const STEPS = [
  {
    number: '01',
    title: 'Select a Scenario',
    body: 'Choose a preset disaster type or define a custom scenario name. Presets pre-fill a realistic severity multiplier based on historical disaster magnitudes.',
  },
  {
    number: '02',
    title: 'Set Severity Multiplier',
    body: 'The multiplier scales each county\'s baseline risk score. A 2× multiplier doubles the underlying risk signal. Scores are clamped to 0–100 to keep them comparable.',
  },
  {
    number: '03',
    title: 'Target Counties (Optional)',
    body: 'Click counties on the map to limit the simulation to specific areas — useful for modeling a regional event. Leave empty to apply the scenario nationwide.',
  },
  {
    number: '04',
    title: 'Run & Compare',
    body: 'The simulator applies your parameters against the active ML model\'s baseline scores and returns delta values (Δ) showing how much each county\'s risk would change.',
  },
]

const FACTORS = [
  { label: 'Severe Weather Alerts', description: 'Active NWS alerts weighted by severity (minor → extreme)' },
  { label: 'Disaster Declarations', description: 'FEMA major disaster declarations in the trailing 90-day window' },
  { label: 'Earthquake Activity', description: 'USGS earthquake count and max magnitude for the county region' },
  { label: 'Population Exposure', description: 'County population used to weight hazard frequency into an exposure score' },
  { label: 'Hazard Frequency', description: 'Composite rate of multi-source hazard events normalized per capita' },
  { label: 'Economic Risk', description: 'Derived from Census ACS median household income (B19013_001E) weighted by event severity. Counties with higher incomes and more severe hazard events score higher. Displayed as median household income in the explainability panel.' },
]

export function InfoPanel({ onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[420px] bg-[#111827] border-l border-white/10 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">How the Scenario Simulator Works</h2>
            <p className="text-xs text-slate-400 mt-0.5">Model-backed risk simulation explained</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-8">
          {/* Steps */}
          <section>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Simulation Steps</p>
            <div className="space-y-4">
              {STEPS.map((s) => (
                <div key={s.number} className="flex gap-4">
                  <span className="text-lg font-bold tabular-nums text-slate-700 w-8 shrink-0">{s.number}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">{s.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Score formula */}
          <section>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Score Calculation</p>
            <div className="bg-[#1F2937] rounded-xl px-4 py-4 space-y-2">
              <p className="text-xs text-slate-400">Simulated score formula:</p>
              <p className="font-mono text-sm text-sky-300">
                sim_score = clamp(baseline × multiplier, 0, 100)
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">
                Delta (Δ) is the difference between the simulated and baseline score.
                Positive deltas indicate increased risk under the scenario.
              </p>
            </div>
          </section>

          {/* Risk factors */}
          <section>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Risk Factors</p>
            <div className="space-y-3">
              {FACTORS.map((f) => (
                <div key={f.label} className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-slate-200">{f.label}</p>
                    <p className="text-xs text-slate-500">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <section className="bg-yellow-900/20 border border-yellow-500/20 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-yellow-400 mb-1">Decision Support Tool</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              PRISM is a probabilistic decision-support system, not a deterministic predictor.
              Scenario outputs reflect modeled risk signals — not guaranteed outcomes.
              Always cross-reference with domain expertise and official advisories.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
