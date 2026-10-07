import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  PERIOD_COUNT,
  SCHEDULE_KEY,
  WEEKDAYS,
  WEEKDAY_SHORT,
  dateForDay,
  dateFromIso,
  defaultSchedule,
  isoDate,
  mondayIso,
  normalizeSchedule,
  weekNumber,
} from "../cjDates";
import { useI18n } from "../i18n";
import { useLiveRefresh } from "../live";

export default function CjWeek({ calendarPath = "/cj/student", previewMode = false }) {
  const { lang, t } = useI18n();
  const [params, setParams] = useSearchParams();
  const startParam = params.get("start") || "";
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(startParam) ? startParam : mondayIso();
  const [weekStart, setWeekStart] = useState(() => dateFromIso(initial));
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [draftSelection, setDraftSelection] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.readCj(isoDate(weekStart));
      setData(payload);
      const saved = window.localStorage.getItem(SCHEDULE_KEY);
      const savedIds = saved ? JSON.parse(saved) : defaultSchedule(payload.subjects);
      const next = normalizeSchedule(savedIds, payload.subjects);
      setSelected(next);
      setDraftSelection(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("cj.loadError"));
    } finally {
      setLoading(false);
    }
  }, [weekStart, t]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const refreshWeek = useCallback(async () => {
    const payload = await api.readCj(isoDate(weekStart));
    setData(payload);
  }, [weekStart]);

  useLiveRefresh(Boolean(data) && !pickerOpen, refreshWeek);

  const subjectMap = useMemo(
    () => new Map((data?.subjects || []).map((subject) => [subject.id, subject])),
    [data],
  );
  const selectedSubjects = useMemo(
    () =>
      selected.flatMap((id, index) => {
        const subject = subjectMap.get(id);
        return subject ? [{ ...subject, period: index + 1 }] : [];
      }),
    [selected, subjectMap],
  );

  function moveWeek(offset) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offset * 7);
    setWeekStart(next);
    setParams({ start: isoDate(next) });
  }

  function saveSelection() {
    const next = normalizeSchedule(draftSelection, data?.subjects || []);
    setSelected(next);
    setDraftSelection(next);
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
    setPickerOpen(false);
  }

  const range = formatWeekRange(weekStart, lang);

  return (
    <section className="cj-week mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">
            {previewMode ? `${t("cj.studentPreviewKicker")} · ` : ""}
            {t("cj.weekKicker", { year: weekStart.getFullYear(), week: weekNumber(weekStart) })}
          </p>
          <h1 className="mt-2 font-serif text-4xl">{t("cj.weekTitle")}</h1>
          <p className="mt-2 font-sans text-sm text-neutral-600">
            {t("cj.weekSummary", { range, count: selectedSubjects.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
          <button type="button" onClick={() => moveWeek(-1)} className="border border-black px-3 py-2">
            {t("cj.prevWeek")}
          </button>
          <Link to={calendarPath} className="border border-black px-3 py-2 text-inherit no-underline">
            {previewMode ? t("cj.adminKicker") : t("cj.chooseWeek")}
          </Link>
          <button type="button" onClick={() => moveWeek(1)} className="border border-black px-3 py-2">
            {t("cj.nextWeek")}
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={() => setPickerOpen((open) => !open)}
            className="bg-black px-3 py-2 text-white disabled:opacity-40"
          >
            {t("cj.myCourses")}
          </button>
        </div>
      </div>

      {pickerOpen ? (
        <div className="mt-6 border border-black p-4">
          <h2 className="font-serif text-2xl">{t("cj.scheduleTitle")}</h2>
          <p className="mt-1 font-sans text-sm text-neutral-600">{t("cj.scheduleHint")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: PERIOD_COUNT }, (_, index) => {
              const period = index + 1;
              return (
                <label key={period} className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
                  Period {period}
                  <select
                    className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
                    value={draftSelection[index] || ""}
                    onChange={(event) =>
                      setDraftSelection((current) =>
                        current.map((id, itemIndex) => (itemIndex === index ? event.target.value : id)),
                      )
                    }
                  >
                    {(data?.subjects || []).map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.short_name} · {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <button type="button" onClick={saveSelection} className="mt-4 bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white">
            {t("cj.saveSchedule")}
          </button>
        </div>
      ) : null}

      <ExamList exams={data?.exams || []} subjects={data?.subjects || []} weekStart={weekStart} loading={loading} />

      {error ? (
        <div className="mt-6 border border-black p-4">
          <p className="font-sans text-sm">{error}</p>
          <button type="button" onClick={loadWeek} className="mt-3 font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
            {t("cj.reload")}
          </button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto border-y-2 border-black py-3">
          <div className="grid min-w-[940px] grid-cols-5 gap-px bg-black">
            {WEEKDAYS.slice(0, 5).map((day, dayIndex) => (
              <DayColumn
                key={day}
                day={t(`cj.weekday.${dayIndex}`)}
                englishDay={WEEKDAY_SHORT[dayIndex]}
                date={dateForDay(weekStart, dayIndex)}
                dayIndex={dayIndex}
                subjects={selectedSubjects}
                entries={data?.entries || []}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DayColumn({ day, englishDay, date, dayIndex, subjects, entries, loading }) {
  return (
    <section className="bg-white">
      <header className="border-b border-black px-3 py-2.5">
        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#1A4FBF]">{englishDay}</p>
        <h2 className="font-serif text-2xl">{day}</h2>
        <p className="font-sans text-xs text-neutral-500">
          {date.getMonth() + 1}/{date.getDate()}
        </p>
      </header>
      <div className="grid gap-px bg-neutral-200">
        {loading
          ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 border border-neutral-200" />)
          : subjects.map((subject) => {
              const entry = entries.find((item) => item.day_index === dayIndex && item.subject_id === subject.id);
              return <CourseCard key={`${subject.period}-${subject.id}`} subject={subject} entry={entry} />;
            })}
      </div>
    </section>
  );
}

function CourseCard({ subject, entry }) {
  return (
    <article className="min-h-[142px] bg-white p-3">
      <div className="flex items-start gap-2">
        <span className="bg-black px-1.5 py-0.5 font-sans text-[10px] text-white">P{subject.period}</span>
        <div>
          <h3 className="font-sans text-sm font-semibold">{subject.short_name}</h3>
          <p className="font-sans text-[11px] text-neutral-500">{subject.name}</p>
        </div>
      </div>
      <Info label="IC" value={entry?.ic} />
      <Info label="HW" value={entry?.hw} />
      <Info label="A" value={entry?.announcement} />
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="mt-2">
      <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-[#1A4FBF]">{label}</p>
      <p className="whitespace-pre-wrap font-sans text-sm leading-5">{value || "—"}</p>
    </div>
  );
}

function ExamList({ exams, subjects, weekStart, loading }) {
  const { t } = useI18n();
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
  return (
    <section className="mt-6 border border-black p-4">
      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">Exams</p>
      <h2 className="font-serif text-2xl">{t("cj.weekExamsTitle")}</h2>
      {loading ? (
        <p className="mt-3 font-sans text-sm text-neutral-500">{t("cj.examsLoading")}</p>
      ) : exams.length ? (
        <div className="mt-4 grid gap-3">
          {exams.map((exam) => {
            const date = dateForDay(weekStart, exam.day_index);
            return (
              <article key={exam.id} className="border-t border-neutral-200 pt-3">
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  {t(`cj.weekday.${exam.day_index}`)} · {date.getMonth() + 1}/{date.getDate()} · {exam.time}
                  {exam.location ? ` · ${exam.location}` : ""}
                </p>
                <h3 className="mt-1 font-sans text-sm font-semibold">{examDisplayTitle(exam, subjectMap)}</h3>
                {exam.note ? <p className="mt-1 font-sans text-sm text-neutral-600">{exam.note}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 font-sans text-sm text-neutral-500">{t("cj.weekExamsEmpty")}</p>
      )}
    </section>
  );
}

function examDisplayTitle(exam, subjectMap) {
  const subject = subjectMap.get(exam.subject_id);
  if (!subject) return exam.title;
  if (exam.title.startsWith(subject.name) || exam.title.startsWith(subject.short_name)) return exam.title;
  return `${subject.short_name} · ${exam.title}`;
}

function formatWeekRange(weekStart, lang) {
  const end = dateForDay(weekStart, 4);
  if (lang === "zh") {
    return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
  }
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${formatter.format(weekStart)} – ${formatter.format(end)}`;
}
