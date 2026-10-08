import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import CjPortalBadge from "../components/CjPortalBadge";
import CjSchedulePicker from "../components/CjSchedulePicker";
import {
  PERIOD_COUNT,
  SCHEDULE_KEY,
  SCHEDULE_PROFILE_KEY,
  WEEKDAY_SHORT,
  dateForDay,
  dateFromIso,
  defaultSchedule,
  isoDate,
  mondayIso,
  normalizeSchedule,
  periodTimeLabel,
} from "../cjDates";
import { useLiveRefresh } from "../live";

function readSchedule(subjects) {
  const profile = window.localStorage.getItem(SCHEDULE_PROFILE_KEY) || "11Ac";
  let saved;
  try { saved = JSON.parse(window.localStorage.getItem(SCHEDULE_KEY) || "null"); } catch { saved = null; }
  return { profile, schedule: normalizeSchedule(saved || defaultSchedule(subjects, profile), subjects, profile) };
}

export default function CjWeek({ portal = "student", calendarPath = "/cj/student/calendar" }) {
  const [params, setParams] = useSearchParams();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(params.get("start") || "") ? params.get("start") : mondayIso();
  const weekStart = useMemo(() => dateFromIso(start), [start]);
  const [data, setData] = useState(null);
  const [selection, setSelection] = useState([]);
  const [draftSelection, setDraftSelection] = useState([]);
  const [profile, setProfile] = useState("11Ac");
  const [draftProfile, setDraftProfile] = useState("11Ac");
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.readCj(isoDate(weekStart));
      setData(payload);
      const saved = readSchedule(payload.subjects);
      setSelection(saved.schedule);
      setDraftSelection(saved.schedule);
      setProfile(saved.profile);
      setDraftProfile(saved.profile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load CJ.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(Boolean(data) && !coursesOpen, load);

  const subjectMap = useMemo(() => new Map((data?.subjects || []).map((subject) => [subject.id, subject])), [data]);
  const rows = useMemo(() => Array.from({ length: PERIOD_COUNT }, (_, index) => ({
    period: index + 1,
    subject: subjectMap.get(selection[index]) || null,
  })), [selection, subjectMap]);

  function moveWeek(offset) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offset * 7);
    setParams({ start: isoDate(next) });
  }

  function saveCourses(next, nextProfile) {
    setSelection(next);
    setDraftSelection(next);
    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
    window.localStorage.setItem(SCHEDULE_PROFILE_KEY, nextProfile);
    setCoursesOpen(false);
  }

  const weekEnd = dateForDay(weekStart, 4);
  const range = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const homework = (data?.entries || []).filter((entry) => entry.hw && selection.includes(entry.subject_id));

  return (
    <section className="mt-5">
      <CjPortalBadge portal={portal} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous week" onClick={() => moveWeek(-1)} className="h-9 w-9 border border-black text-lg">‹</button>
          <div>
            <h1 className="font-sans text-xl font-semibold">{range}</h1>
            <p className="font-sans text-[10px] uppercase tracking-[0.15em] text-[#1A4FBF]">Weekly CJ · {profile}</p>
          </div>
          <button type="button" aria-label="Next week" onClick={() => moveWeek(1)} className="h-9 w-9 border border-black text-lg">›</button>
        </div>
        <div className="flex items-center gap-2 font-sans text-xs">
          <button type="button" aria-label="This week" onClick={() => setParams({ start: mondayIso() })} className="border border-black px-3 py-2">Today</button>
          <button type="button" aria-label="Refresh" onClick={load} className="h-9 w-9 border border-black text-base">↻</button>
          <Link aria-label="Calendar" title="Calendar" to={calendarPath} className="flex h-9 w-9 items-center justify-center border border-black text-inherit no-underline">▦</Link>
          <button type="button" onClick={() => setCoursesOpen((open) => !open)} className="bg-black px-3 py-2 text-white">Courses</button>
        </div>
      </div>

      {coursesOpen ? (
        <CjSchedulePicker
          subjects={data?.subjects || []}
          profile={draftProfile}
          selection={draftSelection}
          onProfileChange={setDraftProfile}
          onSelectionChange={setDraftSelection}
          onSave={saveCourses}
        />
      ) : null}

      {error ? <p className="mt-4 border border-red-700 p-3 font-sans text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 overflow-x-auto border border-black bg-neutral-200">
        <div className="grid min-w-[920px] grid-cols-[66px_repeat(5,minmax(168px,1fr))] gap-px">
          <div className="bg-white" />
          {WEEKDAY_SHORT.map((day, index) => {
            const date = dateForDay(weekStart, index);
            return (
              <Link key={day} to={`/cj/student/day?date=${isoDate(date)}`} className="bg-white px-2 py-2 text-center text-inherit no-underline hover:bg-[#edf3ff]">
                <span className="block font-sans text-xs font-semibold">{day}</span>
                <span className="font-sans text-[10px] text-neutral-500">{date.getMonth() + 1}/{date.getDate()}</span>
              </Link>
            );
          })}

          {rows.map(({ period, subject }) => (
            <WeekRow key={period} period={period} subject={subject} entries={data?.entries || []} weekStart={weekStart} loading={loading} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HighlightList icon="✓" title="Homework" empty="No homework posted this week." items={homework.map((entry) => ({
          id: entry.id,
          meta: `${WEEKDAY_SHORT[entry.day_index]} · ${subjectMap.get(entry.subject_id)?.short_name || entry.subject_id}`,
          text: entry.hw,
        }))} />
        <HighlightList icon="!" title="Exams" empty="No exams posted this week." items={(data?.exams || []).map((exam) => ({
          id: exam.id,
          meta: `${WEEKDAY_SHORT[exam.day_index]} ${exam.time} · ${subjectMap.get(exam.subject_id)?.short_name || exam.subject_id}`,
          text: exam.title,
        }))} />
      </div>
    </section>
  );
}

function WeekRow({ period, subject, entries, weekStart, loading }) {
  return (
    <>
      <div className="flex h-12 flex-col items-center justify-center overflow-hidden bg-white px-1 font-sans">
        <b className="text-xs">P{period}</b>
        <span className="mt-0.5 text-[8px] text-neutral-500">{periodTimeLabel(period)}</span>
      </div>
      {WEEKDAY_SHORT.map((day, dayIndex) => {
        const date = dateForDay(weekStart, dayIndex);
        const entry = subject ? entries.find((item) => item.day_index === dayIndex && item.subject_id === subject.id) : null;
        if (loading) return <div key={day} className="h-12 animate-pulse bg-white" />;
        if (!subject) return <div key={day} className="h-12 bg-neutral-50" />;
        const query = new URLSearchParams({ date: isoDate(date), period: String(period), subject: subject.id });
        return (
          <Link key={day} to={`/cj/student/course?${query}`} className="h-12 overflow-hidden bg-white px-2 py-1 text-inherit no-underline hover:bg-[#edf3ff]">
            <p className="truncate font-sans text-[11px] font-semibold">{subject.short_name}</p>
            {entry?.ic ? <p className="truncate font-sans text-[9px] text-neutral-600"><b className="text-[#1A4FBF]">IC</b> {entry.ic}</p> : null}
            {entry?.hw ? <p className="truncate font-sans text-[9px] text-neutral-600"><b className="text-[#1A4FBF]">HW</b> {entry.hw}</p> : null}
            {entry?.announcement ? <p className="truncate font-sans text-[9px] text-neutral-600"><b className="text-[#1A4FBF]">A</b> {entry.announcement}</p> : null}
          </Link>
        );
      })}
    </>
  );
}

function HighlightList({ icon, title, empty, items }) {
  return (
    <section className="border border-black bg-white p-3">
      <h2 className="flex items-center gap-2 font-sans text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center bg-[#1A4FBF] text-white">{icon}</span>{title}</h2>
      {items.length ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="border-l-2 border-[#1A4FBF] bg-[#f6f8fd] px-2 py-1.5">
              <p className="font-sans text-[9px] uppercase tracking-[0.1em] text-[#1A4FBF]">{item.meta}</p>
              <p className="truncate font-sans text-xs">{item.text}</p>
            </article>
          ))}
        </div>
      ) : <p className="mt-2 font-sans text-xs text-neutral-500">{empty}</p>}
    </section>
  );
}
