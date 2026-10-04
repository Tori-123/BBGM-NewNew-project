import hmac
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from deps import get_db
from errors import ApiError, validation_error
from models import CJEntry, Exam, Subject, to_iso, utc_now

router = APIRouter()

_WEEK = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME = re.compile(r"^\d{2}:\d{2}$")
_LOCAL_CODE = "CJ-DEMO"

_SUBJECTS = [
    ("ap-calculus", "AP Calculus AB", "AP Cal AB", "#2563eb", 1, 1),
    ("biology", "Biology", "Biology", "#0891b2", 1, 2),
    ("ap-physics", "AP Physics 1", "AP Physics", "#3b82f6", 2, 3),
    ("chinese", "Chinese", "Chinese", "#6366f1", 3, 4),
    ("ap-language", "AP English Language", "AP Lang", "#1d4ed8", 4, 5),
    ("world-history", "World History", "History", "#0e7490", 4, 6),
    ("ap-economics", "AP Economics", "AP Eco", "#0284c7", 5, 7),
    ("ap-csa", "AP Computer Science A", "AP CSA", "#4f46e5", 7, 8),
]

# day_index, period, subject_id, ic, hw, announcement
_SAMPLE_ENTRIES = [
    (0, 1, "ap-calculus", "Limits and continuity review", "Complete FRQ Set 2 · Q1–4", "Quiz on Wednesday"),
    (0, 1, "biology", "Cellular respiration overview", "Complete lab analysis questions 1–5", "Bring safety goggles Wednesday"),
    (0, 2, "ap-physics", "Newton’s 3rd Law", "ES 7 · Q3, 5, 38, 46", "Lab groups posted"),
    (0, 4, "ap-language", "Rhetorical situation & audience", "Annotate ‘The Gettysburg Address’", "Bring the blue reader"),
    (0, 5, "ap-economics", "Demand shifts and market equilibrium", "Module 3.2 practice", "Unit 2 exam Friday"),
    (0, 7, "ap-csa", "String methods and immutability", "CodingBat String-1 · 1–8", "Office hour 16:20"),
    (1, 1, "ap-calculus", "Implicit differentiation", "RB 3.2 · #7–12", ""),
    (1, 1, "biology", "Aerobic and anaerobic respiration", "Read 6.3 and complete notes", ""),
    (1, 2, "ap-physics", "Free-body diagrams", "Finish cart lab analysis", "Lab report due Thursday"),
    (1, 4, "ap-language", "Claims, evidence, commentary", "Draft body paragraph", "Peer review next class"),
    (1, 5, "ap-economics", "Price elasticity of demand", "3.3 guided notes", "Bring calculator"),
    (1, 7, "ap-csa", "Nested loops", "Program: pattern printer", "Check rubric before upload"),
    (2, 1, "ap-calculus", "Related rates", "Worksheet · #1–6", "Quiz today"),
    (2, 1, "biology", "Mitosis and the cell cycle", "Cell cycle diagram", "Lab next class"),
    (2, 2, "ap-physics", "Friction and inclined planes", "ES 8 · odd questions", ""),
    (2, 4, "ap-language", "Synthesis source evaluation", "Read sources A–D", "Timed write Friday"),
    (2, 5, "ap-economics", "Tax incidence", "Graph 4 market scenarios", "Unit 2 review opens"),
    (2, 7, "ap-csa", "ArrayList traversal", "Lab checkpoint 1", "Commit before 20:00"),
    (3, 1, "ap-calculus", "Linearization", "Textbook 4.1 · #9–21 odd", ""),
    (3, 1, "biology", "DNA replication", "Complete replication worksheet", ""),
    (3, 2, "ap-physics", "Circular motion introduction", "Lab report final draft", "Lab report due 22:00"),
    (3, 4, "ap-language", "Counterargument workshop", "Revise thesis + outline", "Conference sign-up"),
    (3, 5, "ap-economics", "Government intervention", "Unit 2 review sheet", "Exam tomorrow"),
    (3, 7, "ap-csa", "2D arrays", "GridWalker methods", ""),
    (4, 1, "ap-calculus", "Optimization", "Weekend mixed practice", "Corrections due Monday"),
    (4, 1, "biology", "Protein synthesis", "Transcription practice", ""),
    (4, 2, "ap-physics", "Centripetal force", "Read 6.2 + notes", ""),
    (4, 4, "ap-language", "Timed synthesis essay", "Reflection form", "Submit by 18:00"),
    (4, 5, "ap-economics", "Unit 2 assessment", "No HW", "Assessment in class"),
    (4, 7, "ap-csa", "2D array algorithms", "Finish GridWalker", "Demo next Monday"),
]

