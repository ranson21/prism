import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { Plus, Minus, RotateCcw } from 'lucide-react'
import { riskColor, type RiskLevel } from '../lib/risk'
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

export function RiskMap({ rankings, selectedFips, onSelect, highlightFips, focusHighlighted }: Props) {
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number]>([0, 0])

  const scoreByFips = new Map(rankings.map((r) => [r.fips_code, r]))

  function zoomIn() { setZoom((z) => Math.min(z * 1.5, MAX_ZOOM)) }
  function zoomOut() { setZoom((z) => Math.max(z / 1.5, MIN_ZOOM)) }
  function reset() { setZoom(1); setCenter([0, 0]) }

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-[#111827] border border-white/10 relative">
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: '100%' }}>
        <ZoomableGroup
          zoom={zoom}
          center={center}
          onMoveEnd={({ zoom: z, coordinates }) => {
            setZoom(z)
            setCenter([
              Math.max(-100, Math.min(100, coordinates[0])),
              Math.max(-55, Math.min(55, coordinates[1])),
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

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => county && onSelect(fips)}
                    style={{
                      default: {
                        fill: dimmed ? '#1F2937' : (level ? riskColor(level) : '#1F2937'),
                        fillOpacity: dimmed ? 0.15 : level ? (isHighlighted ? 1 : 0.85) : 0.4,
                        stroke: isHighlighted ? '#38bdf8' : isSelected ? '#f8fafc' : '#0F172A',
                        strokeWidth,
                        outline: 'none',
                        cursor: county ? 'pointer' : 'not-allowed',
                      },
                      hover: {
                        fill: dimmed ? '#1F2937' : (level ? riskColor(level) : '#374151'),
                        fillOpacity: dimmed ? 0.25 : 1,
                        stroke: isHighlighted ? '#7dd3fc' : '#f8fafc',
                        strokeWidth: 0.8 / zoom,
                        outline: 'none',
                      },
                      pressed: { outline: 'none' },
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
