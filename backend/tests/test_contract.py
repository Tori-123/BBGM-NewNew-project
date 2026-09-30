from fastapi.testclient import TestClient
from sqlalchemy import func, select

from errors import StorageError
from mail import peek_console_code
from main import create_app
from models import AuditEvent, Post
from validate import normalize_email


def _make_app(tmp_path, monkeypatch, name="scoop.db", admin_email=""):
    monkeypatch.setenv("SESSION_SECRET", "pytest-session-secret")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / name}")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    monkeypatch.setenv("MAIL_BACKEND", "console")
    return create_app()


def _publish_news(client, title, body, heading="Story"):
    created = client.post("/api/v1/news/drafts", json={"title": title})
    assert created.status_code == 201, created.text
    draft_id = created.json()["id"]
    added = client.post(
        f"/api/v1/news/drafts/{draft_id}/blocks",
        json={"heading": heading, "body": body},
    )
    assert added.status_code == 201, added.text
    block_id = added.json()["blocks"][0]["id"]
    submitted = client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{block_id}/submit")
    assert submitted.status_code == 200, submitted.text
    approved = client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{block_id}/approve")
    assert approved.status_code == 200, approved.text
    return draft_id


def _register(client, email, password, display_name):
    sent = client.post("/api/v1/auth/email-codes", json={"email": email, "purpose": "register"})
    assert sent.status_code == 204, sent.text
    code = peek_console_code(normalize_email(email), "register")
    assert code
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": display_name, "code": code},
    )


def test_missing_session_secret_fails_startup(tmp_path, monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'scoop.db'}")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    try:
        create_app()
        raise AssertionError("expected startup to fail")
    except RuntimeError as exc:
        assert "SESSION_SECRET" in str(exc)


