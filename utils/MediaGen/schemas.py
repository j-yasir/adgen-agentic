from pydantic import BaseModel, Field
from typing import Union, Annotated, Optional, Literal


class MediaGenConfig(BaseModel):
    provider: str                     # "gemini" | "seedream" | "nano-banana" | "flux"
    model_name: str                   # e.g. "seedream/4.5-edit", "nano-banana-pro", "flux-2/pro-image-to-image"
    api_key: Optional[str] = None     # overrides env var if provided


class ImageRequest(BaseModel):
    media_type: Literal["image"] = "image"
    prompt: str
    negative_prompt: Optional[str] = None
    image_path: Optional[str] = None              # source image for image-to-image
    reference_image_path: Optional[str] = None    # second input for style transfer (Flow B)
    output_path: str = "generated.png"
    width: int = 1024
    height: int = 1024
    aspect_ratio: Optional[str] = None   # "1:1", "3:2", "16:9", etc.
    resolution: Optional[str] = None     # "1K", "2K", "4K" (kie.ai providers)


class VideoRequest(BaseModel):
    media_type: Literal["video"] = "video"
    prompt: str
    video_path: Optional[str] = None  # reference video
    output_path: str = "generated.mp4"
    duration: float = 5.0
    width: int = 1280
    height: int = 720


class AudioRequest(BaseModel):
    media_type: Literal["audio"] = "audio"
    prompt: str
    audio_path: Optional[str] = None  # reference audio
    output_path: str = "generated.mp3"
    duration: Optional[float] = None
    voice: Optional[str] = None


# Pydantic discriminated union — dispatches by media_type field
MediaGenRequest = Annotated[
    Union[ImageRequest, VideoRequest, AudioRequest],
    Field(discriminator="media_type")
]


class MediaGenResponse(BaseModel):
    success: bool
    output_path: Optional[str] = None
    media_type: str
    text_content: Optional[str] = None
    metadata: dict = {}
    error: Optional[str] = None
