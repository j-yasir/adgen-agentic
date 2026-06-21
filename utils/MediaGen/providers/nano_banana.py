from ..factory import PROVIDER_REGISTRY
from ._kie_ai_base import KieAIBaseProvider


@PROVIDER_REGISTRY.register("nano-banana")
class NanoBananaProvider(KieAIBaseProvider):
    """
    Image generation via Google NanoBanana models on kie.ai.

    Supported models:
      - nano-banana-pro         (default) — image_input[], aspect_ratio, resolution
      - nano-banana-2                     — image_input[], aspect_ratio, resolution
      - google/nano-banana-edit           — image_urls[],  output_format, image_size
      - google/nano-banana                — text-to-image, output_format, image_size
    """

    def _build_input_payload(self, request, image_url: str | None, reference_image_url: str | None = None) -> dict:
        model = self.config.model_name

        if model == "google/nano-banana-edit":
            # Uses image_urls (not image_input) + image_size field
            inp = {
                "prompt": request.prompt,
                "output_format": "png",
                "image_size": request.aspect_ratio or "1:1",
            }
            urls = [u for u in [image_url, reference_image_url] if u]
            if urls:
                inp["image_urls"] = urls

        elif model == "google/nano-banana":
            # Text-to-image — no input image
            inp = {
                "prompt": request.prompt,
                "output_format": "png",
                "image_size": request.aspect_ratio or "1:1",
            }

        else:
            # nano-banana-pro, nano-banana-2 — uses image_input[] array
            inp = {
                "prompt": request.prompt,
                "aspect_ratio": request.aspect_ratio or "1:1",
                "resolution": request.resolution or "1K",
                "output_format": "png",
            }
            urls = [u for u in [image_url, reference_image_url] if u]
            if urls:
                inp["image_input"] = urls

        return inp
