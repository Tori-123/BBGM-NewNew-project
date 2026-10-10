import base64
import hashlib
import hmac
import json
import os
import re
from datetime import datetime, timedelta
from urllib.parse import quote, urlencode

import httpx

from models import TeamsConnection, to_iso, utc_now

CONNECTION_ID = "default"
_GRAPH = "https://graph.microsoft.com/v1.0"
_TOKEN_SCOPE = "offline_access https://graph.microsoft.com/Chat.Read"


class UpstreamError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message


def microsoft_ready(settings) -> bool:
    return bool(
        settings.microsoft_client_id
        and settings.microsoft_client_secret
        and settings.microsoft_tenant_id
        and settings.microsoft_redirect_uri
    )


def seal_secret(secret: str, plaintext: str) -> str:
    nonce = os.urandom(16)
    raw = plaintext.encode()
    hidden = bytes(left ^ right for left, right in zip(raw, _keystream(secret, nonce, len(raw))))
    return base64.urlsafe_b64encode(nonce + hidden).decode()


def open_secret(secret: str, sealed: str) -> str:
    blob = base64.urlsafe_b64decode(sealed.encode())
    nonce, hidden = blob[:16], blob[16:]
    raw = bytes(left ^ right for left, right in zip(hidden, _keystream(secret, nonce, len(hidden))))
    return raw.decode()


def save_refresh_token(db, settings, token: str) -> None:
    sealed = seal_secret(settings.session_secret, token)
    now = to_iso(utc_now())
    row = db.get(TeamsConnection, CONNECTION_ID)
    if row is None:
        db.add(TeamsConnection(id=CONNECTION_ID, refresh_token=sealed, updated_at=now))
    else:
        row.refresh_token = sealed
        row.updated_at = now
    db.flush()


def load_refresh_token(db, settings) -> str | None:
    row = db.get(TeamsConnection, CONNECTION_ID)
    if row is None:
        return None
    return open_secret(settings.session_secret, row.refresh_token)


def authorize_url(settings, state: str) -> str:
    query = urlencode(
        {
            "client_id": settings.microsoft_client_id,
            "response_type": "code",
            "redirect_uri": settings.microsoft_redirect_uri,
            "response_mode": "query",
            "scope": _TOKEN_SCOPE,
            "state": state,
        }
    )
    return f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0/authorize?{query}"


def exchange_code(settings, code: str) -> str:
    payload = _token_request(
        settings,
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.microsoft_redirect_uri,
        },
    )
    refresh = payload.get("refresh_token")
    if not refresh:
        raise UpstreamError("Microsoft did not return a Teams refresh token.")
    return refresh


def fetch_chat_texts(settings, refresh_token: str) -> tuple[str, str | None]:
    access_token, rotated = _access_token(settings, refresh_token)
    headers = {"Authorization": f"Bearer {access_token}"}
    lines: list[str] = []
    with httpx.Client(timeout=30) as client:
        chats = client.get(f"{_GRAPH}/me/chats", headers=headers, params={"$top": "15"})
        if chats.status_code >= 400:
            raise UpstreamError("Teams chats could not be read.")
        for chat in (chats.json().get("value") or [])[:15]:
            chat_id = chat.get("id")
            if not chat_id:
                continue
            topic = chat.get("topic") or "chat"
            messages = client.get(
                f"{_GRAPH}/me/chats/{quote(str(chat_id), safe='')}/messages",
                headers=headers,
                params={"$top": "30"},
            )
            if messages.status_code >= 400:
                continue
            for message in messages.json().get("value") or []:
                body = ((message.get("body") or {}).get("content") or "")
                text = _strip_html(str(body))
                if not text:
                    continue
                sender = (((message.get("from") or {}).get("user") or {}).get("displayName")) or ""
                lines.append(f"[{topic}] {sender}: {text}")
                if sum(len(line) for line in lines) > 12000:
                    break
            if sum(len(line) for line in lines) > 12000:
                break
    transcript = "\n".join(lines)[:12000].strip()
    if not transcript:
        raise UpstreamError("No Teams chat text was available to summarize.")
    return transcript, rotated


