"""Retrain the model and rescore all counties in a single process.

Runs train then score without re-ingesting data. Use this when only
the model weights or feature columns have changed.

Usage:
    python -m app.retrain_score
"""

import asyncio

from app.db import init_pool, close_pool
from app.scoring.train import train_model
from app.scoring.score import score_counties


async def main() -> None:
    await init_pool()
    try:
        print("→ Training model...")
        version_id = await train_model()
        print(f"  model version: {version_id}")

        print("→ Scoring counties...")
        scored = await score_counties()
        print(f"  {scored} counties scored")

        print("✓ Done")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
