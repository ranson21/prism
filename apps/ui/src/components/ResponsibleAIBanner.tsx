import { useState } from 'react'

const PILLARS = [
  {
    icon: '📂',
    label: 'Public Data Only',
    detail: 'FEMA, NWS, USGS, Census — no proprietary or real-time emergency feeds.',
  },
  {
    icon: '📊',
    label: 'Uncertainty Shown',
    detail: 'Every score includes a confidence band derived from model variance across decision trees.',
  },
  {
    icon: '🔍',
    label: 'Explainable Scores',
    detail: 'Top risk drivers are surfaced for every county so analysts understand what is driving each score.',
  },
  {
    icon: '⚠️',
    label: 'Not Deterministic',
    detail: 'PRISM is a decision-support tool. Scores are probabilistic estimates, not guarantees of outcomes.',
  },
  {
    icon: '⚖️',
    label: 'Equity-Aware',
    detail: 'Economic exposure (median household income) is modeled as a vulnerability factor, not excluded.',
  },
]

export function ResponsibleAIBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="rounded-xl bg-[#111827] border border-blue-500/20 px-4 py-3 shrink-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-blue-400 text-sm">🛡</span>
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-widest">Responsible AI</p>
        </div>

        <div className="flex-1 flex flex-wrap gap-x-6 gap-y-2">
          {PILLARS.map(({ icon, label, detail }) => (
            <div key={label} className="group relative flex items-center gap-1.5 cursor-default">
              <span className="text-xs">{icon}</span>
              <span className="text-xs text-slate-300 font-medium">{label}</span>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-[#0F172A] border border-white/10 p-2.5 text-[11px] text-slate-400 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                {detail}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer text-sm shrink-0 leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
