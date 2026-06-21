from ..factory import PROVIDER_REGISTRY
from ._kie_ai_base import KieAIBaseProvider


@PROVIDER_REGISTRY.register("flux")
class FluxProvider(KieAIBaseProvider):
    """
    Image generation via FLUX models on kie.ai.
    Pass any FLUX model name via MediaGenConfig(model_name="...").

    Examples:
        model_name="flux-2/pro-image-to-image"

    Input image field: input_urls[] (multiple reference images supported)
    Supports aspect_ratio, resolution, nsfw_checker.
    """

    def _build_input_payload(self, request, image_url: str | None, reference_image_url: str | None = None) -> dict:
        inp = {
            "prompt": request.prompt,
            "aspect_ratio": request.aspect_ratio or "1:1",
            "resolution": request.resolution or "1K",
            "nsfw_checker": False,
        }
        urls = [u for u in [image_url, reference_image_url] if u]
        if urls:
            inp["input_urls"] = urls
        return inp
