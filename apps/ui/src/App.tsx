import { useState } from 'react'
import { useGetSummaryQuery, useGetRankingsQuery } from './store/api'
import { RiskMap } from './components/RiskMap'
import { RankingsTable } from './components/RankingsTable'
import { ExplainPanel } from './components/ExplainPanel'
import { SummaryBar } from './components/SummaryBar'
import { ScenarioPanel } from './components/ScenarioPanel'
import prismLogo from './assets/prism_logo.svg'

export default function App() {
  const [selectedFips, setSelectedFips] = useState<string | null>(null)
  const [showScenario, setShowScenario] = useState(false)

  const { data: summary } = useGetSummaryQuery()
  const { data: rankings, isLoading } = useGetRankingsQuery({ limit: 100 })

  const counties = rankings?.rankings ?? []

  return (
    <div className="h-screen flex flex-col bg-[#0F172A] text-slate-100">
      {/* Header */}
      <header className="px-6 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={prismLogo} alt="PRISM icon" className="h-12 w-12" />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">PRISM</h1>
            <p className="text-xs text-slate-400 mt-0.5">Prioritization of Risk &amp; Incident Support Model</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {summary && (
            <p className="text-xs text-slate-400">
              Last scored: {summary.top_counties[0]?.score_date ?? '—'}
            </p>
          )}
          <button
            onClick={() => setShowScenario((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showScenario
                ? 'bg-blue-600 text-white'
                : 'bg-[#1F2937] text-slate-300 hover:bg-[#374151]'
            }`}
          >
            {showScenario ? 'Hide Scenarios' : 'Scenario Simulator'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
        {summary && <SummaryBar summary={summary} />}

        {isLoading && (
          <div className="text-center py-20 text-slate-400">Loading risk data...</div>
        )}

        {!isLoading && !showScenario && (
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_360px_300px] gap-4">
            {/* Map */}
            <div className="flex flex-col gap-2 min-h-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider shrink-0">County Risk Heatmap</p>
              <div className="flex-1 min-h-0">
                <RiskMap
                  rankings={counties}
                  selectedFips={selectedFips}
                  onSelect={setSelectedFips}
                />
              </div>
              <p className="text-xs text-slate-500 shrink-0">
                Click a county to view explainability details. Color encodes risk level.
              </p>
            </div>

            {/* Rankings Table */}
            <RankingsTable
              rankings={counties}
              selectedFips={selectedFips}
              onSelect={setSelectedFips}
            />

            {/* Explain Panel */}
            {selectedFips ? (
              <ExplainPanel fips={selectedFips} />
            ) : (
              <div className="rounded-xl bg-[#111827] border border-white/10 flex items-center justify-center p-8 text-center">
                <p className="text-sm text-slate-400">
                  Select a county on the map or table to view risk drivers
                </p>
              </div>
            )}
          </div>
        )}

        {!isLoading && showScenario && (
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_420px] gap-4">
            {/* Map stays visible for context */}
            <div className="flex flex-col gap-2 min-h-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider shrink-0">Baseline — County Risk Heatmap</p>
              <div className="flex-1 min-h-0">
                <RiskMap
                  rankings={counties}
                  selectedFips={selectedFips}
                  onSelect={setSelectedFips}
                />
              </div>
              <p className="text-xs text-slate-500 shrink-0">
                Baseline risk. Run a scenario to see delta scores on the right.
              </p>
            </div>

            {/* Scenario Panel */}
            <ScenarioPanel onClose={() => setShowScenario(false)} />
          </div>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
        <p className="text-xs text-slate-600">
          Data sources: FEMA OpenFEMA · NWS Alerts · USGS Earthquake Catalog
        </p>
        <p className="text-xs text-slate-600">Powered by Sky Solutions LLC</p>
      </footer>
    </div>
  )
}
