-- PRISM — Add economic exposure feature
-- Adds Census median household income to counties and economic_exposure to county_features

ALTER TABLE geography.counties
    ADD COLUMN IF NOT EXISTS median_household_income INTEGER;   -- Census ACS B19013_001E

ALTER TABLE risk.county_features
    ADD COLUMN IF NOT EXISTS economic_exposure NUMERIC(16, 4);  -- (income_thousands) × severity_weight_sum
