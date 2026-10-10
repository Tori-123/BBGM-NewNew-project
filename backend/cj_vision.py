import base64
import json
import re

import httpx

from errors import ApiError

_MODEL = "qwen3-vl-flash"
_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def recognize_homework(
    api_key: str,
    image_bytes: bytes,
    content_type: str,
    subjects: list[dict],
) -> dict:
    if not api_key.strip():
        raise ApiError(
            503,
            "service_unavailable",
            "Add DASHSCOPE_API_KEY before reading homework photos.",
        )
    catalog = "\n".join(f"- {item['id']}: {item['name']}" for item in subjects)
    prompt = (
        "Read this photo of school homework. The photo may be cropped, tilted, or cut off. "
        "Transcribe the class note (IC), the homework (HW), and any announcement you can see. "
        "If a sentence is cut off, complete only that missing piece from the visible words and layout. "
        "Put those guessed words in inferred, and do not invent a whole assignment that is not on the page. "
        "Choose subject_id from this list, or use an empty string if none fit:\n"
        f"{catalog}\n"
        "Return only JSON with keys subject_id, ic, hw, announcement, transcribed, inferred."
    )
    encoded = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": _MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }
    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(
                _ENDPOINT,
                headers={"Authorization": f"Bearer {api_key}"},
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise ApiError(503, "service_unavailable", "Homework recognition is unavailable.") from exc
    if response.status_code >= 400:
        raise ApiError(503, "service_unavailable", "Homework recognition failed. Try another photo.")
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ApiError(503, "service_unavailable", "Homework recognition returned nothing usable.") from exc
    return _parse_reading(_message_text(content))


def _message_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict):
                parts.append(str(part.get("text") or ""))
        return "".join(parts)
    return ""


def _parse_reading(raw: str) -> dict:
    text = _FENCE.sub("", raw.strip())
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ApiError(503, "service_unavailable", "Homework recognition returned nothing usable.")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ApiError(503, "service_unavailable", "Homework recognition returned nothing usable.") from exc
    if not isinstance(data, dict):
        raise ApiError(503, "service_unavailable", "Homework recognition returned nothing usable.")
    return {
        "subject_id": str(data.get("subject_id") or "").strip(),
        "ic": str(data.get("ic") or "").strip(),
        "hw": str(data.get("hw") or "").strip(),
        "announcement": str(data.get("announcement") or "").strip(),
        "transcribed": str(data.get("transcribed") or "").strip(),
        "inferred": str(data.get("inferred") or "").strip(),
    }