_SAMPLE_EXAMS = [
    (2, "AP Calculus AB · Unit Quiz", "10:05", "Room 402", "Related rates and implicit differentiation"),
    (4, "AP Economics · Unit 2 Exam", "13:35", "Room 305", "Bring a calculator"),
]


def _same(left: str, right: str) -> bool:
    if len(left) != len(right):
        return False
    return hmac.compare_digest(left, right)


def _require_admin(request: Request, code: str | None) -> None:
    provided = (code or "").strip()
    configured = request.app.state.settings.cj_admin_code
    if configured:
        ok = _same(provided, configured)
    else:
        host = request.url.hostname
        ok = host in {"localhost", "127.0.0.1"} and _same(provided, _LOCAL_CODE)
    if not ok:
        raise ApiError(401, "unauthenticated", "The CJ admin code is incorrect.")


def _week_or_error(value: str) -> str:
    if not _WEEK.fullmatch(value or ""):
        raise validation_error([{"field": "week_start", "message": "Use a YYYY-MM-DD date."}])
    return value


def _slot(db: Session, week_start: str, day_index: int, period: int, subject_id: str) -> CJEntry | None:
    return db.scalar(
        select(CJEntry).where(
            CJEntry.week_start == week_start,
            CJEntry.day_index == day_index,
            CJEntry.period == period,
            CJEntry.subject_id == subject_id,
        )
    )


def _ensure_seed(db: Session, week_start: str) -> None:
    now = to_iso(utc_now())
    for subject_id, name, short_name, color, period, sort_order in _SUBJECTS:
        row = db.get(Subject, subject_id)
        if row is None:
            db.add(
                Subject(
                    id=subject_id,
                    name=name,
                    short_name=short_name,
                    color=color,
                    period=period,
                    sort_order=sort_order,
                )
            )
        else:
            row.name = name
            row.short_name = short_name
            row.color = color
            row.period = period
            row.sort_order = sort_order
    db.flush()

    total = db.scalar(select(func.count()).select_from(CJEntry)) or 0
    if total == 0:
        for index, entry in enumerate(_SAMPLE_ENTRIES):
            day_index, period, subject_id, ic, hw, announcement = entry
            db.add(
                CJEntry(
                    id=f"sample-{index + 1}",
                    week_start=week_start,
                    day_index=day_index,
                    period=period,
                    subject_id=subject_id,
                    ic=ic,
                    hw=hw,
                    announcement=announcement,
                    updated_at=now,
                )
            )
        db.flush()

    for entry in _SAMPLE_ENTRIES:
        if entry[2] != "biology":
            continue
        day_index, period, subject_id, ic, hw, announcement = entry
        if _slot(db, week_start, day_index, period, subject_id) is None:
            db.add(
                CJEntry(
                    id=f"biology-v2-{day_index}",
                    week_start=week_start,
                    day_index=day_index,
                    period=period,
                    subject_id=subject_id,
                    ic=ic,
                    hw=hw,
                    announcement=announcement,
                    updated_at=now,
                )
            )

    exam_total = db.scalar(select(func.count()).select_from(Exam)) or 0
    if exam_total == 0:
        for index, exam in enumerate(_SAMPLE_EXAMS):
            day_index, title, time, location, note = exam
            db.add(
                Exam(
                    id=f"exam-sample-{index + 1}",
                    week_start=week_start,
                    day_index=day_index,
                    title=title,
                    time=time,
                    location=location,
                    note=note,
                    updated_at=now,
                )
            )
    db.flush()


def _subject_payload(row: Subject) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "short_name": row.short_name,
        "color": row.color,
    }


def _entry_payload(row: CJEntry) -> dict:
    return {
        "id": row.id,
        "week_start": row.week_start,
        "day_index": row.day_index,
        "period": row.period,
        "subject_id": row.subject_id,
        "ic": row.ic,
        "hw": row.hw,
        "announcement": row.announcement,
        "updated_at": row.updated_at,
    }


def _exam_payload(row: Exam) -> dict:
    return {
        "id": row.id,
        "week_start": row.week_start,
        "day_index": row.day_index,
        "title": row.title,
        "time": row.time,
        "location": row.location,
        "note": row.note,
        "updated_at": row.updated_at,
    }