def test_register_login_create_post_public_read_and_persist(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="jordan.hale@basischina.com")
    with TestClient(app) as client:
        register = _register(client, "Jordan.Hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert register.status_code == 201, register.text
        body = register.json()
        assert body["email"] == "jordan.hale@basischina.com"
        assert body["display_name"] == "Jordan Hale"
        assert body["role"] == "super_admin"
        assert body["muted"] is False
        assert "password" not in body and "password_hash" not in body
        assert "scoop_session" in register.cookies

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert login.status_code == 200, login.text
        assert login.json()["id"] == body["id"]

        forum = client.post(
            "/api/v1/posts",
            json={
                "title": "Who still has dryer quarters",
                "body": "The change machine is dark.",
                "category": "forum",
                "author_id": "should-be-ignored",
                "status": "draft",
            },
        )
        assert forum.status_code == 201, forum.text

        direct_news = client.post(
            "/api/v1/posts",
            json={
                "title": "East Hall laundry room will close Friday night",
                "body": "Facilities posted a handwritten note on the basement door.",
                "category": "news",
            },
        )
        assert direct_news.status_code == 403

        draft = client.post(
            "/api/v1/news/drafts",
            json={"title": "East Hall laundry room will close Friday night"},
        )
        assert draft.status_code == 201, draft.text
        draft_id = draft.json()["id"]
        held = client.post(
            f"/api/v1/news/drafts/{draft_id}/blocks",
            json={"heading": "Still in draft", "body": "This section stays off the public page."},
        )
        assert held.status_code == 201, held.text
        held_id = held.json()["blocks"][0]["id"]
        live = client.post(
            f"/api/v1/news/drafts/{draft_id}/blocks",
            json={
                "heading": "Friday night",
                "body": "Facilities posted a handwritten note on the basement door.",
            },
        )
        assert live.status_code == 201, live.text
        live_id = next(block["id"] for block in live.json()["blocks"] if block["heading"] == "Friday night")
        submitted = client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{live_id}/submit")
        assert submitted.status_code == 200, submitted.text
        approved = client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{live_id}/approve")
        assert approved.status_code == 200, approved.text
        assert held_id != live_id
        revised = client.patch(
            f"/api/v1/news/drafts/{draft_id}/blocks/{live_id}",
            json={"body": "The machines stay open after all."},
        )
        assert revised.status_code == 200, revised.text
        still_live = client.get(f"/api/v1/posts/{draft_id}")
        assert still_live.json()["blocks"][0]["body"].startswith("Facilities posted")
        assert client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{live_id}/submit").status_code == 200
        assert client.post(f"/api/v1/news/drafts/{draft_id}/blocks/{live_id}/approve").status_code == 200
        updated = client.get(f"/api/v1/posts/{draft_id}")
        assert updated.json()["blocks"][0]["body"] == "The machines stay open after all."
        assert "This section stays off the public page." not in updated.json()["body"]
        post = {"id": draft_id}

        sports = client.post(
            "/api/v1/posts",
            json={
                "title": "Intramural basketball finals — Saturday at the old gym",
                "body": "East Hall plays the faculty pick-up team for the dorm cup.",
                "category": "sports",
            },
        )
        assert sports.status_code == 422

        mine = client.get("/api/v1/me/posts")
        assert mine.status_code == 200
        assert mine.json()["total"] == 2
        assert {item["id"] for item in mine.json()["items"]} == {forum.json()["id"], draft_id}

        with app.state.session_factory() as session:
            audit_count = session.scalar(select(func.count()).select_from(AuditEvent))
            assert audit_count == 2

    with TestClient(app) as guest:
        listed = guest.get("/api/v1/posts")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 1
        assert listed.json()["items"][0]["title"] == "East Hall laundry room will close Friday night"
        assert listed.json()["items"][0]["category"] == "news"

        detail = guest.get(f"/api/v1/posts/{post['id']}")
        assert detail.status_code == 200
        assert detail.json()["blocks"][0]["body"] == "The machines stay open after all."
        assert len(detail.json()["blocks"]) == 1
        assert detail.json()["blocks"][0]["heading"] == "Friday night"
        assert "This section stays off the public page." not in detail.json()["body"]

        me = guest.get("/api/v1/me")
        assert me.status_code == 401
        assert me.json()["error"]["code"] == "unauthenticated"

    app.state.engine.dispose()
    reopened = _make_app(tmp_path, monkeypatch)
    with TestClient(reopened) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert login.status_code == 200
        listed = client.get("/api/v1/posts")
        assert listed.json()["total"] == 1
        detail = client.get(f"/api/v1/posts/{post['id']}")
        assert detail.status_code == 200
        assert detail.json()["title"] == "East Hall laundry room will close Friday night"
    reopened.state.engine.dispose()


def test_error_paths_do_not_write_posts(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="priya.nair@basischina.com")
    with TestClient(app) as client:
        _register(client, "priya.nair@basischina.com", "old-gym-17", "Priya Nair")

        bad_login = client.post(
            "/api/v1/auth/login",
            json={"email": "priya.nair@basischina.com", "password": "wrong-pass"},
        )
        assert bad_login.status_code == 401
        assert bad_login.json()["error"]["code"] == "invalid_credentials"

        missing = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@basischina.com", "password": "old-gym-17"},
        )
        assert missing.status_code == 401
        assert missing.json()["error"]["message"] == "Email or password is incorrect."

    with TestClient(app) as guest:
        unauth = guest.post(
            "/api/v1/posts",
            json={
                "title": "Should not publish",
                "body": "Visitor cannot post.",
                "category": "news",
            },
        )
        assert unauth.status_code == 401
        assert unauth.json()["error"]["code"] == "unauthenticated"

    with TestClient(app) as client:
        client.post(
            "/api/v1/auth/login",
            json={"email": "priya.nair@basischina.com", "password": "old-gym-17"},
        )

        empty_title = client.post(
            "/api/v1/posts",
            json={"title": "   ", "body": "Has a body", "category": "news"},
        )
        assert empty_title.status_code == 422
        assert empty_title.json()["error"]["code"] == "validation_error"

        bad_category = client.post(
            "/api/v1/posts",
            json={
                "title": "Hall gossip",
                "body": "Not a real column.",
                "category": "gossip",
            },
        )
        assert bad_category.status_code == 422

        listed = client.get("/api/v1/posts")
        assert listed.json()["total"] == 0
        with app.state.session_factory() as session:
            assert session.scalar(select(func.count()).select_from(Post)) == 0

        def boom(*_args, **_kwargs):
            raise StorageError("Could not save the post. Try again in a moment.")

        monkeypatch.setattr("routers.posts.create_post_with_audit", boom)
        failed = client.post(
            "/api/v1/posts",
            json={
                "title": "Intramural basketball finals — Saturday at the old gym",
                "body": "East Hall plays the faculty pick-up team for the dorm cup.",
                "category": "forum",
            },
        )
        assert failed.status_code == 503
        assert failed.json()["error"]["code"] == "storage_unavailable"
        listed = client.get("/api/v1/posts")
        assert listed.json()["total"] == 0
        assert listed.json()["items"] == []
    app.state.engine.dispose()


