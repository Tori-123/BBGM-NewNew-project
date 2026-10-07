import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { mondayIso } from "../cjDates";
import { useI18n } from "../i18n";

export default function CjTeacher() {
  const { t } = useI18n();
  const [weekStart, setWeekStart] = useState(mondayIso);
  const [data, setData] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [subjectId, setSubjectId] = useState("");
  const [ic, setIc] = useState("");
  const [hw, setHw] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [examId, setExamId] = useState("");
  const [examDayIndex, setExamDayIndex] = useState(0);
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examTime, setExamTime] = useState("09:00");
  const [examLocation, setExamLocation] = useState("");
  const [examNote, setExamNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.readCj(weekStart);
      setData(payload);
      setSubjectId((current) =>
        payload.subjects.some((subject) => subject.id === current)
          ? current
          : payload.subjects[0]?.id || "",
      );
      setExamSubjectId((current) =>
        payload.subjects.some((subject) => subject.id === current)
          ? current
          : payload.subjects[0]?.id || "",
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("cj.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [weekStart, t]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const currentEntry = useMemo(
    () => (data?.entries || []).find((entry) => entry.day_index === dayIndex && entry.subject_id === subjectId),
    [data, dayIndex, subjectId],
  );

  useEffect(() => {
    setIc(currentEntry?.ic || "");
    setHw(currentEntry?.hw || "");
    setAnnouncement(currentEntry?.announcement || "");
  }, [currentEntry]);

  const subjectMap = useMemo(
    () => new Map((data?.subjects || []).map((subject) => [subject.id, subject])),
    [data],
  );

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await api.saveCj({ week_start: weekStart, day_index: dayIndex, subject_id: subjectId, ic, hw, announcement });
      setNotice(t("cj.saved"));
      await loadWeek();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : t("cj.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function resetExamForm() {
    setExamId("");
    setExamTitle("");
    setExamLocation("");
    setExamNote("");
  }

  async function handleExamSave(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await api.saveExam({
        id: examId || undefined,
        week_start: weekStart,
        day_index: examDayIndex,
        subject_id: examSubjectId,
        title: examTitle,
        time: examTime,
        location: examLocation,
        note: examNote,
      });
      setNotice(t("cj.examSaved"));
      await loadWeek();
      resetExamForm();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : t("cj.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="border-l-4 border-[#1A4FBF] pl-4">
        <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("cj.teacherKicker")}</p>
        <h1 className="mt-2 font-serif text-4xl">{t("cj.teacherTitle")}</h1>
        <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.teacherLead")}</p>
      </div>
      <p className="mt-3 font-sans text-sm">
        <Link to="/" className="text-[#1A4FBF]">{t("link.frontPage")}</Link>
      </p>

      <label className="mt-6 block max-w-sm font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
        {t("cj.monday")}
        <input
          type="date"
          value={weekStart}
          onChange={(event) => setWeekStart(event.target.value)}
          className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
        />
      </label>

      {error ? <p className="mt-4 border border-red-700 p-3 font-sans text-sm text-red-700">{error}</p> : null}
      {!loading && !(data?.subjects || []).length ? (
        <div className="mt-6 border border-black p-5">
          <h2 className="font-serif text-2xl">{t("cj.noAssignedSubjects")}</h2>
          <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.askAdminAssignment")}</p>
        </div>
      ) : (
        <>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSave} className="border border-black p-4">
            <h2 className="font-serif text-2xl">{currentEntry ? t("cj.updateEntry") : t("cj.addEntry")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TeacherDayField value={dayIndex} onChange={setDayIndex} />
              <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
                {t("cj.subject")}
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
                >
                  {(data?.subjects || []).map((subject) => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <TeacherTextField label="IC" value={ic} onChange={setIc} />
            <TeacherTextField label="HW" value={hw} onChange={setHw} />
            <TeacherTextField label="A" value={announcement} onChange={setAnnouncement} />
            <button
              type="submit"
              disabled={saving || loading || !subjectId}
              className="mt-4 bg-[#1A4FBF] px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              {saving ? t("cj.saving") : t("cj.saveEntry")}
            </button>
            {notice ? <p className="mt-3 font-sans text-sm">{notice}</p> : null}
          </form>

          <aside className="border border-black">
            <div className="flex items-center justify-between border-b border-black px-4 py-3">
              <h2 className="font-serif text-2xl">{t("cj.myWeekEntries")}</h2>
              <span className="font-sans text-sm">{data?.entries?.length || 0}</span>
            </div>
            {loading ? <p className="p-4 font-sans text-sm text-neutral-500">{t("cj.reading")}</p> : null}
            {(data?.entries || []).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setDayIndex(entry.day_index);
                  setSubjectId(entry.subject_id);
                }}
                className="block w-full border-b border-neutral-200 px-4 py-3 text-left last:border-b-0"
              >
                <span className="font-sans text-sm font-semibold">{subjectMap.get(entry.subject_id)?.short_name || entry.subject_id}</span>
                <span className="mt-1 block font-sans text-xs text-neutral-500">{entry.ic || t("cj.noIc")}</span>
                <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-[#1A4FBF]">{t(`cj.wd.${entry.day_index}`)}</span>
              </button>
            ))}
          </aside>
        </div>
        <div className="mt-8 grid gap-6 border-t-2 border-black pt-6 lg:grid-cols-2">
          <form onSubmit={handleExamSave} className="border border-black p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif text-2xl">{examId ? t("cj.updateExam") : t("cj.addExam")}</h2>
              {examId ? (
                <button type="button" onClick={resetExamForm} className="font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
                  {t("cj.newExam")}
                </button>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TeacherDayField value={examDayIndex} onChange={setExamDayIndex} />
              <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
                {t("cj.time")}
                <input
                  type="time"
                  value={examTime}
                  onChange={(event) => setExamTime(event.target.value)}
                  className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal"
                />
              </label>
            </div>
            <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
              {t("cj.subject")}
              <select
                value={examSubjectId}
                onChange={(event) => setExamSubjectId(event.target.value)}
                className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
              >
                {(data?.subjects || []).map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
            <TeacherLineField label={t("cj.examName")} value={examTitle} onChange={setExamTitle} />
            <TeacherLineField label={t("cj.location")} value={examLocation} onChange={setExamLocation} />
            <TeacherTextField label={t("cj.note")} value={examNote} onChange={setExamNote} />
            <button
              type="submit"
              disabled={saving || loading || !examSubjectId || !examTitle.trim()}
              className="mt-4 bg-[#1A4FBF] px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              {saving ? t("cj.saving") : t("cj.saveExam")}
            </button>
          </form>

          <aside className="border border-black">
            <div className="flex items-center justify-between border-b border-black px-4 py-3">
              <h2 className="font-serif text-2xl">{t("cj.weekExams")}</h2>
              <span className="font-sans text-sm">{data?.exams?.length || 0}</span>
            </div>
            {(data?.exams || []).map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => {
                  setExamId(exam.id);
                  setExamDayIndex(exam.day_index);
                  setExamSubjectId(exam.subject_id || data?.subjects?.[0]?.id || "");
                  setExamTitle(exam.title);
                  setExamTime(exam.time);
                  setExamLocation(exam.location);
                  setExamNote(exam.note);
                }}
                className="block w-full border-b border-neutral-200 px-4 py-3 text-left last:border-b-0"
              >
                <span className="font-sans text-sm font-semibold">
                  {examDisplayTitle(exam, subjectMap, t("cj.unassignedSubject"))}
                </span>
                <span className="mt-1 block font-sans text-xs text-neutral-500">{exam.location || t("cj.noLocation")}</span>
                <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-[#1A4FBF]">
                  {t(`cj.wd.${exam.day_index}`)} · {exam.time}
                </span>
              </button>
            ))}
          </aside>
        </div>
        </>
      )}
    </section>
  );
}

function examDisplayTitle(exam, subjectMap, unassignedLabel) {
  const subject = subjectMap.get(exam.subject_id);
  if (!subject) return `${unassignedLabel} · ${exam.title}`;
  if (exam.title.startsWith(subject.name) || exam.title.startsWith(subject.short_name)) return exam.title;
  return `${subject.short_name} · ${exam.title}`;
}

function TeacherDayField({ value, onChange }) {
  const { t } = useI18n();
  return (
    <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {t("cj.date")}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
      >
        {Array.from({ length: 5 }, (_, index) => <option key={index} value={index}>{t(`cj.wd.${index}`)}</option>)}
      </select>
    </label>
  );
}

function TeacherTextField({ label, value, onChange }) {
  return (
    <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {label}
      <textarea
        value={value}
        maxLength={800}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
      />
    </label>
  );
}

function TeacherLineField({ label, value, onChange }) {
  return (
    <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {label}
      <input
        value={value}
        maxLength={800}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
      />
    </label>
  );
}
