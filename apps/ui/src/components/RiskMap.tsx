import { useState, useRef, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup, Annotation } from 'react-simple-maps'
import { geoCentroid, geoAlbersUsa } from 'd3-geo'
import { feature as topoFeature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { Plus, Minus, RotateCcw } from 'lucide-react'
import { scoreToColor } from '../lib/risk'
import { RiskBadge } from './RiskBadge'
import type { RankedCounty } from '../store/api'

const COUNTIES_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'
const STATES_URL   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const MIN_ZOOM = 1
const MAX_ZOOM = 8

// Shared validator — geoAlbersUsa returns null for coordinates outside its
// valid projection range; use this to guard all center/centroid assignments.
const albersProj = geoAlbersUsa()

// Continental US state centroids [longitude, latitude] for abbreviation labels
const STATE_LABELS: [string, number, number][] = [
  ['AL', -86.8, 32.7], ['AR', -92.4, 34.9], ['AZ', -111.9, 34.3], ['CA', -119.4, 37.2],
  ['CO', -105.5, 39.0], ['CT', -72.7, 41.6], ['DE', -75.5, 39.0], ['FL', -81.5, 28.5],
  ['GA', -83.4, 32.7], ['IA', -93.1, 42.1], ['ID', -114.5, 44.4], ['IL', -89.2, 40.0],
  ['IN', -86.3, 40.3], ['KS', -98.4, 38.5], ['KY', -84.9, 37.5], ['LA', -91.8, 31.2],
  ['MA', -71.8, 42.3], ['MD', -76.6, 39.0], ['ME', -69.4, 45.2], ['MI', -84.5, 44.3],
  ['MN', -94.3, 46.4], ['MO', -92.5, 38.3], ['MS', -89.7, 32.7], ['MT', -110.4, 47.0],
  ['NC', -79.4, 35.6], ['ND', -100.5, 47.5], ['NE', -99.9, 41.5], ['NH', -71.6, 44.0],
  ['NJ', -74.5, 40.1], ['NM', -106.1, 34.4], ['NV', -116.9, 39.3], ['NY', -75.5, 43.0],
  ['OH', -82.8, 40.4], ['OK', -97.5, 35.6], ['OR', -120.6, 44.0], ['PA', -77.2, 40.9],
  ['RI', -71.5, 41.7], ['SC', -80.9, 33.8], ['SD', -100.3, 44.4], ['TN', -86.4, 35.9],
  ['TX', -99.3, 31.5], ['UT', -111.5, 39.4], ['VA', -78.5, 37.5], ['VT', -72.7, 44.0],
  ['WA', -120.5, 47.4], ['WI', -89.6, 44.5], ['WV', -80.6, 38.6], ['WY', -107.6, 43.0],
]

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  hoveredFips?: string | null
  onSelect: (fips: string) => void
  onHover?: (fips: string | null) => void
  highlightFips?: Set<string>
  focusHighlighted?: boolean
}

interface TooltipState {
  county: RankedCounty
  x: number
  y: number
}

// Score → fill opacity: 0.60 floor keeps low counties 508-compliant;
// critical counties reach full opacity so they visually dominate.
function scoreFillOpacity(score: number): number {
  return 0.60 + (score / 100) * 0.40
}

