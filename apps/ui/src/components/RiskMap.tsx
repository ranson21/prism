import { useState, useRef } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { Plus, Minus, RotateCcw } from 'lucide-react'
import { scoreToColor, type RiskLevel } from '../lib/risk'
import { RiskBadge } from './RiskBadge'
import type { RankedCounty } from '../store/api'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

const MIN_ZOOM = 1
const MAX_ZOOM = 8

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  onSelect: (fips: string) => void
  highlightFips?: Set<string>
  focusHighlighted?: boolean
}

interface TooltipState {
  county: RankedCounty
  x: number
  y: number
}

export function RiskMap({ rankings, selectedFips, onSelect, highlightFips, focusHighlighted }: Props) {
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([0, 0])
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const scoreByFips = new Map(rankings.map((r) => [r.fips_code, r]))

  function zoomIn() { setZoom((z) => Math.min(z * 1.5, MAX_ZOOM)) }
  function zoomOut() { setZoom((z) => Math.max(z / 1.5, MIN_ZOOM)) }
  function reset() { setZoom(1); setCenter([0, 0]) }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!tooltip || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setTooltip((t) => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden bg-[#111827] border border-white/10 relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-[#0F172A]/95 border border-white/15 rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            transform: tooltip.x > (containerRef.current?.clientWidth ?? 0) - 200 ? 'translateX(-110%)' : undefined,
          }}
        >
          <p className="text-xs font-semibold text-slate-100 leading-tight">{tooltip.county.county_name}</p>
          <p className="text-[10px] text-slate-400 mb-1.5">{tooltip.county.state_abbr}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold" style={{ color: scoreToColor(tooltip.county.risk_score) }}>
              {tooltip.county.risk_score.toFixed(1)}
            </span>
            <RiskBadge level={tooltip.county.risk_level} />
          </div>
        </div>
      )}

      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: '100%' }}>
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => {
            setZoom(z)
            setCenter([
              Math.max(-135, Math.min(135, coordinates[0])),
              Math.max(-55, Math.min(75, coordinates[1])),
            ])
          }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const fips = geo.id.toString().padStart(5, '0')
                const county = scoreByFips.get(fips)
                const level = county?.risk_level as RiskLevel | undefined
                const isSelected = fips === selectedFips
                const isHighlighted = highlightFips?.has(fips) ?? false
                const dimmed = focusHighlighted && highlightFips && highlightFips.size > 0 && !isHighlighted

                // Scale stroke width down as zoom increases so borders don't overwhelm
                const strokeWidth = isHighlighted || isSelected ? 1.5 / zoom : 0.3 / zoom
                const gradientColor = county?.risk_score != null ? scoreToColor(county.risk_score) : null
                const fillColor = dimmed ? '#1F2937' : (gradientColor ?? '#1F2937')
                const glowColor = gradientColor ?? '#f8fafc'

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => county && onSelect(fips)}
                    onMouseEnter={(e) => {
                      if (!county || !containerRef.current) return
                      const rect = containerRef.current.getBoundingClientRect()
                      setTooltip({ county, x: e.clientX - rect.left, y: e.clientY - rect.top })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: fillColor,
                        fillOpacity: dimmed ? 0.15 : level ? (isHighlighted ? 1 : 0.85) : 0.4,
                        stroke: isHighlighted ? '#38bdf8' : isSelected ? '#f8fafc' : '#0F172A',
                        strokeWidth,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: isSelected ? `drop-shadow(0 0 4px ${glowColor})` : 'none',
                      },
                      hover: {
                        fill: fillColor,
                        fillOpacity: dimmed ? 0.35 : 1,
                        stroke: '#ffffff',
                        strokeWidth: 2 / zoom,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: dimmed ? 'none' : `drop-shadow(0 0 6px ${glowColor}aa)`,
                      },
                      pressed: { outline: 'none', cursor: 'pointer' },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1F2937]/90 border border-white/10 text-slate-300 hover:text-white hover:bg-[#374151] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors backdrop-blur-sm"
          aria-label="Zoom in"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1F2937]/90 border border-white/10 text-slate-300 hover:text-white hover:bg-[#374151] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors backdrop-blur-sm"
          aria-label="Zoom out"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={reset}
          disabled={zoom === 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1F2937]/90 border border-white/10 text-slate-300 hover:text-white hover:bg-[#374151] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors backdrop-blur-sm"
          aria-label="Reset zoom"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  )
}
