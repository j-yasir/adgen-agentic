"""
Smoke test for the nano-banana (kie.ai) image provider.
Run from project root: python -m utils.MediaGen.test
"""
from dotenv import load_dotenv

load_dotenv()

from utils.MediaGen import MediaGenService, MediaGenConfig, ImageRequest


def test_nano_banana_text_to_image():
    print("\n--- Test: nano-banana text-to-image ---")
    service = MediaGenService(MediaGenConfig(
        provider="nano-banana",
        model_name="google/nano-banana",
    ))
    result = service.generate(ImageRequest(
        prompt="A minimalist product photo of a glass jar of apricot jam on a wooden "
               "table, soft natural light, photorealistic, studio quality",
        output_path="Media/test_nano_banana_t2i.png",
        aspect_ratio="1:1",
    ))
    print(result)
    return result.success


if __name__ == "__main__":
    t2i_ok = test_nano_banana_text_to_image()
    print(f"\nResult: text-to-image={'PASS' if t2i_ok else 'FAIL'}")