export function RiskMap({ rankings, selectedFips, hoveredFips, onSelect, onHover, highlightFips, focusHighlighted }: Props) {
  const [zoom, setZoom] = useState(1)
  // geoAlbersUsa returns null for [0,0] (off Africa) — use geographic center of continental US
  const [center, setCenter] = useState<[number, number]>([-96, 38])
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const centroidsRef = useRef<Map<string, [number, number]>>(new Map())

  // Fetch topojson once on mount and pre-compute all county centroids.
  // Validate each centroid through albersProj — returns null for coordinates
  // outside the projection's valid range, which crashes ZoomableGroup.
  useEffect(() => {
    fetch(COUNTIES_URL)
      .then(r => r.json())
      .then(topo => {
        const topology = topo as unknown as Topology<{ counties: GeometryCollection }>
        const collection = topoFeature(topology, topology.objects.counties)
        for (const f of collection.features) {
          const fips = String(f.id).padStart(5, '0')
          try {
            const c = geoCentroid(f)
            if (Array.isArray(c) && isFinite(c[0]) && isFinite(c[1]) && albersProj([c[0], c[1]]) !== null) {
              centroidsRef.current.set(fips, [c[0], c[1]])
            }
          } catch { /* skip degenerate geometries */ }
        }
      })
      .catch(() => { /* silently skip if fetch fails */ })
  }, [])

  // Zoom to selected county using its pre-computed centroid
  useEffect(() => {
    if (!selectedFips) return
    const c = centroidsRef.current.get(selectedFips)
    if (!c) return
    setCenter(c)
    setZoom(6)
  }, [selectedFips])

  const scoreByFips = new Map(rankings.map((r) => [r.fips_code, r]))

  function zoomIn() { setZoom((z) => Math.min(z * 1.5, MAX_ZOOM)) }
  function zoomOut() { setZoom((z) => Math.max(z / 1.5, MIN_ZOOM)) }
  function reset() { setZoom(1); setCenter([-96, 38]) }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!tooltip || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setTooltip((t) => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden bg-[#080f1a] border border-white/10 relative"
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
        {/* SVG bloom filter — feGaussianBlur + feBlend composite creates luminance
            glow on vivid fills without blurring the actual county edges */}
        <defs>
          <filter id="county-bloom" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => {
            setZoom(z)
            // Only update center if the new coordinate projects without error.
            // geoAlbersUsa returns null for points outside its valid range
            // (e.g. pan drift near inset edges), which crashes ZoomableGroup.
            if (albersProj([coordinates[0], coordinates[1]]) !== null) {
              setCenter([coordinates[0], coordinates[1]])
            }
          }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          <Geographies geography={COUNTIES_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const fips = geo.id.toString().padStart(5, '0')
                const county = scoreByFips.get(fips)
                const isSelected = fips === selectedFips
                const isHighlighted = highlightFips?.has(fips) ?? false
                const isTableHovered = fips === hoveredFips
                const dimmed = focusHighlighted && highlightFips && highlightFips.size > 0 && !isHighlighted

                const strokeWidth = isHighlighted || isSelected || isTableHovered ? 1.5 / zoom : 0.4 / zoom
                const gradientColor = county?.risk_score != null ? scoreToColor(county.risk_score) : null
                const fillColor = dimmed ? '#1a2535' : (gradientColor ?? '#1a2535')
                const glowColor = gradientColor ?? '#f8fafc'
                const fillOpacity = dimmed
                  ? 0.12
                  : county?.risk_score != null
                    ? (isHighlighted || isTableHovered ? 1 : scoreFillOpacity(county.risk_score))
                    : 0.25

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => county && onSelect(fips)}
                    onMouseEnter={(e) => {
                      if (!county || !containerRef.current) return
                      const rect = containerRef.current.getBoundingClientRect()
                      setTooltip({ county, x: e.clientX - rect.left, y: e.clientY - rect.top })
                      onHover?.(fips)
                    }}
                    onMouseLeave={() => {
                      setTooltip(null)
                      onHover?.(null)
                    }}
                    style={{
                      default: {
                        fill: fillColor,
                        fillOpacity,
                        stroke: isHighlighted ? '#38bdf8' : isSelected ? '#f8fafc' : isTableHovered ? '#38bdf8' : 'rgba(51,65,85,0.5)',
                        strokeWidth,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: isSelected
                          ? `drop-shadow(0 0 5px ${glowColor}cc)`
                          : isTableHovered
                            ? `drop-shadow(0 0 8px ${glowColor}bb)`
                            : 'none',
                      },
                      hover: {
                        fill: fillColor,
                        fillOpacity: dimmed ? 0.25 : 1,
                        stroke: '#ffffff',
                        strokeWidth: 2 / zoom,
                        outline: 'none',
                        cursor: 'pointer',
                        filter: dimmed ? 'none' : `drop-shadow(0 0 8px ${glowColor}bb)`,
                      },
                      pressed: { outline: 'none', cursor: 'pointer' },
                    }}
                  />
                )
              })
            }
          </Geographies>

          {/* State boundaries — rendered above county fills, no fill so county colors show through */}
          <Geographies geography={STATES_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  style={{
                    default: {
                      fill: 'none',
                      stroke: 'rgba(148,163,184,0.35)',
                      strokeWidth: 1.2 / zoom,
                      outline: 'none',
                      pointerEvents: 'none',
                    },
                    hover:   { fill: 'none', outline: 'none', pointerEvents: 'none' },
                    pressed: { fill: 'none', outline: 'none', pointerEvents: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* State abbreviation labels — fade in at zoom ≥ 2 so they don't clutter the default view */}
          {zoom >= 2 && STATE_LABELS.map(([abbr, lon, lat]) => (
            <Annotation
              key={abbr}
              subject={[lon, lat]}
              dx={0}
              dy={0}
              connectorProps={{}}
            >
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontSize: `${Math.max(4, 10 / zoom)}px`,
                  fill: 'rgba(226,232,240,0.95)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  stroke: 'rgba(8,15,26,0.85)',
                  strokeWidth: `${2.5 / zoom}px`,
                  strokeLinejoin: 'round',
                  paintOrder: 'stroke fill',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {abbr}
              </text>
            </Annotation>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Vignette overlay — darkens edges to frame the map and push focus inward */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(8,15,26,0.75) 100%)',
        }}
      />

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-[#0F172A]/90 border border-white/10 rounded-lg px-2.5 py-2 backdrop-blur-sm">
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Risk Score</p>
        <div
          className="w-28 h-2 rounded-full mb-1"
          style={{ background: 'linear-gradient(to right, #2dd4bf, #facc15, #f97316, #e11d48, #fb2f60)' }}
        />
        <div className="flex justify-between w-28">
          {[0, 25, 50, 75, 100].map((n) => (
            <span key={n} className="text-[9px] text-slate-400">{n}</span>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
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
