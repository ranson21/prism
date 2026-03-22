import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { riskColor, type RiskLevel } from '../lib/risk'
import type { RankedCounty } from '../store/api'

const GEO_URL =
  'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json'

interface Props {
  rankings: RankedCounty[]
  selectedFips: string | null
  onSelect: (fips: string) => void
}

export function RiskMap({ rankings, selectedFips, onSelect }: Props) {
  const scoreByFips = new Map(rankings.map((r) => [r.fips_code, r]))

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-[#111827] border border-white/10">
      <ComposableMap projection="geoAlbersUsa" style={{ width: '100%', height: '100%' }}>
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo: any) => {
              // TopoJSON county IDs are zero-padded 5-digit FIPS
              const fips = geo.id.toString().padStart(5, '0')
              const county = scoreByFips.get(fips)
              const level = county?.risk_level as RiskLevel | undefined
              const isSelected = fips === selectedFips

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onClick={() => county && onSelect(fips)}
                  style={{
                    default: {
                      fill: level ? riskColor(level) : '#1F2937',
                      fillOpacity: level ? 0.85 : 0.4,
                      stroke: isSelected ? '#f8fafc' : '#0F172A',
                      strokeWidth: isSelected ? 1.5 : 0.3,
                      outline: 'none',
                      cursor: county ? 'pointer' : 'default',
                    },
                    hover: {
                      fill: level ? riskColor(level) : '#374151',
                      fillOpacity: 1,
                      stroke: '#f8fafc',
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