def test_cookie_required_only_on_private_routes(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="wei.chen@basischina.com")
    with TestClient(app) as client:
        _register(client, "wei.chen@basischina.com", "library-24", "Wei Chen")
        post_id = _publish_news(
            client,
            "Library 24-hour desks start the week before midterms",
            "The third-floor quiet wing will stay open overnight.",
        )

        logout = client.post("/api/v1/auth/logout")
        assert logout.status_code == 204
        assert client.get("/api/v1/me").status_code == 401

        listed = client.get("/api/v1/posts")
        assert listed.status_code == 200
        assert listed.json()["total"] == 1

        detail = client.get(f"/api/v1/posts/{post_id}")
        assert detail.status_code == 200

        me = client.get("/api/v1/me")
        assert me.status_code == 401

        create = client.post(
            "/api/v1/posts",
            json={
                "title": "Another note",
                "body": "Needs a session.",
                "category": "news",
            },
        )
        assert create.status_code == 401

        page = client.get("/api/v1/posts?page=0")
        assert page.status_code == 400
        assert page.json()["error"]["code"] == "bad_request"

        category = client.get("/api/v1/posts?category=gossip")
        assert category.status_code == 422

        missing = client.get("/api/v1/posts/00000000-0000-4000-8000-000000000000")
        assert missing.status_code == 404

        not_uuid = client.get("/api/v1/posts/not-a-uuid")
        assert not_uuid.status_code == 400

        patch = client.patch(f"/api/v1/posts/{post_id}", json={"title": "Nope"})
        assert patch.status_code == 405

        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {"status": "ok"}
    app.state.engine.dispose()


