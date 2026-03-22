import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface Driver {
  factor: string
  contribution: number
  value: number
}

export interface RankedCounty {
  rank: number
  fips_code: string
  county_name: string
  state_abbr: string
  population: number | null
  risk_score: number
  risk_level: 'low' | 'moderate' | 'elevated' | 'critical'
  top_drivers: Driver[]
  score_date: string
}

export interface RankingsResponse {
  rankings: RankedCounty[]
  total: number
  limit: number
  offset: number
}

export interface Distribution {
  critical: number
  elevated: number
  moderate: number
  low: number
}

export interface SummaryResponse {
  total_counties_scored: number
  distribution: Distribution
  top_counties: RankedCounty[]
}

export interface CountyFeatures {
  disaster_count: number
  major_disaster_count: number
  severe_weather_count: number
  earthquake_count: number
  max_earthquake_magnitude: number | null
  population_exposure: number
  hazard_frequency_score: number
  economic_exposure: number | null
}

export interface CountyDetail extends RankedCounty {
  state_name: string
  features: CountyFeatures
}

export interface SimulateRequest {
  name: string
  description?: string
  severity_multiplier: number
  fips_codes?: string[]
}

export interface SimResult {
  fips_code: string
  county_name: string
  state_abbr: string
  baseline_score: number
  simulated_risk_score: number
  simulated_risk_level: 'low' | 'moderate' | 'elevated' | 'critical'
  delta_from_baseline: number
}

export interface SimulateResponse {
  scenario_id: string
  name: string
  results: SimResult[]
  total: number
}

export const prismApi = createApi({
  reducerPath: 'prismApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getSummary: builder.query<SummaryResponse, void>({
      query: () => '/risk/summary',
    }),
    getRankings: builder.query<RankingsResponse, { limit?: number; offset?: number }>({
      query: ({ limit = 50, offset = 0 } = {}) =>
        `/risk/rankings?limit=${limit}&offset=${offset}`,
    }),
    getCountyDetail: builder.query<CountyDetail, string>({
      query: (fips) => `/risk/explain/${fips}`,
    }),
    simulate: builder.mutation<SimulateResponse, SimulateRequest>({
      query: (body) => ({
        url: '/scenarios/simulate',
        method: 'POST',
        body,
      }),
    }),
  }),
})

export const {
  useGetSummaryQuery,
  useGetRankingsQuery,
  useGetCountyDetailQuery,
  useSimulateMutation,
} = prismApi
