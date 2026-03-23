"""Run the full ML pipeline in sequence.

Usage:
    python -m app.pipeline
"""

import asyncio
import sys

from app.db import init_pool, close_pool
from app.ingestion.pipeline import run_ingestion
from app.features.compute import compute_features
from app.scoring.train import train_model
from app.scoring.score import score_counties


async def main() -> None:
    await init_pool()
    try:
        print("→ Ingesting data...")
        results = await run_ingestion(source_keys=None, since=None)
        for r in results:
            print(f"  {r}")

        print("→ Computing features...")
        n = await compute_features(window_days=90)
        print(f"  {n} counties written")

        print("→ Training model...")
        version_id = await train_model()
        print(f"  model version: {version_id}")

        print("→ Scoring counties...")
        scored = await score_counties()
        print(f"  {scored} counties scored")

        print("✓ Pipeline complete")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
