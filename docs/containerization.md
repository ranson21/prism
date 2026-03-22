# Containerization

## Requirements

Each service must have:
- Dockerfile
- .dockerignore

## Compose

docker-compose must:
- run frontend, api, ml, db
- use service networking

## Make Targets

- make docker-build
- make docker-up
- make docker-down
