import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import {
  PERIOD_COUNT,
  SCHEDULE_KEY,
  dateFromIso,
  defaultSchedule,
  isoDate,
  mondayOf,
  normalizeSchedule,
} from "../cjDates";
import { useI18n } from "../i18n";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function CjWeekRedirect() {
  const [params] = useSearchParams();
  const start = params.get("start") || "";
  const date = ISO.test(start) ? start : isoDate(new Date());
  return <Navigate to={`/cj/day?date=${date}`} replace />;
}

export default function CjDay() {
  const { lang, t } = useI18n();
  const [params] = useSearchParams();
  const raw = params.get("date") || "";
  const date = useMemo(() => (ISO.test(raw) ? dateFromIso(raw) : dateFromIso(isoDate(new Date()))), [raw]);
  const weekStart = useMemo(() => mondayOf(date), [date]);
  const dayIndex = Math.round((date.getTime() - weekStart.getTime()) / 86400000);
  const schoolDay = dayIndex >= 0 && dayIndex <= 4;

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
      setError(loadError instanceof Error ? loadError.message : "load");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

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
  const exams = (data?.exams || []).filter((exam) => exam.day_index === dayIndex);

  function saveSelection() {
    const next = normalizeSchedule(draftSelection, data?.subjects || []);
    setSelected(next);
    setDraftSelection(next);
    window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
    setPickerOpen(false);
  }

  const heading = date.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("cj.dayTitle")}</p>
          <h1 className="mt-2 font-serif text-4xl">{heading}</h1>
          <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.courses", { count: selectedSubjects.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
          <Link to="/cj" className="border border-black px-3 py-2 text-inherit no-underline">
            {t("cj.back")}
          </Link>
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
                  {t("cj.period", { n: period })}
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
          <button
            type="button"
            onClick={saveSelection}
            className="mt-4 bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white"
          >
            {t("cj.saveSchedule")}
          </button>
        </div>
      ) : null}

      <section className="mt-6 border border-black p-4">
        <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("cj.exams")}</p>
        <h2 className="font-serif text-2xl">{t("cj.examsTitle")}</h2>
        {loading ? (
          <p className="mt-3 font-sans text-sm text-neutral-500">{t("cj.examsLoading")}</p>
        ) : exams.length ? (
          <div className="mt-4 grid gap-3">
            {exams.map((exam) => (
              <article key={exam.id} className="border-t border-neutral-200 pt-3">
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  {exam.time}
                  {exam.location ? ` · ${exam.location}` : ""}
                </p>
                <h3 className="mt-1 font-sans text-sm font-semibold">{exam.title}</h3>
                {exam.note ? <p className="mt-1 font-sans text-sm text-neutral-600">{exam.note}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 font-sans text-sm text-neutral-500">{t("cj.examsEmpty")}</p>
        )}
      </section>

      {error ? (
        <div className="mt-6 border border-black p-4">
          <p className="font-sans text-sm">{error === "load" ? t("cj.loadError") : error}</p>
          <button type="button" onClick={loadWeek} className="mt-3 font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
            {t("cj.reload")}
          </button>
        </div>
      ) : schoolDay ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {loading
            ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 border border-neutral-200" />)
            : selectedSubjects.map((subject) => {
                const entry = (data?.entries || []).find(
                  (item) => item.day_index === dayIndex && item.subject_id === subject.id,
                );
                return (
                  <article key={`${subject.period}-${subject.id}`} className="border border-neutral-300 p-3">
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
              })}
        </div>
      ) : (
        <p className="mt-6 font-sans text-sm text-neutral-500">{t("cj.offDay")}</p>
      )}
    </section>
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
