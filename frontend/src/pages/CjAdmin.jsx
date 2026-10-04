import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { mondayIso } from "../cjDates";
import { useI18n } from "../i18n";

export default function CjAdmin() {
  const { t } = useI18n();
  const [weekStart, setWeekStart] = useState(mondayIso);
  const [data, setData] = useState(null);
  const [adminCode, setAdminCode] = useState(() =>
    ["127.0.0.1", "localhost"].includes(window.location.hostname) ? "CJ-DEMO" : "",
  );
  const [tab, setTab] = useState("cj");
  const [dayIndex, setDayIndex] = useState(0);
  const [subjectId, setSubjectId] = useState("");
  const [ic, setIc] = useState("");
  const [hw, setHw] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [examId, setExamId] = useState("");
  const [examDayIndex, setExamDayIndex] = useState(0);
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
      setSubjectId((current) => current || payload.subjects[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "load");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

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

  async function handleCjSave(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      await api.saveCj(
        { week_start: weekStart, day_index: dayIndex, subject_id: subjectId, ic, hw, announcement },
        adminCode.trim(),
      );
      setNotice(t("cj.saved"));
      await loadWeek();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : t("cj.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleExamSave(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const result = await api.saveExam(
        {
          id: examId || undefined,
          week_start: weekStart,
          day_index: examDayIndex,
          title: examTitle,
          time: examTime,
          location: examLocation,
          note: examNote,
        },
        adminCode.trim(),
      );
      setExamId(result.id || "");
      setNotice(t("cj.examSaved"));
      await loadWeek();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : t("cj.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("cj.adminKicker")}</p>
      <h1 className="mt-2 font-serif text-4xl">{t("cj.adminTitle")}</h1>
      <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.adminLead")}</p>
      <p className="mt-3 font-sans text-sm">
        <Link to="/cj" className="text-[#1A4FBF]">
          {t("cj.back")}
        </Link>
      </p>

      <div className="mt-6 grid gap-4 border border-black p-4 sm:grid-cols-2">
        <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
          {t("cj.code")}
          <input
            type="password"
            value={adminCode}
            onChange={(event) => setAdminCode(event.target.value)}
            className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
          />
        </label>
        <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
          {t("cj.monday")}
          <input
            type="date"
            value={weekStart}
            onChange={(event) => setWeekStart(event.target.value)}
            className="mt-2 w-full border border-black p-2 font-sans text-sm normal-case tracking-normal text-neutral-900"
          />
        </label>
      </div>
      {notice ? <p className="mt-3 font-sans text-sm">{notice}</p> : null}

      <div className="mt-6 flex gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setTab("cj")} className={tab === "cj" ? "border-b-2 border-black pb-1" : "pb-1 text-neutral-500"}>
          {t("cj.daily")}
        </button>
        <button type="button" onClick={() => setTab("exams")} className={tab === "exams" ? "border-b-2 border-black pb-1" : "pb-1 text-neutral-500"}>
          {t("cj.examTab")}
        </button>
      </div>

      {tab === "cj" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleCjSave} className="border border-black p-4">
            <h2 className="font-serif text-2xl">{currentEntry ? t("cj.updateEntry") : t("cj.addEntry")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DayField value={dayIndex} onChange={setDayIndex} />
              <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
                {t("cj.subject")}
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
                >
                  {(data?.subjects || []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <TextField label="IC" value={ic} onChange={setIc} />
            <TextField label="HW" value={hw} onChange={setHw} />
            <TextField label="A" value={announcement} onChange={setAnnouncement} />
            <button type="submit" disabled={saving || loading || !subjectId} className="mt-4 bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40">
              {saving ? t("cj.saving") : t("cj.saveEntry")}
            </button>
          </form>
          <EntryList
            title={t("cj.weekEntries")}
            loading={loading}
            error={error}
            items={(data?.entries || []).map((entry) => ({
              id: entry.id,
              title: subjectMap.get(entry.subject_id)?.short_name || entry.subject_id,
              detail: entry.ic || t("cj.noIc"),
              meta: t(`cj.wd.${entry.day_index}`),
              onClick: () => {
                setDayIndex(entry.day_index);
                setSubjectId(entry.subject_id);
              },
            }))}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleExamSave} className="border border-black p-4">
            <h2 className="font-serif text-2xl">{examId ? t("cj.updateExam") : t("cj.addExam")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DayField value={examDayIndex} onChange={setExamDayIndex} />
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
            <LineField label={t("cj.examName")} value={examTitle} onChange={setExamTitle} />
            <LineField label={t("cj.location")} value={examLocation} onChange={setExamLocation} />
            <TextField label={t("cj.note")} value={examNote} onChange={setExamNote} />
            <button type="submit" disabled={saving || loading || !examTitle.trim()} className="mt-4 bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40">
              {saving ? t("cj.saving") : t("cj.saveExam")}
            </button>
          </form>
          <EntryList
            title={t("cj.weekExams")}
            loading={loading}
            error={error}
            items={(data?.exams || []).map((exam) => ({
              id: exam.id,
              title: exam.title,
              detail: exam.location || t("cj.noLocation"),
              meta: `${t(`cj.wd.${exam.day_index}`)} · ${exam.time}`,
              onClick: () => {
                setExamId(exam.id);
                setExamDayIndex(exam.day_index);
                setExamTitle(exam.title);
                setExamTime(exam.time);
                setExamLocation(exam.location);
                setExamNote(exam.note);
              },
            }))}
          />
        </div>
      )}
    </section>
  );
}

function DayField({ value, onChange }) {
  const { t } = useI18n();
  return (
    <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {t("cj.date")}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <option key={index} value={index}>
            {t(`cj.wd.${index}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({ label, value, onChange }) {
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

function LineField({ label, value, onChange }) {
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

function EntryList({ title, loading, error, items }) {
  const { t } = useI18n();
  return (
    <aside className="border border-black">
      <div className="flex items-center justify-between border-b border-black px-4 py-3">
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className="font-sans text-sm">{items.length}</span>
      </div>
      {error ? <p className="p-4 font-sans text-sm text-red-700">{error === "load" ? t("cj.loadFailed") : error}</p> : null}
      {loading ? <p className="p-4 font-sans text-sm text-neutral-500">{t("cj.reading")}</p> : null}
      <div>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={item.onClick} className="block w-full border-b border-neutral-200 px-4 py-3 text-left last:border-b-0">
            <span className="font-sans text-sm font-semibold">{item.title}</span>
            <span className="mt-1 block font-sans text-xs text-neutral-500">{item.detail}</span>
            <span className="mt-1 block font-sans text-[11px] uppercase tracking-[0.12em] text-[#1A4FBF]">{item.meta}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
