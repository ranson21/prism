import { useState, useMemo, useEffect } from 'react'
import { useGetSummaryQuery, useGetRankingsQuery, type SimResult } from './store/api'
import { formatDateTime } from './lib/dates'
import { RiskMap } from './components/RiskMap'
import { RankingsTable } from './components/RankingsTable'
import { ExplainPanel } from './components/ExplainPanel'
import { SummaryBar } from './components/SummaryBar'
import { ScenarioPanel } from './components/ScenarioPanel'
import { AboutModal } from './components/AboutModal'
import { ResponsibleAIBanner } from './components/ResponsibleAIBanner'
import prismLogo from './assets/prism_logo.svg'

type Tab = 'dashboard' | 'scenarios'

const TABS: { id: Tab; label: string; description: string }[] = [
  { id: 'dashboard',  label: 'Risk Dashboard',      description: 'Live county risk rankings & explainability' },
  { id: 'scenarios',  label: 'Scenario Simulator',  description: 'Model disaster impacts & compare against baseline' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [showAbout, setShowAbout] = useState(false)
  const [selectedFips, setSelectedFips] = useState<string | null>(null)
  const [simResults, setSimResults] = useState<SimResult[] | null>(null)
  const [simFips, setSimFips] = useState<Set<string>>(new Set())
  const [focusSelected, setFocusSelected] = useState(false)

  const { data: summary } = useGetSummaryQuery()
  const { data: rankings, isLoading } = useGetRankingsQuery({ limit: 3500 })

  const counties = rankings?.rankings ?? []

  useEffect(() => {
    if (selectedFips || !counties.length) return

    const fallback = () => setSelectedFips(counties[0].fips_code)

    if (!navigator.geolocation) { fallback(); return }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const res = await fetch(
            `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lon}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`
          )
          const data = await res.json()
          const fips: string | undefined = data?.result?.geographies?.Counties?.[0]?.GEOID
          setSelectedFips(fips ?? counties[0].fips_code)
        } catch {
          fallback()
        }
      },
      fallback,
      { timeout: 5000 }
    )
  }, [counties])

  const simSelectedCounties = useMemo(
    () => counties.filter((c) => simFips.has(c.fips_code)),
    [counties, simFips]
  )

  function toggleSimFips(fips: string) {
    setSimFips((prev) => {
      const next = new Set(prev)
      next.has(fips) ? next.delete(fips) : next.add(fips)
      return next
    })
  }

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
        <button
          onClick={() => setShowAbout(true)}
          className="text-xs text-slate-400 hover:text-slate-100 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          About / Agency Pilot
        </button>
      </header>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Tab nav */}
      <nav className="px-6 border-b border-white/10 flex gap-1 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col gap-0.5 px-5 py-3 text-left transition-colors cursor-pointer group ${
              activeTab === tab.id ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-sm font-semibold">{tab.label}</span>
            <span className="text-xs">{tab.description}</span>
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
          <ResponsibleAIBanner />
        )}

        {!isLoading && activeTab === 'dashboard' && (
          <div className="flex-1 min-h-0 grid grid-cols-[360px_300px_1fr] gap-4">
            {/* Rankings Table */}
            <RankingsTable
              rankings={counties.slice(0, 100)}
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

            {/* Map */}
            <div className="flex flex-col gap-2 min-h-0">
              <p className="text-xs text-slate-400 uppercase tracking-wider shrink-0">County Risk Heatmap</p>
              <div className="flex-1 min-h-0 relative">
                <RiskMap
                  rankings={counties}
                  selectedFips={selectedFips}
                  onSelect={setSelectedFips}
                />
                <ScoreTimestamp scoreDate={summary?.top_counties[0]?.score_date} />
              </div>
              <p className="text-xs text-slate-500 shrink-0">
                Click a county to view explainability details. Color encodes risk level.
              </p>
            </div>
          </div>
        )}

        {!isLoading && activeTab === 'scenarios' && (
          <div className="flex-1 min-h-0 grid grid-cols-[420px_1fr] gap-4">
            {/* Scenario Panel */}
            <ScenarioPanel
              onResults={setSimResults}
              onReset={() => { setSimResults(null); setSimFips(new Set()); setFocusSelected(false) }}
              selectedCounties={simSelectedCounties}
              onToggleCounty={toggleSimFips}
              onClearCounties={() => { setSimFips(new Set()); setFocusSelected(false) }}
            />

            <div className="flex flex-col gap-2 min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  {simResults ? 'Simulated Risk Heatmap' : 'Baseline — County Risk Heatmap'}
                </p>
                {simFips.size > 0 && (
                  <button
                    onClick={() => setFocusSelected((v) => !v)}
                    className={`text-xs px-2 py-1 rounded cursor-pointer transition-colors ${
                      focusSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-[#1F2937] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {focusSelected ? 'Show all' : 'Focus selected'}
                  </button>
                )}
              </div>
              <div className="flex-1 min-h-0 relative">
                <RiskMap
                  rankings={scenarioCounties}
                  selectedFips={selectedFips}
                  onSelect={toggleSimFips}
                  highlightFips={simFips}
                  focusHighlighted={focusSelected}
                />
                <ScoreTimestamp scoreDate={summary?.top_counties[0]?.score_date} />
              </div>
              <p className="text-xs text-slate-500 shrink-0">
                {simResults
                  ? 'Colors reflect simulated risk levels. Clear the scenario to restore baseline.'
                  : 'Baseline risk. Run a scenario to update county colors.'}
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-white/10 flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-600">
          Data sources: FEMA OpenFEMA · NWS Alerts · USGS Earthquake Catalog
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAbout(true)}
            className="text-xs text-slate-500 hover:text-blue-400 transition-colors cursor-pointer"
          >
            Expansion Roadmap: Phase 1 → Phase 2 →
          </button>
          <p className="text-xs text-slate-600">Powered by Sky Solutions LLC</p>
        </div>
      </footer>
    </div>
  )
}

function ScoreTimestamp({ scoreDate }: { scoreDate?: string }) {
  if (!scoreDate) return null
  const { date, time } = formatDateTime(scoreDate)
  return (
    <div className="absolute top-3 right-3 text-right bg-[#0F172A]/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
      <p className="text-[10px] italic text-slate-500 leading-none">Last Scored at</p>
      <p className="text-xs font-semibold text-slate-200 mt-1 leading-none">{date}</p>
      <p className="text-[10px] text-slate-500 mt-1 leading-none">{time}</p>
    </div>
  )
}