@router.get("/cj")
def read_cj(week_start: str = "", db: Session = Depends(get_db)):
    week = _week_or_error(week_start)
    _ensure_seed(db, week)
    subjects = db.scalars(select(Subject).order_by(Subject.sort_order, Subject.name)).all()
    entries = db.scalars(
        select(CJEntry)
        .where(CJEntry.week_start == week)
        .order_by(CJEntry.day_index, CJEntry.period)
    ).all()
    exams = db.scalars(
        select(Exam).where(Exam.week_start == week).order_by(Exam.day_index, Exam.time)
    ).all()
    return {
        "week_start": week,
        "subjects": [_subject_payload(row) for row in subjects],
        "entries": [_entry_payload(row) for row in entries],
        "exams": [_exam_payload(row) for row in exams],
    }


@router.put("/cj")
def save_cj(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
    x_cj_admin_code: str | None = Header(default=None),
):
    _require_admin(request, x_cj_admin_code)
    week = _week_or_error(str(body.get("week_start") or ""))
    subject_id = str(body.get("subject_id") or "").strip()
    day_index = body.get("day_index")
    ic = str(body.get("ic") or "").strip()
    hw = str(body.get("hw") or "").strip()
    announcement = str(body.get("announcement") or "").strip()
    fields = []
    if not subject_id:
        fields.append({"field": "subject_id", "message": "Choose a subject."})
    if not isinstance(day_index, int) or isinstance(day_index, bool) or day_index < 0 or day_index > 4:
        fields.append({"field": "day_index", "message": "Choose Monday through Friday."})
    if any(len(value) > 800 for value in (ic, hw, announcement)):
        fields.append({"field": "ic", "message": "IC, HW, and A must be 800 characters or fewer."})
    if fields:
        raise validation_error(fields)

    subject = db.get(Subject, subject_id)
    if subject is None:
        raise ApiError(404, "not_found", "Subject not found.")
    existing = _slot(db, week, day_index, subject.period, subject_id)
    updated_at = to_iso(utc_now())
    if existing is None:
        existing = CJEntry(
            id=str(uuid4()),
            week_start=week,
            day_index=day_index,
            period=subject.period,
            subject_id=subject_id,
            ic=ic,
            hw=hw,
            announcement=announcement,
            updated_at=updated_at,
        )
        db.add(existing)
    else:
        existing.ic = ic
        existing.hw = hw
        existing.announcement = announcement
        existing.updated_at = updated_at
    db.flush()
    return {"id": existing.id, "updated_at": updated_at}


@router.put("/cj/exams")
def save_exam(
    request: Request,
    body: dict,
    db: Session = Depends(get_db),
    x_cj_admin_code: str | None = Header(default=None),
):
    _require_admin(request, x_cj_admin_code)
    week = _week_or_error(str(body.get("week_start") or ""))
    day_index = body.get("day_index")
    title = str(body.get("title") or "").strip()
    time = str(body.get("time") or "").strip()
    location = str(body.get("location") or "").strip()
    note = str(body.get("note") or "").strip()
    fields = []
    if not isinstance(day_index, int) or isinstance(day_index, bool) or day_index < 0 or day_index > 4:
        fields.append({"field": "day_index", "message": "Choose Monday through Friday."})
    if not title:
        fields.append({"field": "title", "message": "Enter the exam name."})
    if not _TIME.fullmatch(time):
        fields.append({"field": "time", "message": "Use a HH:MM time."})
    if any(len(value) > 800 for value in (title, location, note)):
        fields.append({"field": "title", "message": "Exam text must be 800 characters or fewer."})
    if fields:
        raise validation_error(fields)

    exam_id = str(body.get("id") or "").strip() or str(uuid4())
    updated_at = to_iso(utc_now())
    row = db.get(Exam, exam_id)
    if row is None:
        row = Exam(
            id=exam_id,
            week_start=week,
            day_index=day_index,
            title=title,
            time=time,
            location=location,
            note=note,
            updated_at=updated_at,
        )
        db.add(row)
    else:
        row.week_start = week
        row.day_index = day_index
        row.title = title
        row.time = time
        row.location = location
        row.note = note
        row.updated_at = updated_at
    db.flush()
    return {"id": row.id, "updated_at": updated_at}
