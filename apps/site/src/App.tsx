import { useState, useEffect } from 'react'
import { Shield, BarChart3, Map, Zap, CheckCircle, AlertTriangle, TrendingUp, Database, ChevronRight, ChevronLeft, Clock } from 'lucide-react'
import prismLogo from './assets/prism_logo.svg'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3000'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <Nav />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <ExplainabilitySection />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  )
}

/* ── Nav ─────────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={prismLogo} alt="PRISM" className="h-9 w-9" />
          <span className="text-base font-bold tracking-tight">PRISM</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#how-it-works" className="text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">How It Works</a>
          <a href="#explainability" className="text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">Explainability</a>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors cursor-pointer"
          >
            Open Dashboard <ChevronRight size={14} />
          </a>
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="pt-40 pb-28 px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/15 border border-blue-500/25 text-blue-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI-Powered Disaster Risk Intelligence
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight mb-6">
          Prioritize Response.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-300">
            Before Disaster Strikes.
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          PRISM aggregates public disaster, weather, and seismic data to produce
          explainable county-level risk scores — giving emergency managers
          the clarity to act before resources run out.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-sm transition-colors cursor-pointer shadow-lg shadow-blue-600/25"
          >
            Open Live Dashboard <ChevronRight size={16} />
          </a>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold text-sm transition-colors cursor-pointer"
          >
            See How It Works
          </a>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-600">
          {['FEMA OpenFEMA', 'NOAA / NWS', 'USGS Earthquake Catalog', 'U.S. Census Bureau'].map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <Database size={11} className="text-slate-700" /> {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Problem ─────────────────────────────────────────────────────────── */

