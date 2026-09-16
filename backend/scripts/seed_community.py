"""One-off Community seed. Pass credentials via env; never commit passwords."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get("SEED_API", "http://127.0.0.1:8000/api/v1").rstrip("/")
THREADS = [
    {
        "title": "East Hall laundry: who still has quarters?",
        "body": "The change machine is dark again. If you have a roll, trade in the stairwell after dinner.",
        "floors": [
            "I have a roll in 312. Come by after 8.",
            "Third dryer from the left is the only one that still heats.",
            "Leaving two leftover coins on the windowsill.",
            "Someone unplugged the machine next to the sinks.",
            "If you take the last cart, bring it back before midnight.",
        ],
        "nested": [0],
        "nested_body": "I will come by after evening section.",
    },
    {
        "title": "Saturday intramural at the old gym",
        "body": "East Hall still needs one more for the dorm cup. Court 2, afternoon.",
        "floors": [
            "I can play if we start after 3.",
            "Bring indoor shoes. The floor is waxed.",
            "Faculty pickup is short a guard too.",
        ],
        "nested": [1],
        "nested_body": "We can split the first half if you are late.",
    },
    {
        "title": "Dining hall closed before evening section",
        "body": "The line stopped at 6:40. Anyone know if the late window is actually open tonight?",
        "floors": [
            "The side door was locked when I walked over.",
            "Convenience store still has rice bowls.",
            "They posted a paper note by the tray return.",
        ],
        "nested": [],
        "nested_body": "",
    },
    {
        "title": "Who is staying in the library overnight?",
        "body": "Reading room lights are still on. If you are pulling a long night, say which floor so we can share the quiet tables.",
        "floors": [
            "Third floor east windows, two seats free.",
            "Please keep the group rooms for actual groups.",
            "Front desk said the building stays open until 2.",
            "I can swap a charger if you have a Type-C brick.",
        ],
        "nested": [0],
        "nested_body": "Saving the end seat for you.",
    },
    {
        "title": "Club fair table still needs two more people",
        "body": "Student media needs two extra hands at the quad table Friday. No speeches, just hand out the paper.",
        "floors": [
            "I can take the first hour.",
            "We still need someone who can carry the stack from the office.",
            "If it rains, move under the gym overhang.",
        ],
        "nested": [],
        "nested_body": "",
    },
]


def _request(method: str, path: str, *, token: str | None = None, body: dict | None = None) -> tuple[int, dict | None, str | None]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Cookie", f"scoop_session={token}")
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            cookie = res.headers.get("Set-Cookie")
            payload = json.loads(raw) if raw else None
            return res.status, payload, cookie
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            payload = None
        return exc.code, payload, None


def _cookie_value(header: str | None) -> str:
    if not header:
        return ""
    first = header.split(";", 1)[0]
    if first.startswith("scoop_session="):
        return first.split("=", 1)[1]
    return ""


def _sign_in(email: str, password: str, name: str) -> str:
    status, payload, cookie = _request(
        "POST",
        "/auth/register",
        body={"email": email, "password": password, "display_name": name},
    )
    if status == 201:
        token = _cookie_value(cookie)
        if token:
            return token
    status, payload, cookie = _request(
        "POST",
        "/auth/login",
        body={"email": email, "password": password},
    )
    if status != 200:
        raise SystemExit(f"Could not sign in {email} ({status}).")
    token = _cookie_value(cookie)
    if not token:
        raise SystemExit("Login did not return a session cookie.")
    return token


def _auth() -> tuple[str, str | None]:
    email = os.environ.get("SEED_EMAIL", "").strip()
    password = os.environ.get("SEED_PASSWORD", "")
    name = os.environ.get("SEED_NAME", "Campus Seed")
    if not email or not password:
        raise SystemExit("SEED_EMAIL and SEED_PASSWORD are required.")
    token = _sign_in(email, password, name)
    _request("PUT", "/me/avatar", token=token, body={"preset": os.environ.get("SEED_PRESET", "gym")})
    email_b = os.environ.get("SEED_EMAIL_B", "").strip()
    password_b = os.environ.get("SEED_PASSWORD_B", "")
    name_b = os.environ.get("SEED_NAME_B", "Hall Neighbor")
    second = None
    if email_b and password_b:
        second = _sign_in(email_b, password_b, name_b)
        _request("PUT", "/me/avatar", token=second, body={"preset": os.environ.get("SEED_PRESET_B", "book")})
    return token, second


def main() -> None:
    token, neighbor = _auth()
    status, listed, _ = _request("GET", "/posts?category=community&page_size=50", token=token)
    if status != 200:
        raise SystemExit(f"Could not list community posts ({status}).")
    have = {item["title"] for item in (listed or {}).get("items", [])}
    created = 0
    for thread in THREADS:
        if thread["title"] in have:
            continue
        status, post, _ = _request(
            "POST",
            "/posts",
            token=token,
            body={
                "title": thread["title"],
                "body": thread["body"],
                "category": "community",
                "is_activity": False,
            },
        )
        if status != 201:
            raise SystemExit(f"Could not create {thread['title']!r} ({status}).")
        post_id = post["id"]
        floor_ids: list[str] = []
        for index, body in enumerate(thread["floors"]):
            author = neighbor if neighbor and index % 2 else token
            status, floor, _ = _request(
                "POST",
                f"/posts/{post_id}/comments",
                token=author,
                body={"body": body},
            )
            if status != 201:
                raise SystemExit(f"Could not add floor on {thread['title']!r} ({status}).")
            floor_ids.append(floor["id"])
        for index in thread["nested"]:
            status, _, _ = _request(
                "POST",
                f"/posts/{post_id}/comments",
                token=neighbor or token,
                body={"body": thread["nested_body"], "parent_id": floor_ids[index]},
            )
            if status != 201:
                raise SystemExit(f"Could not add nested reply on {thread['title']!r} ({status}).")
        created += 1
    print(f"seeded {created} community threads", file=sys.stderr)


if __name__ == "__main__":
    main()