def summarize_entries(settings, week_start: str, catalog: list[dict], transcript: str) -> list:
    if not settings.deepseek_api_key:
        raise UpstreamError("DeepSeek is not configured.")
    monday = datetime.strptime(week_start, "%Y-%m-%d").date()
    days = "\n".join(f"{index} = {(monday + timedelta(days=index)).isoformat()}" for index in range(5))
    catalog_text = json.dumps(
        [{"id": item["id"], "name": item["name"], "short_name": item["short_name"]} for item in catalog],
        ensure_ascii=False,
    )
    user = (
        f"week_start: {week_start}\n"
        f"day_index dates:\n{days}\n\n"
        f"subjects:\n{catalog_text}\n\n"
        f"teams chats:\n{transcript}"
    )
    try:
        response = httpx.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {settings.deepseek_api_key}"},
            json={
                "model": "deepseek-flash",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Extract Communication Journal fields from Teams chat text. "
                            "Return only a JSON object with an entries array. "
                            "Each entry has subject_id, day_index, ic, hw, and announcement. "
                            "subject_id must be copied from the subject list. "
                            "day_index is an integer 0 through 4 matching the dates given. "
                            "Each of ic, hw, and announcement is at most 800 characters. "
                            "Skip days with nothing to record. Do not invent subjects."
                        ),
                    },
                    {"role": "user", "content": user},
                ],
                "stream": False,
                "thinking": {"type": "disabled"},
            },
            timeout=60,
        )
    except httpx.HTTPError as exc:
        raise UpstreamError("DeepSeek could not summarize the chats.") from exc
    if response.status_code >= 400:
        raise UpstreamError("DeepSeek could not summarize the chats.")
    try:
        content = response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise UpstreamError("The summary could not be read.") from exc
    return _parse_model_json(str(content or ""))


def classify_entries(known_ids: set[str], raw_entries: list) -> tuple[list[dict], list[dict]]:
    accepted: list[dict] = []
    skipped: list[dict] = []
    seen: set[tuple[str, int]] = set()
    if not isinstance(raw_entries, list):
        return [], [_skip("", None, "invalid_payload")]
    for item in raw_entries:
        if not isinstance(item, dict):
            skipped.append(_skip("", None, "invalid_payload"))
            continue
        subject_id = str(item.get("subject_id") or "").strip()
        day_index = item.get("day_index")
        ic = str(item.get("ic") or "").strip()
        hw = str(item.get("hw") or "").strip()
        announcement = str(item.get("announcement") or "").strip()
        day_ok = isinstance(day_index, int) and not isinstance(day_index, bool) and 0 <= day_index <= 4
        if subject_id not in known_ids:
            skipped.append(_skip(subject_id, day_index if day_ok else None, "unknown_subject"))
            continue
        if not day_ok:
            skipped.append(_skip(subject_id, None, "invalid_day"))
            continue
        if any(len(value) > 800 for value in (ic, hw, announcement)):
            skipped.append(_skip(subject_id, day_index, "field_too_long"))
            continue
        if not ic and not hw and not announcement:
            skipped.append(_skip(subject_id, day_index, "empty"))
            continue
        key = (subject_id, day_index)
        if key in seen:
            skipped.append(_skip(subject_id, day_index, "duplicate"))
            continue
        seen.add(key)
        accepted.append(
            {
                "subject_id": subject_id,
                "day_index": day_index,
                "ic": ic,
                "hw": hw,
                "announcement": announcement,
            }
        )
    return accepted, skipped


def state_is_fresh(created_at: str) -> bool:
    try:
        stamp = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=utc_now().tzinfo)
    except ValueError:
        return False
    return utc_now() - stamp <= timedelta(minutes=15)


def _skip(subject_id: str, day_index: int | None, reason: str) -> dict:
    return {"subject_id": subject_id, "day_index": day_index, "reason": reason}


def _keystream(secret: str, nonce: bytes, length: int) -> bytes:
    output = b""
    counter = 0
    while len(output) < length:
        output += hmac.new(
            secret.encode(),
            nonce + counter.to_bytes(4, "big"),
            hashlib.sha256,
        ).digest()
        counter += 1
    return output[:length]


def _token_request(settings, fields: dict) -> dict:
    body = {
        "client_id": settings.microsoft_client_id,
        "client_secret": settings.microsoft_client_secret,
        "scope": _TOKEN_SCOPE,
        **fields,
    }
    try:
        response = httpx.post(
            f"https://login.microsoftonline.com/{settings.microsoft_tenant_id}/oauth2/v2.0/token",
            data=body,
            timeout=30,
        )
    except httpx.HTTPError as exc:
        raise UpstreamError("Microsoft did not accept the Teams sign-in.") from exc
    if response.status_code >= 400:
        raise UpstreamError("Microsoft did not accept the Teams sign-in.")
    try:
        return response.json()
    except ValueError as exc:
        raise UpstreamError("Microsoft did not accept the Teams sign-in.") from exc


def _access_token(settings, refresh_token: str) -> tuple[str, str | None]:
    payload = _token_request(
        settings,
        {"grant_type": "refresh_token", "refresh_token": refresh_token},
    )
    access = payload.get("access_token")
    if not access:
        raise UpstreamError("Teams chats could not be read.")
    rotated = payload.get("refresh_token")
    if rotated == refresh_token:
        rotated = None
    return access, rotated


def _strip_html(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", text).strip()


def _parse_model_json(content: str) -> list:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise UpstreamError("The summary could not be read.") from exc
    if isinstance(payload, dict) and isinstance(payload.get("entries"), list):
        return payload["entries"]
    if isinstance(payload, list):
        return payload
    raise UpstreamError("The summary could not be read.")
