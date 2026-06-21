from abc import ABC, abstractmethod
from .schemas import MediaGenConfig, MediaGenResponse


class BaseMediaProvider(ABC):
    SUPPORTED_MEDIA_TYPES: list[str] = []  # declare in each subclass

    def __init__(self, config: MediaGenConfig):
        self.config = config

    @abstractmethod
    def generate(self, request) -> MediaGenResponse: ...

    def supports(self, media_type: str) -> bool:
        return media_type in self.SUPPORTED_MEDIA_TYPES
