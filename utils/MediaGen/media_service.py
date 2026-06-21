from .schemas import MediaGenConfig, MediaGenResponse
from .factory import PROVIDER_REGISTRY
from . import providers  # noqa: F401 — triggers all @PROVIDER_REGISTRY.register() decorators


class MediaGenService:
    """
    Single entry point for all media generation (image, video, audio).

    Usage:
        service = MediaGenService(MediaGenConfig(provider="seedream", model_name="seedream-5-0-260128"))
        result  = service.generate(ImageRequest(prompt="...", output_path="out.png"))
    """

    def __init__(self, config: MediaGenConfig):
        self.provider = PROVIDER_REGISTRY.get(config.provider)(config)

    def generate(self, request) -> MediaGenResponse:
        if not self.provider.supports(request.media_type):
            return MediaGenResponse(
                success=False,
                media_type=request.media_type,
                error=(
                    f"Provider '{self.provider.config.provider}' does not support "
                    f"media type '{request.media_type}'. "
                    f"Supported: {self.provider.SUPPORTED_MEDIA_TYPES}"
                ),
            )
        return self.provider.generate(request)
