import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { riskColor, type RiskLevel } from '../lib/risk'
import type { RankedCounty } from '../store/api'

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  onSelect: (fips: string) => void
  highlightFips?: Set<string>
  focusHighlighted?: boolean
}

export function RiskMap({ rankings, selectedFips, onSelect, highlightFips, focusHighlighted }: Props) {
  const scoreByFips = new Map(rankings.map((r) => [r.fips_code, r]))

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-[#111827] border border-white/10">
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: '100%' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              const fips = geo.id.toString().padStart(5, '0')
              const county = scoreByFips.get(fips)
              const level = county?.risk_level as RiskLevel | undefined
              const isSelected = fips === selectedFips
              const isHighlighted = highlightFips?.has(fips) ?? false
              const dimmed = focusHighlighted && highlightFips && highlightFips.size > 0 && !isHighlighted

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
                      strokeWidth: isHighlighted ? 1.5 : isSelected ? 1.5 : 0.3,
                      outline: 'none',
                      cursor: county ? 'pointer' : 'not-allowed',
                    },
                    hover: {
                      fill: dimmed ? '#1F2937' : (level ? riskColor(level) : '#374151'),
                      fillOpacity: dimmed ? 0.25 : 1,
                      stroke: isHighlighted ? '#7dd3fc' : '#f8fafc',
                      strokeWidth: 0.8,
                      outline: 'none',
                    },
                    pressed: { outline: 'none' },
                  }}
                />
              )
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  )
}