function ProblemSection() {
  const problems = [
    {
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      title: 'Fragmented Data, Delayed Action',
      body: 'Emergency managers pull from dozens of disconnected systems — FEMA declarations, weather alerts, seismic feeds — losing critical hours assembling a complete picture.',
    },
    {
      icon: TrendingUp,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      title: 'Reactive, Not Proactive',
      body: 'Resource allocation decisions happen after damage is done. Without predictive risk signals, limited assets are deployed to the loudest voice, not the highest need.',
    },
    {
      icon: BarChart3,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      title: 'No Explainability',
      body: 'Black-box risk scores erode trust. Decision-makers need to know not just where risk is highest — but why, and what is driving it.',
    },
  ]

  return (
    <section className="py-24 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <SectionLabel>The Problem</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 max-w-2xl">
          When disaster strikes, every minute of indecision costs lives.
        </h2>
        <p className="text-slate-400 max-w-xl mb-16">
          The current state of emergency risk intelligence is fragmented, reactive, and opaque.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <div key={p.title} className="rounded-2xl bg-[#111827] border border-white/10 p-6">
              <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center mb-4`}>
                <p.icon size={20} className={p.color} />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-2">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Solution ────────────────────────────────────────────────────────── */

function SolutionSection() {
  const capabilities = [
    'County-level risk scores updated from live public feeds',
    'Explainable AI — every score shows its top contributing factors',
    'Economic risk proxy from Census ACS median household income',
    'Historical trend comparison — track how risk has shifted over time',
    'Scenario simulation to model hypothetical disaster impacts',
    'Ranked prioritization so resources go to highest-need counties first',
    'Built on open public data — FEMA, NWS, USGS, Census Bureau',
    'Designed for auditability and transparency, not black-box inference',
  ]

  return (
    <section className="py-24 px-6 bg-gradient-to-b from-[#0F172A] to-[#0a1020]">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <SectionLabel>The Solution</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            One unified intelligence platform for disaster risk.
          </h2>
          <p className="text-slate-400 leading-relaxed mb-10">
            PRISM combines real-time public hazard data with machine learning to produce
            explainable, ranked county risk scores — giving emergency managers a single
            source of truth for resource prioritization.
          </p>
          <ul className="space-y-3">
            {capabilities.map((c) => (
              <li key={c} className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-[#111827] border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Top Risk Counties</p>
            <span className="text-xs text-slate-600">Live</span>
          </div>
          {[
            { county: 'San Diego County', state: 'CA', score: 81.4, level: 'critical' },
            { county: 'Honolulu County', state: 'HI', score: 74.2, level: 'elevated' },
            { county: 'Los Angeles County', state: 'CA', score: 68.9, level: 'elevated' },
            { county: 'Harris County', state: 'TX', score: 54.1, level: 'moderate' },
            { county: 'Miami-Dade County', state: 'FL', score: 49.7, level: 'moderate' },
          ].map((r, i) => (
            <div key={r.county} className="flex items-center gap-3 py-2.5 border-t border-white/5">
              <span className="text-xs text-slate-700 w-4 tabular-nums">{i + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-200">{r.county}, <span className="text-slate-500">{r.state}</span></p>
              </div>
              <span className="font-mono text-sm tabular-nums text-slate-300">{r.score}</span>
              <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                r.level === 'critical' ? 'bg-red-500/15 text-red-400' :
                r.level === 'elevated' ? 'bg-orange-500/15 text-orange-400' :
                'bg-yellow-500/15 text-yellow-400'
              }`}>{r.level}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── How It Works ────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: Database,
      title: 'Ingest Public Hazard Data',
      body: 'PRISM continuously pulls from FEMA disaster declarations, NWS weather alerts, and USGS earthquake feeds — normalizing them into a unified event stream.',
    },
    {
      number: '02',
      icon: BarChart3,
      title: 'Engineer Risk Features',
      body: 'Raw events are aggregated per county into quantitative features: disaster frequency, weather severity, seismic magnitude, population exposure, and economic risk derived from Census ACS median household income — all over a 90-day rolling window.',
    },
    {
      number: '03',
      icon: Zap,
      title: 'Score with Explainable ML',
      body: 'A domain-weighted composite index (FEMA NRI methodology) produces a 0–100 risk score per county. K-Means clustering assigns each county to one of five risk tiers. Every score is traceable to named, interpretable factors — no black-box inference.',
    },
    {
      number: '04',
      icon: Map,
      title: 'Prioritize & Act',
      body: 'The dashboard ranks counties by risk, visualizes them on a choropleth map, and lets planners run scenario simulations to model how disasters would shift the risk landscape.',
    },
  ]

  return (
    <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <SectionLabel>How It Works</SectionLabel>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          From raw data to actionable intelligence in four steps.
        </h2>
        <p className="text-slate-400 max-w-xl mb-16">
          A fully automated pipeline — from public APIs to ranked risk scores — updated continuously.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.number}>
              <div className="rounded-2xl bg-[#111827] border border-white/10 p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-bold tabular-nums text-slate-800">{s.number}</span>
                  <div className="w-9 h-9 rounded-lg bg-blue-600/15 flex items-center justify-center">
                    <s.icon size={18} className="text-blue-400" />
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">{s.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Explainability ──────────────────────────────────────────────────── */