def test_student_community_comments_promote_and_admin_roles(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@basischina.com")
    with TestClient(app) as client:
        student = _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert student.status_code == 201
        assert student.json()["role"] == "student"

        blocked = client.post(
            "/api/v1/posts",
            json={
                "title": "Should stay off the paper",
                "body": "Students cannot write news.",
                "category": "news",
            },
        )
        assert blocked.status_code == 403
        assert blocked.json()["error"]["code"] == "forbidden"

        community = client.post(
            "/api/v1/posts",
            json={
                "title": "Laundry chat in the stairwell",
                "body": "Who still has quarters for East Hall?",
                "category": "forum",
            },
        )
        assert community.status_code == 201, community.text
        post_id = community.json()["id"]
        assert community.json()["category"] == "forum"

        home = client.get("/api/v1/posts")
        assert home.status_code == 200
        assert home.json()["total"] == 0

        board = client.get("/api/v1/posts?category=forum")
        assert board.json()["total"] == 1
        assert board.json()["items"][0]["id"] == post_id

        guest = TestClient(app)
        listed = guest.get(f"/api/v1/posts/{post_id}/comments")
        assert listed.status_code == 200
        assert listed.json()["items"] == []
        unauth = guest.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"body": "Saving a dryer for tonight."},
        )
        assert unauth.status_code == 401

        floor = client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"body": "I have a roll in 312."},
        )
        assert floor.status_code == 201, floor.text
        assert floor.json()["floor"] == 1
        assert floor.json()["parent_id"] is None
        floor_id = floor.json()["id"]

        reply = client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"body": "I will come by after dinner.", "parent_id": floor_id},
        )
        assert reply.status_code == 201, reply.text
        assert reply.json()["parent_id"] == floor_id

        nested = client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"body": "Too deep.", "parent_id": reply.json()["id"]},
        )
        assert nested.status_code == 422

        newspaper = guest.get(f"/api/v1/posts/{post_id}")
        news_id = None
        detail = guest.get("/api/v1/posts")
        assert detail.json()["total"] == 0

        comments = guest.get(f"/api/v1/posts/{post_id}/comments")
        assert comments.status_code == 200
        assert comments.json()["total"] == 1
        assert comments.json()["items"][0]["replies"][0]["body"] == "I will come by after dinner."
        assert comments.json()["items"][0]["author"]["avatar"] == "preset:oak"

        board_after = guest.get("/api/v1/posts?category=forum")
        card = board_after.json()["items"][0]
        assert card["reply_count"] == 1
        assert len(card["reply_preview"]) == 1
        assert card["reply_preview"][0]["body"] == "I have a roll in 312."
        home_card = guest.get("/api/v1/posts").json()["items"]
        assert all(item["reply_count"] == 0 and item["reply_preview"] == [] for item in home_card)

        promote_denied = client.post(
            f"/api/v1/posts/{post_id}/promote",
            json={"category": "news"},
        )
        assert promote_denied.status_code == 405

        admin = _register(client, "Ada.Min@basischina.com", "desk-key-99", "Ada Min")
        assert admin.status_code == 201
        assert admin.json()["role"] == "super_admin"
        student_id = student.json()["id"]

        users = client.get("/api/v1/admin/users")
        assert users.status_code == 200
        assert users.json()["total"] == 2

        granted = client.patch(
            f"/api/v1/admin/users/{student_id}",
            json={"role": "editor"},
        )
        assert granted.status_code == 200
        assert granted.json()["role"] == "editor"

        client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        me = client.get("/api/v1/me")
        assert me.json()["role"] == "editor"

        drafted = client.post(
            "/api/v1/news/drafts",
            json={"title": "East Hall is short on quarters"},
        )
        assert drafted.status_code == 201, drafted.text
        news_id = drafted.json()["id"]
        added = client.post(
            f"/api/v1/news/drafts/{news_id}/blocks",
            json={"heading": "Quarters", "body": "East Hall is short on quarters tonight."},
        )
        assert added.status_code == 201, added.text
        block_id = added.json()["blocks"][0]["id"]
        assert client.post(f"/api/v1/news/drafts/{news_id}/blocks/{block_id}/submit").status_code == 200
        editor_approve = client.post(f"/api/v1/news/drafts/{news_id}/blocks/{block_id}/approve")
        assert editor_approve.status_code == 403
        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        approved = client.post(f"/api/v1/news/drafts/{news_id}/blocks/{block_id}/approve")
        assert approved.status_code == 200, approved.text
        assert news_id != post_id
        public = guest.get(f"/api/v1/posts/{news_id}")
        assert public.status_code == 200
        assert public.json()["category"] == "news"
        assert public.json()["blocks"][0]["heading"] == "Quarters"
        assert guest.get(f"/api/v1/posts/{post_id}").json()["title"] == "Laundry chat in the stairwell"
        assert guest.get("/api/v1/posts").json()["total"] == 1

        paper_comments = guest.get(f"/api/v1/posts/{news_id}/comments")
        assert paper_comments.status_code == 422

        client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        admin_as_editor = client.get("/api/v1/admin/users")
        assert admin_as_editor.status_code == 403

        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        revoked = client.patch(
            f"/api/v1/admin/users/{student_id}",
            json={"role": "student"},
        )
        assert revoked.status_code == 200
        assert revoked.json()["role"] == "student"
        cannot_admin = client.patch(
            f"/api/v1/admin/users/{admin.json()['id']}",
            json={"role": "editor"},
        )
        assert cannot_admin.status_code == 403
    app.state.engine.dispose()


