"""
Shared base class for all kie.ai-backed image generation providers.

All kie.ai providers (Seedream, NanoBanana, FLUX, etc.) use the same
async task pattern:
  1. Upload source image to kie.ai CDN  → public URL
  2. POST /api/v1/jobs/createTask       → taskId
  3. Poll /api/v1/jobs/recordInfo       → wait for state == "success"
  4. Download resultUrl                 → save PNG to disk

Subclasses only need to implement _build_input_payload() with their
provider-specific field names.
"""

import base64
import io
import json
import os
import time
from abc import abstractmethod

import requests
from PIL import Image

from app.config import settings
from app.utilities.MediaGen.base import BaseMediaProvider
from app.utilities.MediaGen.schemas import MediaGenConfig, MediaGenResponse

# ── kie.ai API endpoints ──────────────────────────────────────────────────────
BASE_URL          = "https://api.kie.ai"
UPLOAD_URL        = "https://kieai.redpandaai.co/api/file-base64-upload"
CREATE_TASK_URL   = f"{BASE_URL}/api/v1/jobs/createTask"
QUERY_TASK_URL    = f"{BASE_URL}/api/v1/jobs/recordInfo"

POLL_INTERVAL     = 5    # seconds between status polls
MAX_POLL_ATTEMPTS = 72   # 72 × 5 s = 6 minutes max wait per image


class KieAIBaseProvider(BaseMediaProvider):
    """
    Abstract base for kie.ai providers. Handles all HTTP plumbing.
    Subclasses override _build_input_payload() only.
    """

    SUPPORTED_MEDIA_TYPES = ["image"]

    def __init__(self, config: MediaGenConfig):
        super().__init__(config)
        self.api_key = (
            config.api_key
            or os.getenv("SEEDREAM_API_KEY")
            or getattr(settings, "SEEDREAM_API_KEY", None)
        )
        if not self.api_key:
            raise ValueError(
                f"{self.__class__.__name__}: SEEDREAM_API_KEY is not set. "
                "All kie.ai providers share this key."
            )
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # ── public entry point ────────────────────────────────────────────────────

    def generate(self, request) -> MediaGenResponse:
        if request.media_type != "image":
            return MediaGenResponse(
                success=False,
                media_type=request.media_type,
                error=f"{self.__class__.__name__} does not support '{request.media_type}'.",
            )

        image_url = None
        if getattr(request, "image_path", None):
            image_url, err = self._upload_image(request.image_path)
            if err:
                return MediaGenResponse(success=False, media_type="image", error=err)
            print(f"   [{self.__class__.__name__}] Uploaded portrait → {image_url}")

        reference_image_url = None
        if getattr(request, "reference_image_path", None):
            reference_image_url, err = self._upload_image(request.reference_image_path)
            if err:
                return MediaGenResponse(success=False, media_type="image", error=err)
            print(f"   [{self.__class__.__name__}] Uploaded reference → {reference_image_url}")

        input_payload = self._build_input_payload(request, image_url, reference_image_url)

        task_id, err = self._create_task(input_payload)
        if err:
            return MediaGenResponse(success=False, media_type="image", error=err)
        print(f"   [{self.__class__.__name__}] Task created: {task_id}")

        result_url, err = self._poll_task(task_id)
        if err:
            return MediaGenResponse(success=False, media_type="image", error=err)

        return self._download_and_save(result_url, request.output_path)

    # ── abstract: subclasses implement this ──────────────────────────────────

    @abstractmethod
    def _build_input_payload(self, request, image_url: str | None, reference_image_url: str | None = None) -> dict:
        """
        Build the provider-specific `input` dict for createTask.
        image_url is the CDN URL of the uploaded portrait, or None.
        reference_image_url is the CDN URL of the reference style image (Flow B), or None.
        """

    # ── private helpers ───────────────────────────────────────────────────────

    def _upload_image(self, image_path: str):
        """Upload a local image to kie.ai CDN. Returns (download_url, error)."""
        with open(image_path, "rb") as f:
            raw = f.read()
        ext = os.path.splitext(image_path)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(ext, "jpeg")
        data_uri = f"data:image/{mime};base64,{base64.b64encode(raw).decode()}"

        try:
            resp = requests.post(
                UPLOAD_URL,
                json={"base64Data": data_uri, "uploadPath": "images/hairstyle"},
                headers=self.headers,
                timeout=60,
            )
        except requests.RequestException as e:
            return None, f"Upload request failed: {e}"

        if resp.status_code != 200:
            return None, f"Upload API {resp.status_code}: {resp.text}"

        url = (resp.json().get("data") or {}).get("downloadUrl")
        if not url:
            return None, f"Upload response missing downloadUrl: {resp.json()}"
        return url, None

    def _create_task(self, input_payload: dict):
        """Submit a generation task. Returns (taskId, error)."""
        payload = {"model": self.config.model_name, "input": input_payload}
        try:
            resp = requests.post(
                CREATE_TASK_URL, json=payload, headers=self.headers, timeout=60
            )
        except requests.RequestException as e:
            return None, f"createTask request failed: {e}"

        if resp.status_code != 200:
            return None, f"createTask API {resp.status_code}: {resp.text}"

        task_id = (resp.json().get("data") or {}).get("taskId")
        if not task_id:
            return None, f"createTask response missing taskId: {resp.json()}"
        return task_id, None

    def _poll_task(self, task_id: str):
        """Poll recordInfo until state == success/fail. Returns (result_url, error)."""
        try:
            from app.agents.hairstyle_agent.utils.progress import emit as _emit
        except ImportError:
            def _emit(msg): pass  # noqa: E704

        for attempt in range(1, MAX_POLL_ATTEMPTS + 1):
            time.sleep(POLL_INTERVAL)
            try:
                resp = requests.get(
                    QUERY_TASK_URL,
                    params={"taskId": task_id},
                    headers=self.headers,
                    timeout=30,
                )
            except requests.RequestException as e:
                print(f"   [{self.__class__.__name__}] Poll #{attempt} network error: {e}")
                continue

            if resp.status_code != 200:
                print(f"   [{self.__class__.__name__}] Poll #{attempt} HTTP {resp.status_code}")
                continue

            data = resp.json().get("data") or {}
            state = data.get("state", "")
            print(f"   [{self.__class__.__name__}] Polling {task_id} → state={state}")
            _emit({"event": "phase4_progress", "status": "polling", "attempt": attempt, "state": state})

            if state == "success":
                try:
                    result = json.loads(data.get("resultJson", "{}"))
                except json.JSONDecodeError:
                    return None, f"Could not parse resultJson: {data.get('resultJson')}"
                urls = result.get("resultUrls", [])
                if not urls:
                    return None, f"No resultUrls in resultJson: {result}"
                return urls[0], None

            if state == "fail":
                msg = data.get("failMsg") or "Task failed with no message"
                return None, f"Task failed: {msg}"

        return None, f"Task {task_id} timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s"

    def _download_and_save(self, image_url: str, output_path: str) -> MediaGenResponse:
        """Download a generated image and save it to disk."""
        try:
            img_resp = requests.get(image_url, timeout=120)
            img_resp.raise_for_status()
        except requests.RequestException as e:
            return MediaGenResponse(
                success=False, media_type="image",
                error=f"Failed to download result image: {e}",
            )
        try:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            Image.open(io.BytesIO(img_resp.content)).save(output_path)
            print(f"   [{self.__class__.__name__}] Image saved: {output_path}")
        except Exception as e:
            return MediaGenResponse(
                success=False, media_type="image",
                error=f"Failed to save image: {e}",
            )
        return MediaGenResponse(success=True, output_path=output_path, media_type="image")
