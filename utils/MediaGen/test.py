"""
Quick smoke test for MediaGen utility.
Run from project root: python3 -m app.utilities.MediaGen.test
"""
import sys
from pathlib import Path

# Support direct execution
if __package__ is None or __package__ == "":
    sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from dotenv import load_dotenv
load_dotenv()

from app.utilities.MediaGen import MediaGenService, MediaGenConfig, ImageRequest


def test_seedream_text_to_image():
    print("\n--- Test: Seedream text-to-image ---")
    service = MediaGenService(MediaGenConfig(
        provider="seedream",
        model_name="seedream-5-0-260128",
    ))
    result = service.generate(ImageRequest(
        prompt="A professional portrait of a young man with a textured quiff hairstyle, photorealistic, 85mm lens, DSLR quality",
        output_path="Media/test_seedream_t2i.png",
    ))
    print(result)
    return result.success


def test_seedream_image_to_image():
    print("\n--- Test: Seedream image-to-image ---")
    input_image = "Media/runs/inputs/yasir.png"
    service = MediaGenService(MediaGenConfig(
        provider="seedream",
        model_name="seedream-5-0-260128",
    ))
    result = service.generate(ImageRequest(
        prompt="Same person with a classic pompadour hairstyle, photorealistic, 85mm lens",
        image_path=input_image,
        output_path="Media/test_seedream_i2i.png",
    ))
    print(result)
    return result.success


if __name__ == "__main__":
    t2i_ok = test_seedream_text_to_image()
    i2i_ok = test_seedream_image_to_image()
    print(f"\nResults: text-to-image={'PASS' if t2i_ok else 'FAIL'}, "
          f"image-to-image={'PASS' if i2i_ok else 'FAIL'}")
