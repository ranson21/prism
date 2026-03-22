-- PRISM — Initial Schema
-- Domains: geography, datasets, risk, prioritization, scenarios, auth

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy text search on county names

-- ─────────────────────────────────────────────
-- GEOGRAPHY
-- Core geographic unit: US county identified by 5-digit FIPS code
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS geography;

CREATE TABLE geography.counties (
    fips_code    CHAR(5)      PRIMARY KEY,           -- e.g. "06037" = LA County
    county_name  TEXT         NOT NULL,
    state_fips   CHAR(2)      NOT NULL,
    state_name   TEXT         NOT NULL,
    state_abbr   CHAR(2)      NOT NULL,
    population   INTEGER,
    area_sq_km   NUMERIC(12, 4),
    lat          NUMERIC(9, 6),                      -- centroid latitude
    lon          NUMERIC(9, 6),                      -- centroid longitude
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_counties_state_fips ON geography.counties (state_fips);

-- ─────────────────────────────────────────────
-- DATASETS
-- Tracks data sources, ingestion runs, and normalized events
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS datasets;

CREATE TABLE datasets.sources (
    source_key   TEXT        PRIMARY KEY,             -- 'fema' | 'noaa' | 'usgs'
    display_name TEXT        NOT NULL,
    base_url     TEXT,
    description  TEXT,
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO datasets.sources (source_key, display_name, base_url, description) VALUES
    ('fema', 'FEMA OpenFEMA', 'https://www.fema.gov/api/open/v2',
     'Federal Emergency Management Agency disaster declarations'),
    ('noaa', 'NOAA Storm Events', 'https://www.ncei.noaa.gov/cdo-web/api/v2',
     'NOAA National Centers for Environmental Information storm events'),
    ('usgs', 'USGS Earthquake Catalog', 'https://earthquake.usgs.gov/fdsnws/event/1',
     'USGS real-time and historical earthquake catalog');

CREATE TABLE datasets.ingestion_runs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key       TEXT        NOT NULL REFERENCES datasets.sources (source_key),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'running'
                                 CHECK (status IN ('running', 'success', 'failed')),
    records_fetched  INTEGER     NOT NULL DEFAULT 0,
    records_inserted INTEGER     NOT NULL DEFAULT 0,
    records_skipped  INTEGER     NOT NULL DEFAULT 0,   -- duplicates
    error_message    TEXT,
    parameters       JSONB                              -- fetch window, filters used
);

CREATE INDEX idx_ingestion_runs_source ON datasets.ingestion_runs (source_key);
CREATE INDEX idx_ingestion_runs_started ON datasets.ingestion_runs (started_at DESC);

CREATE TABLE datasets.raw_events (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key       TEXT        NOT NULL REFERENCES datasets.sources (source_key),
    external_id      TEXT        NOT NULL,             -- ID from the upstream system
    fips_code        CHAR(5)     REFERENCES geography.counties (fips_code),
    event_type       TEXT        NOT NULL,             -- 'disaster' | 'weather' | 'earthquake'
    event_subtype    TEXT,                             -- 'Hurricane', 'Flood', 'M5.0', …
    severity         TEXT,                             -- 'Major' | 'Minor' | source-native label
    event_start      TIMESTAMPTZ,
    event_end        TIMESTAMPTZ,
    raw_data         JSONB       NOT NULL,             -- full upstream payload, unmodified
    ingestion_run_id UUID        REFERENCES datasets.ingestion_runs (id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_raw_events_source_ext UNIQUE (source_key, external_id)
);

CREATE INDEX idx_raw_events_fips       ON datasets.raw_events (fips_code);
CREATE INDEX idx_raw_events_type       ON datasets.raw_events (event_type);
CREATE INDEX idx_raw_events_start      ON datasets.raw_events (event_start DESC);
CREATE INDEX idx_raw_events_run        ON datasets.raw_events (ingestion_run_id);

-- ─────────────────────────────────────────────
-- RISK
-- Feature vectors, model registry, scored outputs
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS risk;

-- Pre-computed feature vector per county per date window
-- Python ML engine writes here; Go API reads here
CREATE TABLE risk.county_features (
    id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    fips_code                CHAR(5) NOT NULL REFERENCES geography.counties (fips_code),
    feature_date             DATE    NOT NULL,          -- the date this vector represents
    window_days              INTEGER NOT NULL DEFAULT 90,

    -- Structured feature columns (also mirrored in features JSONB below)
    disaster_count           INTEGER NOT NULL DEFAULT 0,
    major_disaster_count     INTEGER NOT NULL DEFAULT 0,
    severe_weather_count     INTEGER NOT NULL DEFAULT 0,
    earthquake_count         INTEGER NOT NULL DEFAULT 0,
    max_earthquake_magnitude NUMERIC(4, 2),
    population_exposure      NUMERIC(16, 4),            -- sum(population * severity_weight)
    hazard_frequency_score   NUMERIC(8, 4),

    -- Full feature vector for ML consumption
    features                 JSONB   NOT NULL DEFAULT '{}',

    computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_county_features UNIQUE (fips_code, feature_date, window_days)
);

CREATE INDEX idx_county_features_fips ON risk.county_features (fips_code);
CREATE INDEX idx_county_features_date ON risk.county_features (feature_date DESC);

-- ML model registry — tracks trained model artifacts
CREATE TABLE risk.model_versions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name       TEXT        NOT NULL,              -- e.g. 'prism_v1'
    model_type       TEXT        NOT NULL,              -- 'logistic_regression' | 'random_forest'
    version          TEXT        NOT NULL,
    trained_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    feature_columns  TEXT[]      NOT NULL,
    metrics          JSONB,                             -- {accuracy, f1, auc, ...}
    artifact_path    TEXT,                             -- path to serialized model file
    active           BOOLEAN     NOT NULL DEFAULT false,
    notes            TEXT,

    CONSTRAINT uq_model_version UNIQUE (model_name, version)
);

-- Scored risk output per county per model run
CREATE TABLE risk.scores (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    fips_code         CHAR(5)     NOT NULL REFERENCES geography.counties (fips_code),
    model_version_id  UUID        NOT NULL REFERENCES risk.model_versions (id),
    score_date        DATE        NOT NULL,

    risk_score        NUMERIC(5, 2) NOT NULL             -- 0.00 to 100.00
                      CHECK (risk_score BETWEEN 0 AND 100),
    risk_level        TEXT        NOT NULL
                      CHECK (risk_level IN ('low', 'moderate', 'elevated', 'critical')),
    confidence_lower  NUMERIC(5, 2),
    confidence_upper  NUMERIC(5, 2),

    -- [{factor: str, contribution: float, direction: "up"|"down"}]
    top_drivers       JSONB       NOT NULL DEFAULT '[]',

    computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_scores UNIQUE (fips_code, model_version_id, score_date)
);

CREATE INDEX idx_scores_fips      ON risk.scores (fips_code);
CREATE INDEX idx_scores_date      ON risk.scores (score_date DESC);
CREATE INDEX idx_scores_level     ON risk.scores (risk_level);
CREATE INDEX idx_scores_score     ON risk.scores (risk_score DESC);

-- ─────────────────────────────────────────────
-- PRIORITIZATION
-- Ranked county lists derived from risk scores
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS prioritization;

CREATE TABLE prioritization.rankings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ranking_date     DATE        NOT NULL,
    model_version_id UUID        NOT NULL REFERENCES risk.model_versions (id),
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_rankings UNIQUE (ranking_date, model_version_id)
);

