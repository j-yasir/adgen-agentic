from .base import BaseMediaProvider


class ProviderRegistry:
    def __init__(self):
        self._registry: dict[str, type[BaseMediaProvider]] = {}

    def register(self, name: str):
        """Decorator that registers a provider class under the given name."""
        def decorator(cls: type[BaseMediaProvider]):
            self._registry[name] = cls
            return cls
        return decorator

    def get(self, name: str) -> type[BaseMediaProvider]:
        if name not in self._registry:
            raise ValueError(
                f"Unknown provider: '{name}'. "
                f"Available: {list(self._registry.keys())}"
            )
        return self._registry[name]

    def list_providers(self) -> list[str]:
        return list(self._registry.keys())


PROVIDER_REGISTRY = ProviderRegistry()
