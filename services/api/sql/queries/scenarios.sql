-- name: ListScenarios :many
SELECT id, name, description, parameters, created_at
FROM scenarios.definitions
ORDER BY created_at DESC;

-- name: GetScenario :one
SELECT id, name, description, parameters, created_at
FROM scenarios.definitions
WHERE id = $1;

-- name: CreateScenario :one
INSERT INTO scenarios.definitions (name, description, created_by, parameters)
VALUES ($1, $2, $3, $4)
RETURNING id, name, description, parameters, created_at;

-- name: GetScenarioResults :many
SELECT
    r.fips_code,
    c.county_name,
    c.state_abbr,
    r.simulated_risk_score,
    r.simulated_risk_level,
    r.delta_from_baseline,
    r.top_drivers
FROM scenarios.results r
JOIN geography.counties c USING (fips_code)
WHERE r.scenario_id = $1
ORDER BY r.simulated_risk_score DESC NULLS LAST;

-- name: UpsertScenarioResult :exec
INSERT INTO scenarios.results (
    scenario_id, fips_code, simulated_risk_score,
    simulated_risk_level, delta_from_baseline, top_drivers
) VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (scenario_id, fips_code) DO UPDATE SET
    simulated_risk_score  = EXCLUDED.simulated_risk_score,
    simulated_risk_level  = EXCLUDED.simulated_risk_level,
    delta_from_baseline   = EXCLUDED.delta_from_baseline,
    top_drivers           = EXCLUDED.top_drivers,
    computed_at           = now();
