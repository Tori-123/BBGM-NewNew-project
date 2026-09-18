from fastapi.testclient import TestClient
from sqlalchemy import func, select

from errors import StorageError
from main import create_app
from models import AuditEvent, Post


def _make_app(tmp_path, monkeypatch, name="scoop.db", admin_email=""):
    monkeypatch.setenv("SESSION_SECRET", "pytest-session-secret")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / name}")
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://localhost:5173")
    monkeypatch.setenv("ADMIN_EMAIL", admin_email)
    return create_app()


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
    app = _make_app(tmp_path, monkeypatch, admin_email="jordan.hale@example.com")
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "Jordan.Hale@example.com",
                "password": "east-hall-8",
                "display_name": "Jordan Hale",
            },
        )
        assert register.status_code == 201, register.text
        body = register.json()
        assert body["email"] == "jordan.hale@example.com"
        assert body["display_name"] == "Jordan Hale"
        assert body["role"] == "admin"
        assert "password" not in body and "password_hash" not in body
        assert "scoop_session" in register.cookies

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@example.com", "password": "east-hall-8"},
        )
        assert login.status_code == 200, login.text
        assert login.json()["id"] == body["id"]

        created = client.post(
            "/api/v1/posts",
            json={
                "title": "East Hall laundry room will close Friday night",
                "body": "Facilities posted a handwritten note on the basement door.",
                "category": "news",
                "author_id": "should-be-ignored",
                "status": "draft",
            },
        )
        assert created.status_code == 201, created.text
        post = created.json()
        assert post["status"] == "published"
        assert post["excerpt"] == "Facilities posted a handwritten note on the basement door."
        assert post["author"]["id"] == body["id"]
        assert post["author"]["display_name"] == "Jordan Hale"
        assert "body" in post
        assert "audit" not in post

        activity = client.post(
            "/api/v1/posts",
            json={
                "title": "Intramural basketball finals — Saturday at the old gym",
                "body": "East Hall plays the faculty pick-up team for the dorm cup.",
                "category": "sports",
            },
        )
        assert activity.status_code == 201, activity.text
        assert activity.json()["category"] == "sports"
        assert "is_activity" not in activity.json()

        mine = client.get("/api/v1/me/posts")
        assert mine.status_code == 200
        assert mine.json()["total"] == 2
        assert {item["id"] for item in mine.json()["items"]} == {post["id"], activity.json()["id"]}

        with app.state.session_factory() as session:
            audit_count = session.scalar(select(func.count()).select_from(AuditEvent))
            assert audit_count == 2

    with TestClient(app) as guest:
        listed = guest.get("/api/v1/posts")
        assert listed.status_code == 200, listed.text
        assert listed.json()["total"] == 2
        titles = {item["title"] for item in listed.json()["items"]}
        assert "East Hall laundry room will close Friday night" in titles
        sports = next(item for item in listed.json()["items"] if item["category"] == "sports")
        assert sports["title"] == "Intramural basketball finals — Saturday at the old gym"

        detail = guest.get(f"/api/v1/posts/{post['id']}")
        assert detail.status_code == 200
        assert detail.json()["body"] == "Facilities posted a handwritten note on the basement door."

        me = guest.get("/api/v1/me")
        assert me.status_code == 401
        assert me.json()["error"]["code"] == "unauthenticated"

    app.state.engine.dispose()
    reopened = _make_app(tmp_path, monkeypatch)
    with TestClient(reopened) as client:
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@example.com", "password": "east-hall-8"},
        )
        assert login.status_code == 200
        listed = client.get("/api/v1/posts")
        assert listed.json()["total"] == 2
        detail = client.get(f"/api/v1/posts/{post['id']}")
        assert detail.status_code == 200
        assert detail.json()["title"] == "East Hall laundry room will close Friday night"
    reopened.state.engine.dispose()


def test_error_paths_do_not_write_posts(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="priya.nair@example.com")
    with TestClient(app) as client:
        client.post(
            "/api/v1/auth/register",
            json={
                "email": "priya.nair@example.com",
                "password": "old-gym-17",
                "display_name": "Priya Nair",
            },
        )

        bad_login = client.post(
            "/api/v1/auth/login",
            json={"email": "priya.nair@example.com", "password": "wrong-pass"},
        )
        assert bad_login.status_code == 401
        assert bad_login.json()["error"]["code"] == "invalid_credentials"

        missing = client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "old-gym-17"},
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
            json={"email": "priya.nair@example.com", "password": "old-gym-17"},
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
                "category": "sports",
            },
        )
        assert failed.status_code == 503
        assert failed.json()["error"]["code"] == "storage_unavailable"
        listed = client.get("/api/v1/posts")
        assert listed.json()["total"] == 0
        assert listed.json()["items"] == []
    app.state.engine.dispose()