const EXAMPLE_COUNTIES = [
  {
    county: 'San Diego County, CA',
    score: 81.4,
    level: 'critical' as const,
    trend: '+4.2',
    trendDir: 'up' as const,
    drivers: [
      { label: 'Severe Weather', value: 72 },
      { label: 'Hazard Frequency', value: 58 },
      { label: 'Population Exposure', value: 44 },
      { label: 'Economic Risk', value: 36 },
      { label: 'Earthquake Activity', value: 19 },
    ],
    stats: [['Weather Alerts', '47'], ['Major Disasters', '8'], ['Earthquake Events', '3'], ['Median HH Income', '$72,184']],
  },
  {
    county: 'Honolulu County, HI',
    score: 55.3,
    level: 'elevated' as const,
    trend: '-1.2',
    trendDir: 'down' as const,
    drivers: [
      { label: 'Hazard Frequency', value: 64 },
      { label: 'Severe Weather', value: 48 },
      { label: 'Economic Risk', value: 28 },
      { label: 'Population Exposure', value: 21 },
      { label: 'Earthquake Activity', value: 11 },
    ],
    stats: [['Weather Alerts', '42'], ['Major Disasters', '0'], ['Earthquake Events', '0'], ['Median HH Income', '$85,857']],
  },
  {
    county: 'Harris County, TX',
    score: 34.1,
    level: 'moderate' as const,
    trend: '+2.8',
    trendDir: 'up' as const,
    drivers: [
      { label: 'Population Exposure', value: 55 },
      { label: 'Severe Weather', value: 38 },
      { label: 'Economic Risk', value: 22 },
      { label: 'Disaster Declarations', value: 14 },
      { label: 'Hazard Frequency', value: 9 },
    ],
    stats: [['Weather Alerts', '18'], ['Major Disasters', '3'], ['Earthquake Events', '0'], ['Median HH Income', '$57,791']],
  },
  {
    county: 'Laramie County, WY',
    score: 12.8,
    level: 'low' as const,
    trend: '-0.5',
    trendDir: 'down' as const,
    drivers: [
      { label: 'Hazard Frequency', value: 31 },
      { label: 'Earthquake Activity', value: 22 },
      { label: 'Severe Weather', value: 18 },
      { label: 'Population Exposure', value: 12 },
      { label: 'Economic Risk', value: 7 },
    ],
    stats: [['Weather Alerts', '4'], ['Major Disasters', '0'], ['Earthquake Events', '1'], ['Median HH Income', '$61,394']],
  },
]

const LEVEL_STYLES = {
  critical: { bar: 'bg-red-500/80',    badge: 'bg-red-500/15 text-red-400',    score: 'text-red-400'    },
  elevated: { bar: 'bg-orange-500/80', badge: 'bg-orange-500/15 text-orange-400', score: 'text-orange-400' },
  moderate: { bar: 'bg-yellow-500/80', badge: 'bg-yellow-500/15 text-yellow-400', score: 'text-yellow-400' },
  low:      { bar: 'bg-green-500/80',  badge: 'bg-green-500/15 text-green-400',  score: 'text-green-400'  },
}

