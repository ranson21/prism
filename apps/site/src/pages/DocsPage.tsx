import { createContext, useContext, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, BookOpen, Building2, ChevronRight, Cpu, Database, Shield } from 'lucide-react'
import prismLogo from '../assets/prism_logo.svg'

import agencyPilotMd from '../../../../docs/agency_pilot_brief.md?raw'
import responsibleAiMd from '../../../../docs/responsible_ai.md?raw'
import architectureMd from '../../../../docs/architecture.md?raw'
import mlPipelineMd from '../../../../docs/ml_pipeline.md?raw'
import dataPipelineMd from '../../../../docs/data_pipeline.md?raw'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3000'

const DOCS = [
  {
    slug: 'agency-pilot',
    title: 'Agency Pilot Brief',
    description: 'Path to production for emergency management agencies',
    Icon: Building2,
    content: agencyPilotMd,
  },
  {
    slug: 'responsible-ai',
    title: 'Responsible AI',
    description: 'Data sources, uncertainty, and equity commitments',
    Icon: Shield,
    content: responsibleAiMd,
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    description: 'System design, data flow, and cloud deployment',
    Icon: BookOpen,
    content: architectureMd,
  },
  {
    slug: 'ml-pipeline',
    title: 'ML Pipeline',
    description: 'Scoring methodology, feature weights, and risk tiers',
    Icon: Cpu,
    content: mlPipelineMd,
  },
  {
    slug: 'data-pipeline',
    title: 'Data Pipeline',
    description: 'Ingestion connectors, normalization, and features',
    Icon: Database,
    content: dataPipelineMd,
  },
]

/* ── Context for detecting block vs inline code ───────────────────────── */

const BlockCodeCtx = createContext(false)

/* ── Named code renderer so hooks are valid ──────────────────────────── */

function CodeRenderer({ children, className }: { children?: ReactNode; className?: string }) {
  const isBlock = useContext(BlockCodeCtx)
  if (isBlock) {
    return <code className={`font-mono text-slate-300 ${className ?? ''}`}>{children}</code>
  }
  return (
    <code className="bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded text-[0.85em] font-mono">
      {children}
    </code>
  )
}

/* ── Markdown renderer ────────────────────────────────────────────────── */

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold text-white mb-6 pb-4 border-b border-white/10">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-semibold text-slate-100 mt-10 mb-4 pb-2 border-b border-white/5">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-slate-200 mt-6 mb-3">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-slate-300 leading-relaxed mb-4">{children}</p>
        ),
        a: ({ href, children }) => {
          const match = href?.match(/(?:^|\/)([^/]+)\.md$/)
          if (match) {
            const slug = match[1].replace(/_/g, '-')
            if (DOCS.some((d) => d.slug === slug)) {
              return (
                <Link to={`/docs/${slug}`} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                  {children}
                </Link>
              )
            }
          }
          return (
            <a href={href ?? '#'} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        },
        ul: ({ children }) => (
          <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-slate-300 leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-500/40 pl-4 my-4 text-slate-400 italic">{children}</blockquote>
        ),
        pre: ({ children }) => (
          <BlockCodeCtx.Provider value={true}>
            <pre className="bg-[#111827] border border-white/10 rounded-xl p-4 mb-4 overflow-x-auto text-sm leading-relaxed">
              {children}
            </pre>
          </BlockCodeCtx.Provider>
        ),
        code: CodeRenderer,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-6 rounded-xl border border-white/10">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#111827] border-b border-white/10">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2.5 text-slate-300 border-b border-white/5 align-top">{children}</td>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>
        ),
        hr: () => <hr className="border-white/10 my-8" />,
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-100">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function DocsPage() {
  const { slug } = useParams<{ slug?: string }>()

  if (!slug) return <Navigate to={`/docs/${DOCS[0].slug}`} replace />

  const current = DOCS.find((d) => d.slug === slug) ?? DOCS[0]

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col">

      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3">
              <img src={prismLogo} alt="PRISM" className="h-9 w-9" />
              <span className="text-base font-bold tracking-tight">PRISM</span>
            </Link>
            <span className="text-white/20 select-none">/</span>
            <span className="text-sm text-slate-400">Documentation</span>
          </div>
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
          >
            Open Dashboard <ChevronRight size={14} />
          </a>
        </div>
      </nav>

      <div className="flex flex-1 pt-16">

        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-white/10 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-6 flex flex-col h-full">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-8 group w-fit"
            >
              <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </Link>

            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">Documents</p>

            <nav className="space-y-1">
              {DOCS.map(({ slug: s, title, description, Icon }) => {
                const isActive = s === current.slug
                return (
                  <Link
                    key={s}
                    to={`/docs/${s}`}
                    className={`flex items-start gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600/15 border border-blue-600/25 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <Icon size={15} className={`mt-0.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-600'}`} />
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">{description}</p>
                    </div>
                  </Link>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
            <MarkdownContent content={current.content} />
          </div>
        </main>

      </div>
    </div>
  )
}
