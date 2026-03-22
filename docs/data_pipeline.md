# Data Pipeline

## Layers

1. Ingestion
- FEMA / NOAA / USGS connectors
- incremental fetch

2. Normalization
- canonical schema
- deduplication
- geography alignment (FIPS)

3. Feature Layer
- time-window features
- hazard frequency
- severity
- population exposure

## Storage

Postgres stores:
- normalized data
- features
- ingestion logs
