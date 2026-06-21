import os
import io

from PIL import Image
from google import genai

from ..base import BaseMediaProvider
from ..factory import PROVIDER_REGISTRY
from ..schemas import MediaGenConfig, MediaGenResponse


@PROVIDER_REGISTRY.register("gemini")
class GeminiProvider(BaseMediaProvider):
    """
    Image generation via Google Gemini (absorbs nanoBanana logic).
    Supports image-to-image and text-to-image.

    Env var: GOOGLE_API_KEY or GEMINI_API_KEY
    Example model: "gemini-2.5-flash-preview-image"
    """

    SUPPORTED_MEDIA_TYPES = ["image"]

    def __init__(self, config: MediaGenConfig):
        super().__init__(config)
        api_key = config.api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not set in environment.")
        self.client = genai.Client(api_key=api_key)

    def generate(self, request) -> MediaGenResponse:
        if request.media_type != "image":
            return MediaGenResponse(
                success=False,
                media_type=request.media_type,
                error=f"GeminiProvider does not support media type '{request.media_type}'.",
            )

        contents = [request.prompt]

        if request.image_path:
            if not os.path.exists(request.image_path):
                return MediaGenResponse(
                    success=False,
                    media_type="image",
                    error=f"Source image not found: {request.image_path}",
                )
            contents.append(Image.open(request.image_path))

        try:
            response = self.client.models.generate_content(
                model=self.config.model_name,
                contents=contents,
                config={"response_modalities": ["IMAGE", "TEXT"]},
            )
        except Exception as e:
            return MediaGenResponse(success=False, media_type="image", error=str(e))

        output_path = None
        text_parts = []

        for candidate in response.candidates:
            for part in candidate.content.parts:
                if getattr(part, "inline_data", None) is not None:
                    try:
                        Image.open(io.BytesIO(part.inline_data.data)).save(request.output_path)
                        output_path = request.output_path
                        print(f"[GeminiProvider] Image saved: {output_path}")
                    except Exception as e:
                        print(f"[GeminiProvider] Failed to save image: {e}")
                if getattr(part, "text", None) and part.text.strip():
                    text_parts.append(part.text.strip())

        return MediaGenResponse(
            success=output_path is not None,
            output_path=output_path,
            media_type="image",
            text_content="\n".join(text_parts) or None,
            error=None if output_path else "Gemini returned no image in response.",
        )
