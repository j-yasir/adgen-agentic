from ..factory import PROVIDER_REGISTRY
from ._kie_ai_base import KieAIBaseProvider


@PROVIDER_REGISTRY.register("seedream")
class SeedreamProvider(KieAIBaseProvider):
    """
    Image generation via Seedream models on kie.ai.

    Supported models:
      - seedream/4.5-edit              (default) — aspect_ratio, quality
      - seedream/5-lite-image-to-image           — aspect_ratio, quality
      - bytedance/seedream-v4-edit               — image_size, image_resolution, max_images
    """

    def _build_input_payload(self, request, image_url: str | None, reference_image_url: str | None = None) -> dict:
        model = self.config.model_name

        if model == "bytedance/seedream-v4-edit":
            inp = {
                "prompt": request.prompt,
                "image_size": "square_hd",
                "image_resolution": request.resolution or "1K",
                "max_images": 1,
                "nsfw_checker": False,
            }
            urls = [u for u in [image_url, reference_image_url] if u]
            if urls:
                inp["image_urls"] = urls

        else:
            # seedream/4.5-edit, seedream/5-lite-image-to-image, and future variants
            inp = {
                "prompt": request.prompt,
                "aspect_ratio": request.aspect_ratio or "3:2",
                "quality": "basic",
                "nsfw_checker": False,
            }
            if request.negative_prompt:
                inp["negative_prompt"] = request.negative_prompt
            urls = [u for u in [image_url, reference_image_url] if u]
            if urls:
                inp["image_urls"] = urls

        return inp
