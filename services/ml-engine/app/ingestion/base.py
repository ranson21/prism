"""Abstract base class for all data source connectors."""

from abc import ABC, abstractmethod
from datetime import datetime

from app.models.events import CanonicalEvent


class BaseConnector(ABC):
    """
    All connectors must implement fetch() and return a list of CanonicalEvents.

    The pipeline calls fetch() with a `since` datetime for incremental runs.
    Connectors are responsible for pagination; they must return ALL records
    since the given cutoff before yielding control back to the pipeline.
    """

    @property
    @abstractmethod
    def source_key(self) -> str:
        """Unique identifier matching datasets.sources.source_key."""
        ...

    @abstractmethod
    async def fetch(self, since: datetime) -> list[CanonicalEvent]:
        """
        Fetch events from the upstream API updated or occurring after `since`.

        Args:
            since: Fetch records more recent than this timestamp.

        Returns:
            List of normalized CanonicalEvent records.
        """
        ...
