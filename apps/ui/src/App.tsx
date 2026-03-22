import { useState, useMemo } from 'react'
import { useGetSummaryQuery, useGetRankingsQuery, type SimResult } from './store/api'
import { RiskMap } from './components/RiskMap'
import { RankingsTable } from './components/RankingsTable'
import { ExplainPanel } from './components/ExplainPanel'
import { SummaryBar } from './components/SummaryBar'
import { ScenarioPanel } from './components/ScenarioPanel'
import prismLogo from './assets/prism_logo.svg'

type Tab = 'dashboard' | 'scenarios'

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'dashboard',  label: 'Risk Dashboard',      description: 'Live county risk rankings & explainability' },
  { id: 'scenarios',  label: 'Scenario Simulator',  description: 'Model disaster impacts & compare against baseline' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [selectedFips, setSelectedFips] = useState<string | null>(null)
  const [simResults, setSimResults] = useState<SimResult[] | null>(null)

  const { data: summary } = useGetSummaryQuery()
  const { data: rankings, isLoading } = useGetRankingsQuery({ limit: 100 })

  const counties = rankings?.rankings ?? []

  // Merge simulated scores over baseline for the scenario map
  const scenarioCounties = useMemo(() => {
    if (!simResults) return counties
    const simByFips = new Map(simResults.map((r) => [r.fips_code, r]))
    return counties.map((c) => {
      const sim = simByFips.get(c.fips_code)
      if (!sim) return c
      return { ...c, risk_score: sim.simulated_risk_score, risk_level: sim.simulated_risk_level }
    })
  }, [counties, simResults])

  return (
    <div className="h-screen flex flex-col bg-[#0F172A] text-slate-100">
      {/* Header */}
      <header className="px-6 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src={prismLogo} alt="PRISM icon" className="h-12 w-12" />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">PRISM</h1>
            <p className="text-xs text-slate-400 mt-0.5">Prioritization of Risk &amp; Incident Support Model</p>
          </div>
        </div>
        {summary && (
          <p className="text-xs text-slate-500">
            Last scored: {summary.top_counties[0]?.score_date ?? '—'}
          </p>
        )}
      </header>

      {/* Tab nav */}
      <nav className="px-6 border-b border-white/10 flex gap-1 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col gap-0.5 px-5 py-3 text-left transition-colors group ${
              activeTab === tab.id ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-sm font-semibold">{tab.label}</span>
            <span className="text-xs">{tab.description}</span>
            {/* Active underline */}
            <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-t transition-colors ${
              activeTab === tab.id ? 'bg-blue-500' : 'bg-transparent'
            }`} />
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
        {summary && <SummaryBar summary={summary} />}

        {isLoading && (
          <div className="text-center py-20 text-slate-400">Loading risk data...</div>
        )}

        {!isLoading && activeTab === 'dashboard' && (
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

        {!isLoading && activeTab === 'scenarios' && (
          <div className="flex-1 min-h-0 grid grid-cols-[1fr_420px] gap-4">
            <div className="flex flex-col gap-2 min-h-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider shrink-0">
                {simResults ? 'Simulated Risk Heatmap' : 'Baseline — County Risk Heatmap'}
              </p>
              <div className="flex-1 min-h-0">
                <RiskMap
                  rankings={scenarioCounties}
                  selectedFips={selectedFips}
                  onSelect={setSelectedFips}
                />
              </div>
              <p className="text-xs text-slate-500 shrink-0">
                {simResults
                  ? 'Colors reflect simulated risk levels. Clear the scenario to restore baseline.'
                  : 'Baseline risk. Run a scenario to update county colors.'}
              </p>
            </div>

            {/* Scenario Panel */}
            <ScenarioPanel onResults={setSimResults} />
          </div>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-600">
          Data sources: FEMA OpenFEMA · NWS Alerts · USGS Earthquake Catalog
        </p>
        <p className="text-xs text-slate-600">Powered by Sky Solutions LLC</p>
      </footer>
    </div>
  )
}