CREATE TABLE prioritization.ranking_entries (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    ranking_id          UUID    NOT NULL REFERENCES prioritization.rankings (id),
    fips_code           CHAR(5) NOT NULL REFERENCES geography.counties (fips_code),
    rank                INTEGER NOT NULL CHECK (rank > 0),
    risk_score_id       UUID    NOT NULL REFERENCES risk.scores (id),
    recommended_action  TEXT,                          -- human-readable action string
    action_priority     TEXT
                        CHECK (action_priority IN ('immediate', 'monitor', 'low')),

    CONSTRAINT uq_ranking_entry UNIQUE (ranking_id, fips_code),
    CONSTRAINT uq_ranking_rank  UNIQUE (ranking_id, rank)
);

CREATE INDEX idx_ranking_entries_ranking ON prioritization.ranking_entries (ranking_id);
CREATE INDEX idx_ranking_entries_fips    ON prioritization.ranking_entries (fips_code);

-- ─────────────────────────────────────────────
-- SCENARIOS
-- User-defined what-if scenario definitions and simulation results
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS scenarios;

CREATE TABLE scenarios.definitions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    description TEXT,
    created_by  TEXT,
    -- e.g. {hazard_type, severity_multiplier, region_filter, time_horizon_days}
    parameters  JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scenarios.results (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id            UUID        NOT NULL REFERENCES scenarios.definitions (id),
    fips_code              CHAR(5)     NOT NULL REFERENCES geography.counties (fips_code),
    simulated_risk_score   NUMERIC(5, 2)
                           CHECK (simulated_risk_score BETWEEN 0 AND 100),
    simulated_risk_level   TEXT
                           CHECK (simulated_risk_level IN ('low', 'moderate', 'elevated', 'critical')),
    delta_from_baseline    NUMERIC(6, 2),              -- simulated - current baseline
    top_drivers            JSONB       NOT NULL DEFAULT '[]',
    computed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_scenario_result UNIQUE (scenario_id, fips_code)
);

CREATE INDEX idx_scenario_results_scenario ON scenarios.results (scenario_id);
CREATE INDEX idx_scenario_results_fips     ON scenarios.results (fips_code);

-- ─────────────────────────────────────────────
-- AUTH
-- Users and API key management
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT        UNIQUE NOT NULL,
    password_hash   TEXT        NOT NULL,
    role            TEXT        NOT NULL DEFAULT 'analyst'
                                CHECK (role IN ('admin', 'analyst', 'viewer')),
    active          BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at   TIMESTAMPTZ
);

CREATE TABLE auth.api_keys (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users (id),
    key_hash     TEXT        UNIQUE NOT NULL,          -- bcrypt of the raw key
    label        TEXT,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user ON auth.api_keys (user_id);
