-- name: GetRiskSummary :many
SELECT
    s.risk_level,
    COUNT(*)::int AS county_count
FROM risk.scores s
JOIN risk.model_versions mv ON mv.id = s.model_version_id
WHERE mv.active = true
  AND s.score_date = (SELECT MAX(score_date) FROM risk.scores WHERE model_version_id = mv.id)
GROUP BY s.risk_level;

-- name: GetRankings :many
SELECT
    ROW_NUMBER() OVER (ORDER BY s.risk_score DESC)::int AS rank,
    s.fips_code,
    c.county_name,
    c.state_abbr,
    c.population,
    s.risk_score,
    s.risk_level,
    s.top_drivers,
    s.score_date
FROM risk.scores s
JOIN geography.counties c USING (fips_code)
JOIN risk.model_versions mv ON mv.id = s.model_version_id
WHERE mv.active = true
  AND s.score_date = (SELECT MAX(score_date) FROM risk.scores WHERE model_version_id = mv.id)
ORDER BY s.risk_score DESC
LIMIT $1 OFFSET $2;

-- name: CountRankings :one
SELECT COUNT(*)::int AS total
FROM risk.scores s
JOIN risk.model_versions mv ON mv.id = s.model_version_id
WHERE mv.active = true
  AND s.score_date = (SELECT MAX(score_date) FROM risk.scores WHERE model_version_id = mv.id);

-- name: GetCountyScore :one
SELECT
    s.fips_code,
    c.county_name,
    c.state_name,
    c.state_abbr,
    c.population,
    c.median_household_income,
    s.risk_score,
    s.risk_level,
    s.top_drivers,
    s.score_date,
    s.confidence_lower,
    s.confidence_upper,
    s.cluster_id,
    s.cluster_label
FROM risk.scores s
JOIN geography.counties c USING (fips_code)
JOIN risk.model_versions mv ON mv.id = s.model_version_id
WHERE s.fips_code = $1
  AND mv.active = true
  AND s.score_date = (SELECT MAX(score_date) FROM risk.scores WHERE model_version_id = mv.id);

-- name: GetCountyHistory :many
SELECT score_date, risk_score, risk_level
FROM risk.scores s
JOIN risk.model_versions mv ON mv.id = s.model_version_id
WHERE s.fips_code = $1
  AND mv.active = true
ORDER BY score_date ASC
LIMIT 90;

-- name: GetCountyFeatures :one
SELECT
    f.fips_code,
    disaster_count,
    major_disaster_count,
    severe_weather_count,
    earthquake_count,
    max_earthquake_magnitude,
    population_exposure,
    hazard_frequency_score,
    economic_exposure,
    feature_date
FROM risk.county_features f
WHERE f.fips_code = $1
  AND f.feature_date = (SELECT MAX(feature_date) FROM risk.county_features WHERE fips_code = $1)
  AND f.window_days = 90;