function ExplainabilitySection() {
  const [idx, setIdx] = useState(0)

  function goTo(next: number) {
    setIdx((next + EXAMPLE_COUNTIES.length) % EXAMPLE_COUNTIES.length)
  }

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % EXAMPLE_COUNTIES.length), 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <section id="explainability" className="py-24 px-6 border-t border-white/5">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* Carousel card */}
        <div className="relative">
          {/* All cards stacked in the same grid cell — CSS crossfade, nothing unmounts */}
          <div className="grid" aria-live="polite" aria-atomic="true">
            {EXAMPLE_COUNTIES.map((c, i) => {
              const s = LEVEL_STYLES[c.level]
              return (
                <div
                  key={c.county}
                  aria-hidden={i !== idx}
                  className="[grid-column:1] [grid-row:1] rounded-2xl bg-[#111827] border border-white/10 p-6 transition-opacity duration-700 ease-in-out motion-reduce:transition-none"
                  style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? 'auto' : 'none', zIndex: i === idx ? 1 : 0 }}
                >
                  {/* Header */}
                  <div className="mb-5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Risk Explainability</p>
                    <p className="text-lg font-semibold text-slate-100">{c.county}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-3xl font-bold tabular-nums ${s.score}`}>{c.score}</span>
                      <span className="text-xs text-slate-500">/ 100</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold uppercase ${s.badge}`}>{c.level}</span>
                    </div>
                  </div>

                  {/* Drivers */}
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Top Risk Drivers</p>
                  <div className="space-y-3">
                    {c.drivers.map((d) => (
                      <div key={d.label}>
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{d.label}</span>
                          <span className="font-mono">{d.value}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#1F2937]">
                          <div className={`h-1.5 rounded-full ${s.bar}`} style={{ width: `${d.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stat cards */}
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {c.stats.map(([label, val]) => (
                      <div key={label} className="bg-[#1F2937] rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="text-base font-semibold text-slate-100">{val}</p>
                      </div>
                    ))}
                  </div>

                  {/* Trend */}
                  <div className="mt-3 border-t border-white/5 pt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={11} className="text-slate-600" />
                    <span>
                      6-month trend — risk{' '}
                      <span className={`font-medium ${c.trendDir === 'up' ? 'text-orange-400' : 'text-green-400'}`}>
                        {c.trend}
                      </span>{' '}
                      since Sep 2025
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 px-1">
            <button
              onClick={() => goTo(idx - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1F2937] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex gap-2">
              {EXAMPLE_COUNTIES.map((c, i) => (
                <button
                  key={c.county}
                  onClick={() => goTo(i)}
                  className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                    i === idx ? 'bg-blue-500 w-4' : 'bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => goTo(idx + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1F2937] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div>
          <SectionLabel>Explainability</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Every score tells you exactly why.
          </h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            PRISM doesn't just rank counties — it breaks down every risk score into
            its contributing factors. Emergency managers can see precisely what
            is driving risk in any county: weather severity, disaster history,
            seismic activity, population exposure, and economic vulnerability.
          </p>
          <div className="space-y-4">
            {[
              { title: 'Traceable to public data', body: 'Every driver links back to a specific FEMA, NWS, USGS, or Census record — no unexplainable black-box scores.' },
              { title: 'Historical trend comparison', body: 'Switch to the History tab on any county to see how its risk score has evolved month-over-month — so you can act on trends, not just snapshots.' },
              { title: 'Built for human judgment', body: "PRISM supports decisions — it doesn't replace them. Planners retain full authority over resource allocation." },
            ].map((f) => (
              <div key={f.title} className="flex gap-3">
                <Shield size={16} className="text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">{f.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Stats ───────────────────────────────────────────────────────────── */

function StatsSection() {
  const stats = [
    { value: '3,200+', label: 'Counties scored nationwide' },
    { value: '4', label: 'Live public data sources' },
    { value: '90-day', label: 'Rolling risk window' },
    { value: '100%', label: 'Open public data — no licensing fees' },
  ]

  return (
    <section className="py-20 px-6 border-t border-white/5 bg-[#111827]/50">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-3xl sm:text-4xl font-bold text-white mb-1">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── CTA ─────────────────────────────────────────────────────────────── */

function CTASection() {
  return (
    <section className="py-28 px-6 border-t border-white/5 text-center">
      <div className="max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-600/15 border border-green-500/25 text-green-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live — scores updating now
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
          See which counties are at greatest risk right now.
        </h2>
        <p className="text-slate-400 mb-10 leading-relaxed">
          Open the PRISM dashboard to explore live risk rankings, drill into county
          explainability, and run scenario simulations — no login required.
        </p>
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors cursor-pointer shadow-xl shadow-blue-600/20 text-white"
        >
          Open PRISM Dashboard <ChevronRight size={18} />
        </a>
        <p className="text-xs text-slate-600 mt-6">
          Powered by FEMA OpenFEMA · NOAA / NWS · USGS · U.S. Census Bureau
        </p>
      </div>
    </section>
  )
}

/* ── Footer ──────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src={prismLogo} alt="PRISM" className="h-7 w-7" />
          <span className="text-sm font-semibold">PRISM</span>
          <span className="text-slate-600 text-sm">· Prioritization of Risk &amp; Incident Support Model</span>
        </div>
        <p className="text-xs text-slate-600">Powered by Sky Solutions LLC · Decision-support only, not a guarantee of outcomes.</p>
      </div>
    </footer>
  )
}

/* ── Shared ──────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">{children}</p>
  )
}