def test_cookie_required_only_on_private_routes(tmp_path, monkeypatch):
    app = _make_app(tmp_path, monkeypatch, admin_email="wei.chen@example.com")
    with TestClient(app) as client:
        client.post(
            "/api/v1/auth/register",
            json={
                "email": "wei.chen@example.com",
                "password": "library-24",
                "display_name": "Wei Chen",
            },
        )
        created = client.post(
            "/api/v1/posts",
            json={
                "title": "Library 24-hour desks start the week before midterms",
                "body": "The third-floor quiet wing will stay open overnight.",
                "category": "news",
            },
        )
        post_id = created.json()["id"]

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
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@example.com")
    with TestClient(app) as client:
        student = client.post(
            "/api/v1/auth/register",
            json={
                "email": "jordan.hale@example.com",
                "password": "east-hall-8",
                "display_name": "Jordan Hale",
            },
        )
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
        assert promote_denied.status_code == 403

        admin = client.post(
            "/api/v1/auth/register",
            json={
                "email": "Ada.Min@example.com",
                "password": "desk-key-99",
                "display_name": "Ada Min",
            },
        )
        assert admin.status_code == 201
        assert admin.json()["role"] == "admin"
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
            json={"email": "jordan.hale@example.com", "password": "east-hall-8"},
        )
        me = client.get("/api/v1/me")
        assert me.json()["role"] == "editor"

        promoted = client.post(
            f"/api/v1/posts/{post_id}/promote",
            json={"category": "news", "title": "East Hall is short on quarters"},
        )
        assert promoted.status_code == 201, promoted.text
        news_id = promoted.json()["id"]
        assert news_id != post_id
        assert promoted.json()["category"] == "news"
        assert promoted.json()["title"] == "East Hall is short on quarters"
        assert guest.get(f"/api/v1/posts/{post_id}").json()["title"] == "Laundry chat in the stairwell"
        assert guest.get("/api/v1/posts").json()["total"] == 1

        paper_comments = guest.get(f"/api/v1/posts/{news_id}/comments")
        assert paper_comments.status_code == 422

        client.post(
            "/api/v1/auth/login",
            json={"email": "jordan.hale@example.com", "password": "east-hall-8"},
        )
        admin_as_editor = client.get("/api/v1/admin/users")
        assert admin_as_editor.status_code == 403

        client.post(
            "/api/v1/auth/login",
            json={"email": "ada.min@example.com", "password": "desk-key-99"},
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
        created = client.post(
            "/api/v1/auth/register",
            json={
                "email": "jordan.hale@example.com",
                "password": "east-hall-8",
                "display_name": "Jordan Hale",
            },
        )
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
    app = _make_app(tmp_path, monkeypatch, admin_email="ada.min@example.com")
    with TestClient(app) as client:
        student = client.post(
            "/api/v1/auth/register",
            json={
                "email": "jordan.hale@example.com",
                "password": "east-hall-8",
                "display_name": "Jordan Hale",
            },
        )
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
        other = guest.post(
            "/api/v1/auth/register",
            json={
                "email": "priya.nair@example.com",
                "password": "old-gym-17",
                "display_name": "Priya Nair",
            },
        )
        assert other.status_code == 201
        stolen = guest.post(
            f"/api/v1/posts/{post_id}/images",
            files={"file": ("nope.png", b"\x89PNG\r\n" + b"x" * 20, "image/png")},
        )
        assert stolen.status_code == 403

        editor = client.post(
            "/api/v1/auth/register",
            json={
                "email": "ada.min@example.com",
                "password": "desk-key-99",
                "display_name": "Ada Min",
            },
        )
        assert editor.status_code == 201
        paper = client.post(
            "/api/v1/posts",
            json={
                "title": "Dryer replacement notice",
                "body": "Facilities will swap the East Hall machines Friday.",
                "category": "news",
            },
        )
        assert paper.json()["images"] == []
        blocked = client.post(
            f"/api/v1/posts/{paper.json()['id']}/images",
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
