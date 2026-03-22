interface Props {
  onClose: () => void
}

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Ingest Public Data',
    body: 'FEMA disaster declarations, NWS severe weather alerts, USGS earthquake events, and Census population data are ingested and normalized daily.',
  },
  {
    step: '02',
    title: 'Score Every County',
    body: 'A random forest model produces a 0–100 risk score for all 3,000+ US counties, with top risk drivers and a confidence band per score.',
  },
  {
    step: '03',
    title: 'Rank & Explain',
    body: 'Counties are ranked by risk level. Every score is explainable — decision-makers can drill into exactly which factors are driving elevated risk.',
  },
  {
    step: '04',
    title: 'Simulate & Plan',
    body: 'Analysts model hypothetical events (hurricane, earthquake, flood) to see projected impact and pre-position resources before disaster strikes.',
  },
]

const PILOT_PHASES = [
  {
    phase: 'Phase 1',
    label: 'Agency Pilot',
    items: [
      'Real-time weather feed integration',
      'State emergency operations center data push',
      'Logistics optimization modeling',
      'Cross-agency data fusion',
    ],
  },
  {
    phase: 'Phase 2',
    label: 'Enterprise Platform',
    items: [
      'Satellite imagery integration',
      'Infrastructure vulnerability modeling',
      'Multi-hazard fusion engine',
      'Secure cloud deployment',
    ],
  },
]

export function AboutModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111827] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer text-xl leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="p-8 space-y-8">
          {/* Hero */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">About PRISM</p>
            <h2 className="text-2xl font-bold text-slate-100 leading-snug">
              AI-powered disaster risk intelligence<br />for proactive resource prioritization
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-xl">
              Emergency management agencies face the same challenge before every major disaster: limited resources,
              incomplete data, and no shared picture of where risk is highest. PRISM changes that by turning public
              hazard data into a continuously updated, explainable county-level risk ranking — so decision-makers
              know where to act before the crisis begins.
            </p>
          </div>

          {/* How it works */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">How It Works</p>
            <div className="grid grid-cols-2 gap-3">
              {WORKFLOW_STEPS.map(({ step, title, body }) => (
                <div key={step} className="rounded-xl bg-[#1F2937] border border-white/5 p-4">
                  <span className="text-xs font-bold text-blue-500 tracking-widest">{step}</span>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{title}</p>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Path to Agency Pilot */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Path to Agency Pilot</p>
            <div className="grid grid-cols-2 gap-3">
              {PILOT_PHASES.map(({ phase, label, items }) => (
                <div key={phase} className="rounded-xl bg-[#1F2937] border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      {phase}
                    </span>
                    <span className="text-sm font-semibold text-slate-100">{label}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                        <span className="text-blue-500 mt-0.5 shrink-0">›</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Data sources */}
          <div className="rounded-xl bg-[#0F172A] border border-white/5 p-4 flex flex-wrap gap-4">
            {[
              { label: 'Disaster Declarations', source: 'FEMA OpenFEMA API' },
              { label: 'Severe Weather Alerts', source: 'NWS API' },
              { label: 'Earthquake Events', source: 'USGS Earthquake Catalog' },
              { label: 'Population & Income', source: 'US Census Bureau ACS' },
            ].map(({ label, source }) => (
              <div key={label} className="min-w-[140px]">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                <p className="text-xs font-medium text-slate-300 mt-0.5">{source}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
