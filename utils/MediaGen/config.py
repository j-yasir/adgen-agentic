from enum import Enum


class MediaType(Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class ProviderID(Enum):
    GEMINI      = "gemini"
    SEEDREAM    = "seedream"
    NANO_BANANA = "nano-banana"
    FLUX        = "flux"
    # Future: ELEVENLABS = "elevenlabs", RUNWAY = "runway", STABILITY = "stability"
