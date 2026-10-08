import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import CjPortalBadge from "../components/CjPortalBadge";
import CjSchedulePicker from "../components/CjSchedulePicker";
import {
  PERIOD_COUNT,
  SCHEDULE_KEY,
  SCHEDULE_PROFILE_KEY,
  WEEKDAY_SHORT,
  dateFromIso,
  defaultSchedule,
  isoDate,
  mondayOf,
  nextSchoolDay,
  normalizeSchedule,
  periodTimeLabel,
  previousSchoolDay,
} from "../cjDates";
import { useLiveRefresh } from "../live";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function CjWeekRedirect() {
  const [params] = useSearchParams();
  const start = params.get("start") || "";
  const date = ISO.test(start) ? start : isoDate(new Date());
  return <Navigate to={`/cj/student/day?date=${date}`} replace />;
}

function readSavedSchedule(subjects) {
  const profile = window.localStorage.getItem(SCHEDULE_PROFILE_KEY) || "11Ac";
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(SCHEDULE_KEY) || "null");
  } catch {
    saved = null;
  }
  return { profile, schedule: normalizeSchedule(saved || defaultSchedule(subjects, profile), subjects, profile) };
}

export default function CjDay({
  portal = "student",
  calendarPath = "/cj/student/calendar",
  detailPath = "/cj/student/course",
  weekPath = "/cj/student/week",
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("date") || "";
  const date = useMemo(() => (ISO.test(raw) ? dateFromIso(raw) : dateFromIso(isoDate(new Date()))), [raw]);
  const weekStart = useMemo(() => mondayOf(date), [date]);
  const dayIndex = Math.round((date.getTime() - weekStart.getTime()) / 86400000);
  const schoolDay = dayIndex >= 0 && dayIndex <= 4;

  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [draftSelection, setDraftSelection] = useState([]);
  const [profile, setProfile] = useState("11Ac");
  const [draftProfile, setDraftProfile] = useState("11Ac");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDay = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.readCj(isoDate(weekStart));
      setData(payload);
      const saved = readSavedSchedule(payload.subjects);
      setProfile(saved.profile);
      setDraftProfile(saved.profile);
      setSelected(saved.schedule);
      setDraftSelection(saved.schedule);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load CJ.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const refreshDay = useCallback(async () => {
    const payload = await api.readCj(isoDate(weekStart));
    setData(payload);
  }, [weekStart]);
  useLiveRefresh(Boolean(data) && !pickerOpen, refreshDay);

  const subjectMap = useMemo(
    () => new Map((data?.subjects || []).map((subject) => [subject.id, subject])),
    [data],
  );
  const periods = useMemo(
    () => Array.from({ length: PERIOD_COUNT }, (_, index) => ({
      period: index + 1,
      subject: subjectMap.get(selected[index]) || null,
    })),
    [selected, subjectMap],
  );
  const exams = (data?.exams || []).filter((exam) => exam.day_index === dayIndex);
  const homework = (data?.entries || []).filter(
    (entry) => entry.day_index === dayIndex && entry.hw && selected.includes(entry.subject_id),
  );

  function saveSelection(next, nextProfile) {
    setSelected(next);
    setDraftSelection(next);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
    window.localStorage.setItem(SCHEDULE_PROFILE_KEY, nextProfile);
    setPickerOpen(false);
  }

  function moveDay(nextDate) {
    setParams({ date: isoDate(nextDate) });
  }

  const heading = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const selectedCount = periods.filter((item) => item.subject).length;

  return (
    <section className="mt-8">
      <CjPortalBadge portal={portal} />
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">
            Daily CJ · {profile}
          </p>
          <h1 className="mt-1 font-sans text-2xl font-semibold">{heading}</h1>
          <p className="mt-1 font-sans text-xs text-neutral-500">{selectedCount} courses · 11 periods</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
          <button type="button" aria-label="Previous day" title="Previous day" onClick={() => moveDay(previousSchoolDay(date))} className="h-9 w-9 border border-black text-lg">‹</button>
          <Link aria-label="Weekly view" title="Weekly view" to={`${weekPath}?start=${isoDate(weekStart)}`} className="flex h-9 w-9 items-center justify-center border border-black text-inherit no-underline">▦</Link>
          <Link aria-label="Calendar" title="Calendar" to={calendarPath} className="flex h-9 w-9 items-center justify-center border border-black text-inherit no-underline">◫</Link>
          <button type="button" aria-label="Next day" title="Next day" onClick={() => moveDay(nextSchoolDay(date))} className="h-9 w-9 border border-black text-lg">›</button>
          <button
            type="button"
            disabled={!data}
            onClick={() => setPickerOpen((open) => !open)}
            className="bg-black px-3 py-2 text-white disabled:opacity-40"
          >
            Courses
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <CjSchedulePicker
          subjects={data?.subjects || []}
          profile={draftProfile}
          selection={draftSelection}
          onProfileChange={setDraftProfile}
          onSelectionChange={setDraftSelection}
          onSave={saveSelection}
        />
      ) : null}

      {error ? (
        <div className="mt-6 border border-black p-4">
          <p className="font-sans text-sm">{error}</p>
          <button type="button" onClick={loadDay} className="mt-3 font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">Reload</button>
        </div>
      ) : schoolDay ? (
        <section className="mt-4 overflow-hidden border border-black bg-white">
          <header className="border-b border-black px-3 py-2">
            <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#1A4FBF]">{WEEKDAY_SHORT[dayIndex]}</p>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-serif text-2xl">{heading}</h2>
              <span className="font-sans text-xs text-neutral-500">{isoDate(date)}</span>
            </div>
          </header>
          <div className="grid gap-px bg-neutral-200">
            {loading
              ? Array.from({ length: PERIOD_COUNT }, (_, index) => <div key={index} className="h-24 bg-white" />)
              : periods.map(({ period, subject }) => {
                  const entry = subject
                    ? (data?.entries || []).find((item) => item.day_index === dayIndex && item.subject_id === subject.id)
                    : null;
                  return (
                    <CourseRow
                      key={period}
                      period={period}
                      subject={subject}
                      entry={entry}
                      date={isoDate(date)}
                      detailPath={detailPath}
                    />
                  );
                })}
          </div>
        </section>
      ) : (
        <p className="mt-6 border border-neutral-200 p-4 font-sans text-sm text-neutral-500">This date is not a school day.</p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HomeworkList homework={homework} subjects={data?.subjects || []} loading={loading} />
        <ExamList exams={exams} subjects={data?.subjects || []} loading={loading} />
      </div>
    </section>
  );
}

function CourseRow({ period, subject, entry, date, detailPath }) {
  const content = (
    <article className={`grid min-h-14 gap-2 bg-white px-3 py-2 transition-colors sm:grid-cols-[125px_1fr] ${subject ? "hover:bg-[#f7f9fd]" : ""}`}>
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
        <span className="inline-block bg-black px-2 py-1 font-sans text-[10px] text-white">P{period}</span>
        <p className="font-sans text-[10px] text-neutral-600">{periodTimeLabel(period)}</p>
      </div>
      {subject ? (
        <div className="grid items-center gap-2 sm:grid-cols-[minmax(150px,0.8fr)_2fr]">
          <div className="min-w-0">
            <h3 className="truncate font-sans text-sm font-semibold">{subject.short_name}</h3>
            <p className="truncate font-sans text-[10px] text-neutral-500">{subject.teacher} · {subject.room}</p>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-3">
            <Info label="IC" value={entry?.ic} />
            <Info label="HW" value={entry?.hw} />
            <Info label="A" value={entry?.announcement} />
          </div>
        </div>
      ) : (
        <div className="flex items-center font-sans text-xs text-neutral-400">—</div>
      )}
    </article>
  );
  if (!subject) return content;
  const query = new URLSearchParams({ date, period: String(period), subject: subject.id });
  return <Link to={`${detailPath}?${query}`} className="block text-inherit no-underline">{content}</Link>;
}

function Info({ label, value }) {
  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-[#1A4FBF]">{label}</p>
      <p className="truncate font-sans text-[11px] leading-4">{value || "—"}</p>
    </div>
  );
}

function HomeworkList({ homework, subjects, loading }) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  return (
    <section className="border border-black bg-white p-3">
      <h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center bg-[#1A4FBF] text-white">✓</span>Today's homework</h2>
      {loading ? <p className="mt-2 font-sans text-xs text-neutral-500">Loading…</p> : homework.length ? (
        <div className="mt-2 grid gap-1.5">
          {homework.map((entry) => (
            <article key={entry.id} className="border-l-2 border-[#1A4FBF] bg-[#f6f8fd] px-2 py-1.5">
              <p className="font-sans text-[9px] uppercase tracking-[0.1em] text-[#1A4FBF]">{subjectMap.get(entry.subject_id)?.short_name || entry.subject_id}</p>
              <p className="font-sans text-xs">{entry.hw}</p>
            </article>
          ))}
        </div>
      ) : <p className="mt-2 font-sans text-xs text-neutral-500">No homework posted today.</p>}
    </section>
  );
}

function ExamList({ exams, subjects, loading }) {
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  return (
    <section className="border border-black bg-white p-3">
      <h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center bg-[#1A4FBF] text-white">!</span>Today's exams</h2>
      {loading ? (
        <p className="mt-3 font-sans text-sm text-neutral-500">Loading exams…</p>
      ) : exams.length ? (
        <div className="mt-2 grid gap-1.5">
          {exams.map((exam) => {
            const subject = subjectMap.get(exam.subject_id);
            return (
              <article key={exam.id} className="border-l-2 border-[#1A4FBF] bg-[#f6f8fd] px-2 py-1.5">
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-neutral-500">{exam.time}{exam.location ? ` · ${exam.location}` : ""}</p>
                <h3 className="mt-1 font-sans text-sm font-semibold">{subject ? `${subject.short_name} · ${exam.title}` : exam.title}</h3>
                {exam.note ? <p className="mt-1 font-sans text-sm text-neutral-600">{exam.note}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 font-sans text-sm text-neutral-500">No exams scheduled for this day.</p>
      )}
    </section>
  );
}
