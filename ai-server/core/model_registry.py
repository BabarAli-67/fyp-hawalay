"""Central registry for InferenceProvider implementations."""

from __future__ import annotations

import logging

from core.inference_provider import InferenceProvider

logger = logging.getLogger(__name__)


class ModelRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, InferenceProvider] = {}

    def register(self, name: str, provider: InferenceProvider) -> None:
        if not isinstance(provider, InferenceProvider):
            raise TypeError(f"{provider} does not implement InferenceProvider protocol")
        self._providers[name] = provider
        logger.info("Registered AI model: '%s' v%s", name, provider.version)

    def get(self, name: str) -> InferenceProvider:
        if name not in self._providers:
            available = list(self._providers.keys())
            raise KeyError(f"Model '{name}' not found. Available: {available}")
        return self._providers[name]

    def is_ready(self, name: str) -> bool:
        try:
            return self._providers[name].status().get("ready", False)
        except (KeyError, Exception):
            return False

    def all_statuses(self) -> dict[str, dict]:
        return {name: provider.status() for name, provider in self._providers.items()}

    def list_registered(self) -> list[str]:
        return list(self._providers.keys())

    def health_report(self) -> dict[str, object]:
        """Summary for ops: registered vs ready providers."""
        statuses = self.all_statuses()
        ready = [name for name, status in statuses.items() if status.get("ready")]
        unavailable = [name for name, status in statuses.items() if not status.get("ready")]
        return {
            "registered": self.list_registered(),
            "ready": ready,
            "unavailable": unavailable,
            "providers": statuses,
        }


registry = ModelRegistry()