def test_avatar_preset_upload_and_reply_preview_cap(tmp_path, monkeypatch):
    import avatars

    monkeypatch.setattr(avatars, "AVATAR_DIR", tmp_path / "avatars")
    app = _make_app(tmp_path, monkeypatch)
    with TestClient(app) as client:
        created = _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert created.json()["avatar"] == "preset:oak"

        preset = client.put("/api/v1/me/avatar", json={"preset": "gym"})
        assert preset.status_code == 200
        assert preset.json()["avatar"] == "preset:gym"

        bad_preset = client.put("/api/v1/me/avatar", json={"preset": "dragon"})
        assert bad_preset.status_code == 422

        upload = client.post(
            "/api/v1/me/avatar",
            files={"file": ("me.png", b"\x89PNG\r\n" + b"x" * 20, "image/png")},
        )
        assert upload.status_code == 200
        assert upload.json()["avatar"].startswith("/uploads/avatars/")

        huge = client.post(
            "/api/v1/me/avatar",
            files={"file": ("big.png", b"x" * 1_000_001, "image/png")},
        )
        assert huge.status_code == 422

        wrong = client.post(
            "/api/v1/me/avatar",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert wrong.status_code == 422

        post = client.post(
            "/api/v1/posts",
            json={
                "title": "Five floors in the laundry thread",
                "body": "Post the machine number if you grab one.",
                "category": "forum",
            },
        )
        post_id = post.json()["id"]
        for index in range(5):
            reply = client.post(
                f"/api/v1/posts/{post_id}/comments",
                json={"body": f"Floor {index + 1} is open."},
            )
            assert reply.status_code == 201

        board = client.get("/api/v1/posts?category=forum")
        card = board.json()["items"][0]
        assert card["reply_count"] == 5
        assert len(card["reply_preview"]) == 4
        assert card["author"]["avatar"].startswith("/uploads/avatars/")
        assert card["images"] == []
    app.state.engine.dispose()


def test_community_post_images_and_newspaper_rejected(tmp_path, monkeypatch):
    import avatars

    monkeypatch.setattr(avatars, "POST_IMAGE_DIR", tmp_path / "posts")
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@basischina.com")
    with TestClient(app) as client:
        student = _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert student.status_code == 201
        community = client.post(
            "/api/v1/posts",
            json={
                "title": "Photo of the broken dryer",
                "body": "The third machine is still leaking.",
                "category": "forum",
            },
        )
        post_id = community.json()["id"]
        assert community.json()["images"] == []

        first = client.post(
            f"/api/v1/posts/{post_id}/images",
            files={"file": ("leak.png", b"\x89PNG\r\n" + b"x" * 20, "image/png")},
        )
        assert first.status_code == 200, first.text
        assert len(first.json()["images"]) == 1
        assert first.json()["images"][0].startswith(f"/uploads/posts/{post_id}/")

        for index in range(3):
            extra = client.post(
                f"/api/v1/posts/{post_id}/images",
                files={"file": (f"extra-{index}.png", b"\x89PNG\r\n" + b"y" * 20, "image/png")},
            )
            assert extra.status_code == 200
        overflow = client.post(
            f"/api/v1/posts/{post_id}/images",
            files={"file": ("too-many.png", b"\x89PNG\r\n" + b"z" * 20, "image/png")},
        )
        assert overflow.status_code == 422

        board = client.get("/api/v1/posts?category=forum")
        assert len(board.json()["items"][0]["images"]) == 4
        home = client.get("/api/v1/posts")
        assert home.json()["items"] == []

        guest = TestClient(app)
        other = _register(guest, "priya.nair@basischina.com", "old-gym-17", "Priya Nair")
        assert other.status_code == 201
        stolen = guest.post(
            f"/api/v1/posts/{post_id}/images",
            files={"file": ("nope.png", b"\x89PNG\r\n" + b"x" * 20, "image/png")},
        )
        assert stolen.status_code == 403

        editor = _register(client, "ada.min@basischina.com", "desk-key-99", "Ada Min")
        assert editor.status_code == 201
        news_id = _publish_news(
            client,
            "Dryer replacement notice",
            "Facilities will swap the East Hall machines Friday.",
        )
        assert client.get(f"/api/v1/posts/{news_id}").json()["images"] == []
        blocked = client.post(
            f"/api/v1/posts/{news_id}/images",
            files={"file": ("cover.png", b"\x89PNG\r\n" + b"x" * 20, "image/png")},
        )
        assert blocked.status_code == 422
        listed = client.get("/api/v1/posts")
        assert listed.json()["items"][0]["images"] == []

        before = client.get("/api/v1/posts?category=forum").json()["total"]
        bad_multi = client.post(
            "/api/v1/posts",
            data={"title": "Should not land", "body": "Bad attachment.", "category": "forum"},
            files=[("images", ("notes.txt", b"hello", "text/plain"))],
        )
        assert bad_multi.status_code == 422
        assert client.get("/api/v1/posts?category=forum").json()["total"] == before

        paper_images = client.post(
            "/api/v1/posts",
            data={"title": "Paper with photo", "body": "Should fail.", "category": "news"},
            files=[("images", ("cover.png", b"\x89PNG\r\n" + b"x" * 20, "image/png"))],
        )
        assert paper_images.status_code == 422

        created = client.post(
            "/api/v1/posts",
            data={
                "title": "One-shot laundry photo",
                "body": "The leak from the third machine.",
                "category": "forum",
            },
            files=[("images", ("leak.png", b"\x89PNG\r\n" + b"x" * 20, "image/png"))],
        )
        assert created.status_code == 201, created.text
        assert created.json()["category"] == "forum"
        assert len(created.json()["images"]) == 1
    app.state.engine.dispose()


def test_forum_likes_idempotent_guest_and_newspaper_rejected(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="jordan.hale@basischina.com")
    with TestClient(app) as client:
        _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        forum = client.post(
            "/api/v1/posts",
            json={
                "title": "Who has dryer quarters?",
                "body": "The change machine is still dark.",
                "category": "forum",
            },
        )
        post_id = forum.json()["id"]
        assert forum.json()["like_count"] == 0
        assert forum.json()["liked"] is False

        first = client.post(f"/api/v1/posts/{post_id}/likes")
        assert first.status_code == 201, first.text
        assert first.json() == {"like_count": 1, "liked": True}

        again = client.post(f"/api/v1/posts/{post_id}/likes")
        assert again.status_code == 200
        assert again.json()["like_count"] == 1

        listed = client.get("/api/v1/posts?category=forum")
        card = listed.json()["items"][0]
        assert card["like_count"] == 1
        assert card["liked"] is True

        guest = TestClient(app)
        guest_list = guest.get("/api/v1/posts?category=forum")
        assert guest_list.json()["items"][0]["liked"] is False
        assert guest_list.json()["items"][0]["like_count"] == 1
        assert guest.post(f"/api/v1/posts/{post_id}/likes").status_code == 401

        removed = client.delete(f"/api/v1/posts/{post_id}/likes")
        assert removed.status_code == 200
        assert removed.json() == {"like_count": 0, "liked": False}
        assert client.delete(f"/api/v1/posts/{post_id}/likes").json()["like_count"] == 0

        news_id = _publish_news(
            client,
            "East Hall laundry: who still has quarters?",
            "The change machine is dark again.",
        )
        paper_like = client.post(f"/api/v1/posts/{news_id}/likes")
        assert paper_like.status_code == 422
        home = client.get("/api/v1/posts")
        assert home.json()["items"][0]["like_count"] == 0
        assert home.json()["items"][0]["liked"] is False
    app.state.engine.dispose()


def test_admin_delete_post_and_ban_account(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@basischina.com")
    with TestClient(app) as client:
        student = _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert student.status_code == 201
        assert student.json()["muted"] is False
        student_id = student.json()["id"]
        created = client.post(
            "/api/v1/posts",
            json={
                "title": "Who still has the dorm key",
                "body": "It was on the oak table.",
                "category": "forum",
            },
        )
        assert created.status_code == 201, created.text
        post_id = created.json()["id"]
        replied = client.post(
            f"/api/v1/posts/{post_id}/comments",
            json={"body": "I saw it after dinner."},
        )
        assert replied.status_code == 201, replied.text

        denied = client.delete(f"/api/v1/posts/{post_id}")
        assert denied.status_code == 403
        assert client.get(f"/api/v1/posts/{post_id}").status_code == 200

        ban_denied = client.patch(
            f"/api/v1/admin/users/{student_id}",
            json={"muted": True},
        )
        assert ban_denied.status_code == 403

        _register(client, "ada.min@basischina.com", "desk-key-99", "Ada Min")
        admin = client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        assert admin.status_code == 200, admin.text
        admin_id = admin.json()["id"]

        self_ban = client.patch(f"/api/v1/admin/users/{admin_id}", json={"muted": True})
        assert self_ban.status_code == 403

        removed = client.delete(f"/api/v1/posts/{post_id}")
        assert removed.status_code == 204
        assert client.get(f"/api/v1/posts/{post_id}").status_code == 404
        client.cookies.clear()
        client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        notices = client.get("/api/v1/me/notices")
        assert notices.status_code == 200
        assert any("Who still has the dorm key" in item["body"] for item in notices.json()["items"])
        client.cookies.clear()
        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        listed = client.get("/api/v1/posts?category=forum")
        assert all(item["id"] != post_id for item in listed.json()["items"])

        kept = client.post(
            "/api/v1/posts",
            json={
                "title": "Ada keeps this note",
                "body": "Written before the ban test continues.",
                "category": "forum",
            },
        )
        # admin is editor-capable; the kept post is admin's. Student still has no second post.
        # Re-login as student and publish one that must survive a ban.
        client.cookies.clear()
        student_login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert student_login.status_code == 200
        survivor = client.post(
            "/api/v1/posts",
            json={
                "title": "Jordan's note stays up",
                "body": "Ban should not hide this.",
                "category": "forum",
            },
        )
        assert survivor.status_code == 201, survivor.text
        survivor_id = survivor.json()["id"]

        client.cookies.clear()
        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        muted = client.patch(f"/api/v1/admin/users/{student_id}", json={"muted": True})
        assert muted.status_code == 200, muted.text
        assert muted.json()["muted"] is True

        client.cookies.clear()
        locked = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert locked.status_code == 200, locked.text
        muted_post = client.post(
            "/api/v1/posts",
            json={
                "title": "Should not publish while muted",
                "body": "Mute blocks new posts.",
                "category": "forum",
            },
        )
        assert muted_post.status_code == 403
        assert muted_post.json()["error"]["code"] == "account_muted"
        still_there = client.get(f"/api/v1/posts/{survivor_id}")
        assert still_there.status_code == 200
        assert still_there.json()["title"] == "Jordan's note stays up"

        client.cookies.clear()
        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@basischina.com", "password": "desk-key-99"},
        )
        unmuted = client.patch(f"/api/v1/admin/users/{student_id}", json={"muted": False})
        assert unmuted.status_code == 200
        assert unmuted.json()["muted"] is False
        deleted = client.delete(f"/api/v1/admin/users/{student_id}")
        assert deleted.status_code == 204
        assert client.get(f"/api/v1/posts/{survivor_id}").status_code == 404
        client.cookies.clear()
        gone = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert gone.status_code == 401
        assert kept.status_code == 201
    app.state.engine.dispose()


def test_school_email_codes_register_and_password_reset(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch)
    with TestClient(app) as client:
        outside = client.post(
            "/api/v1/auth/email-codes",
            json={"email": "visitor@gmail.com", "purpose": "register"},
        )
        assert outside.status_code == 422, outside.text
        assert outside.json()["error"]["fields"][0]["field"] == "email"
        assert peek_console_code("visitor@gmail.com", "register") is None

        outside_login = client.post(
            "/api/v1/auth/login",
            json={"email": "visitor@gmail.com", "password": "east-hall-8"},
        )
        assert outside_login.status_code == 422
        assert outside_login.json()["error"]["fields"][0]["field"] == "email"

        no_code = client.post(
            "/api/v1/auth/register",
            json={
                "email": "jordan.hale@basischina.com",
                "password": "east-hall-8",
                "display_name": "Jordan Hale",
                "code": "000000",
            },
        )
        assert no_code.status_code == 422
        assert no_code.json()["error"]["fields"][0]["field"] == "code"

        created = _register(client, "jordan.hale@basischina.com", "east-hall-8", "Jordan Hale")
        assert created.status_code == 201, created.text

        taken = client.post(
            "/api/v1/auth/email-codes",
            json={"email": "jordan.hale@basischina.com", "purpose": "register"},
        )
        assert taken.status_code == 409

        reset_send = client.post(
            "/api/v1/auth/email-codes",
            json={"email": "jordan.hale@basischina.com", "purpose": "reset"},
        )
        assert reset_send.status_code == 204, reset_send.text
        reset_code = peek_console_code("jordan.hale@basischina.com", "reset")
        assert reset_code

        unknown = client.post(
            "/api/v1/auth/email-codes",
            json={"email": "ghost@basischina.com", "purpose": "reset"},
        )
        assert unknown.status_code == 204
        assert peek_console_code("ghost@basischina.com", "reset") is None

        reset = client.post(
            "/api/v1/auth/password-reset",
            json={
                "email": "jordan.hale@basischina.com",
                "code": reset_code,
                "password": "new-hall-99",
            },
        )
        assert reset.status_code == 204, reset.text

        old_login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "east-hall-8"},
        )
        assert old_login.status_code == 401
        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@basischina.com", "password": "new-hall-99"},
        )
        assert new_login.status_code == 200, new_login.text
    app.state.engine.dispose()


def test_news_block_position(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@basischina.com")
    with TestClient(app) as client:
        created = _register(client, "ada.min@basischina.com", "desk-key-99", "Ada Min")
        assert created.status_code == 201, created.text
        drafted = client.post("/api/v1/news/drafts", json={"title": "Front page layout"})
        assert drafted.status_code == 201, drafted.text
        draft_id = drafted.json()["id"]
        placed = client.post(
            f"/api/v1/news/drafts/{draft_id}/blocks",
            json={"heading": "Late", "body": "The late slot.", "position": 5},
        )
        assert placed.status_code == 201, placed.text
        blocks = placed.json()["blocks"]
        assert len(blocks) == 1
        assert blocks[0]["position"] == 5
        again = client.post(
            f"/api/v1/news/drafts/{draft_id}/blocks",
            json={"heading": "Again", "body": "That slot is taken.", "position": 5},
        )
        assert again.status_code == 422
        assert again.json()["error"]["fields"][0]["field"] == "position"
    app.state.engine.dispose()
