import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import CjPortalBadge from "../components/CjPortalBadge";
import { dateForDay, dateFromIso, isoDate, mondayIso } from "../cjDates";
import { useI18n } from "../i18n";

export default function CjAdmin({ portal = "admin" }) {
  const { t } = useI18n();
  const teacherMode = portal === "teacher";
  const [weekStart, setWeekStart] = useState(mondayIso);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("cj");
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
  const [courseName, setCourseName] = useState("");
  const [courseShortName, setCourseShortName] = useState("");
  const [courseGrade, setCourseGrade] = useState(11);
  const [courseSection, setCourseSection] = useState("All");
  const [coursePeriod, setCoursePeriod] = useState(1);
  const [courseTeacher, setCourseTeacher] = useState("");
  const [courseRoom, setCourseRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [teamsStatus, setTeamsStatus] = useState(null);
  const [teamsPreview, setTeamsPreview] = useState(null);
  const [teamsError, setTeamsError] = useState("");
  const [searchParams] = useSearchParams();

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api.readCj(weekStart);
      setData(payload);
      setSubjectId((current) => (
        payload.subjects.some((subject) => subject.id === current) ? current : payload.subjects[0]?.id || ""
      ));
      setExamSubjectId((current) => (
        payload.subjects.some((subject) => subject.id === current) ? current : payload.subjects[0]?.id || ""
      ));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "load");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  useEffect(() => {
    if (teacherMode) return undefined;
    let cancelled = false;
    api.teamsStatus().then((status) => {
      if (!cancelled) setTeamsStatus(status);
    }).catch((statusError) => {
      if (!cancelled) setTeamsError(statusError instanceof Error ? statusError.message : t("cj.teamsError"));
    });
    if (searchParams.get("teams") === "connected") setNotice(t("cj.teamsConnected"));
    if (searchParams.get("teams") === "error") setTeamsError(t("cj.teamsError"));
    return () => {
      cancelled = true;
    };
  }, [teacherMode, searchParams, t]);

  async function handleTeamsConnect() {
    setSaving(true);
    setTeamsError("");
    try {
      const payload = await api.connectTeams();
      window.location.assign(payload.authorize_url);
    } catch (connectError) {
      setTeamsError(connectError instanceof Error ? connectError.message : t("cj.teamsError"));
      setSaving(false);
    }
  }

  async function handleTeamsPreview() {
    setSaving(true);
    setTeamsError("");
    setNotice("");
    try {
      setTeamsPreview(await api.previewTeamsCj(weekStart));
    } catch (previewError) {
      setTeamsPreview(null);
      setTeamsError(previewError instanceof Error ? previewError.message : t("cj.teamsError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTeamsApply() {
    setSaving(true);
    setTeamsError("");
    try {
      const result = await api.applyTeamsCj({ week_start: weekStart, entries: teamsPreview.entries });
      setNotice(t("cj.teamsWritten", { n: result.written }));
      setTeamsPreview(null);
      await loadWeek();
    } catch (applyError) {
      setTeamsError(applyError instanceof Error ? applyError.message : t("cj.teamsError"));
    } finally {
      setSaving(false);
    }
  }

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
      await api.saveCj({ week_start: weekStart, day_index: dayIndex, subject_id: subjectId, ic, hw, announcement });
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

  async function handleCourseSave(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const created = await api.createCjSubject({
        name: courseName,
        short_name: courseShortName,
        grade: courseGrade,
        class_section: courseSection,
        default_period: coursePeriod,
        teacher: courseTeacher,
        room: courseRoom,
      });
      setNotice(`${created.name} added.`);
      setCourseName("");
      setCourseShortName("");
      setCourseTeacher("");
      setCourseRoom("");
      await loadWeek();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : "Could not add course.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExamDelete() {
    if (!examId || !window.confirm("Delete this exam? Students will no longer see it.")) return;
    setSaving(true);
    setNotice("");
    try {
      await api.deleteExam(examId);
      setNotice("Exam deleted.");
      resetExamForm();
      await loadWeek();
    } catch (deleteError) {
      setNotice(deleteError instanceof Error ? deleteError.message : "Could not delete exam.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCourseDelete(subject) {
    if (!window.confirm(`Delete ${subject.name}? Its CJ entries and exams will also be removed.`)) return;
    setSaving(true);
    setNotice("");
    try {
      await api.deleteCjSubject(subject.id);
      setNotice(`${subject.name} deleted.`);
      await loadWeek();
    } catch (deleteError) {
      setNotice(deleteError instanceof Error ? deleteError.message : "Could not delete course.");
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

  function selectDate(value, setSelectedDay) {
    const selected = dateFromIso(value);
    const selectedDay = (selected.getDay() + 6) % 7;
    if (selectedDay > 4) {
      setNotice("Choose a school day from Monday to Friday.");
      return;
    }
    setNotice("");
    setWeekStart(mondayIso(selected));
    setSelectedDay(selectedDay);
  }

  return (
    <section className="mt-8">
      <CjPortalBadge portal={portal} />
      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{teacherMode ? "Teacher workspace" : "Administration"}</p>
      <h1 className="mt-2 font-serif text-4xl">CJ content</h1>
      <p className="mt-2 font-sans text-sm text-neutral-600">
        {teacherMode ? "Update CJ, exams, and courses across the complete school catalog." : "Update all CJ entries, exams, and courses."}
      </p>
      <p className="mt-3 flex flex-wrap gap-4 font-sans text-sm">
        <Link to="/" className="text-[#1A4FBF]">
          {t("link.frontPage")}
        </Link>
        {!teacherMode ? (
          <Link to={`/cj/admin/student-preview?date=${weekStart}`} className="text-[#1A4FBF]">
            {t("cj.studentPreview")}
          </Link>
        ) : null}
      </p>

      {notice ? <p className="mt-3 font-sans text-sm">{notice}</p> : null}

      {!teacherMode ? (
        <div className="mt-6 border border-black p-4">
          <h2 className="font-serif text-2xl">{t("cj.teamsTitle")}</h2>
          <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.teamsLead")}</p>
          {teamsStatus ? (
            <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.14em] text-neutral-600">
              {teamsStatus.teams_connected ? t("cj.teamsConnected") : t("cj.teamsNotConnected")}
              {" · "}
              {teamsStatus.deepseek_configured ? t("cj.deepseekReady") : t("cj.deepseekMissing")}
            </p>
          ) : null}
          {teamsStatus && !teamsStatus.microsoft_configured ? (
            <p className="mt-2 font-sans text-sm">{t("cj.microsoftMissing")}</p>
          ) : null}
          {teamsError ? <p className="mt-3 font-sans text-sm text-red-700">{teamsError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving || !teamsStatus?.microsoft_configured}
              onClick={handleTeamsConnect}
              className="border border-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] disabled:opacity-40"
            >
              {t("cj.teamsConnect")}
            </button>
            <button
              type="button"
              disabled={saving || !teamsStatus?.teams_connected || !teamsStatus?.deepseek_configured}
              onClick={handleTeamsPreview}
              className="bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40"
            >
              {t("cj.teamsImport")}
            </button>
          </div>
          {teamsPreview ? (
            <div className="mt-4">
              {teamsPreview.entries.length === 0 ? (
                <p className="font-sans text-sm">{t("cj.teamsNothing")}</p>
              ) : (
                <ul className="font-sans text-sm">
                  {teamsPreview.entries.map((entry) => (
                    <li key={`${entry.subject_id}-${entry.day_index}`} className="border-t border-neutral-200 py-2">
                      <p className="font-medium">
                        {subjectMap.get(entry.subject_id)?.name || entry.subject_id}
                        {" · "}
                        {t(`cj.wd.${entry.day_index}`)}
                      </p>
                      <p>IC: {entry.ic || "—"}</p>
                      <p>HW: {entry.hw || "—"}</p>
                      <p>A: {entry.announcement || "—"}</p>
                    </li>
                  ))}
                </ul>
              )}
              {teamsPreview.skipped.length > 0 ? (
                <ul className="mt-3 font-sans text-sm text-neutral-600">
                  {teamsPreview.skipped.map((item, index) => (
                    <li key={`${item.subject_id}-${item.reason}-${index}`}>
                      {t("cj.teamsSkipped")}: {item.subject_id || "—"} · {t(`cj.teamsReason.${item.reason}`)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                {teamsPreview.entries.length > 0 ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleTeamsApply}
                    className="bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40"
                  >
                    {t("cj.teamsConfirm")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTeamsPreview(null)}
                  className="border border-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] disabled:opacity-40"
                >
                  {t("cj.teamsCancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
        <button type="button" onClick={() => setTab("cj")} className={tab === "cj" ? "border-b-2 border-black pb-1" : "pb-1 text-neutral-500"}>
          {t("cj.daily")}
        </button>
        <button type="button" onClick={() => setTab("exams")} className={tab === "exams" ? "border-b-2 border-black pb-1" : "pb-1 text-neutral-500"}>
          {t("cj.examTab")}
        </button>
        <button type="button" onClick={() => setTab("courses")} className={tab === "courses" ? "border-b-2 border-black pb-1" : "pb-1 text-neutral-500"}>
          Courses
        </button>
      </div>

      {tab === "cj" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleCjSave} className="border border-black p-4">
            <h2 className="font-serif text-2xl">{currentEntry ? t("cj.updateEntry") : t("cj.addEntry")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DateField
                weekStart={weekStart}
                dayIndex={dayIndex}
                onChange={(value) => selectDate(value, setDayIndex)}
              />
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
      ) : tab === "exams" ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
              <DateField
                weekStart={weekStart}
                dayIndex={examDayIndex}
                onChange={(value) => selectDate(value, setExamDayIndex)}
              />
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
            <LineField label={t("cj.examName")} value={examTitle} onChange={setExamTitle} />
            <LineField label={t("cj.location")} value={examLocation} onChange={setExamLocation} />
            <TextField label={t("cj.note")} value={examNote} onChange={setExamNote} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" disabled={saving || loading || !examSubjectId || !examTitle.trim()} className="bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40">
                {saving ? t("cj.saving") : t("cj.saveExam")}
              </button>
              {examId ? (
                <button type="button" disabled={saving} onClick={handleExamDelete} className="border border-red-700 px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-red-700 disabled:opacity-40">
                  Delete exam
                </button>
              ) : null}
            </div>
          </form>
          <EntryList
            title={t("cj.weekExams")}
            loading={loading}
            error={error}
            items={(data?.exams || []).map((exam) => ({
              id: exam.id,
              title: examDisplayTitle(exam, subjectMap, t("cj.unassignedSubject")),
              detail: exam.location || t("cj.noLocation"),
              meta: `${t(`cj.wd.${exam.day_index}`)} · ${exam.time}`,
              onClick: () => {
                setExamId(exam.id);
                setExamDayIndex(exam.day_index);
                setExamSubjectId(exam.subject_id || data?.subjects?.[0]?.id || "");
                setExamTitle(exam.title);
                setExamTime(exam.time);
                setExamLocation(exam.location);
                setExamNote(exam.note);
              },
            }))}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleCourseSave} className="border border-black p-4">
            <h2 className="font-serif text-2xl">Add course</h2>
            <p className="mt-1 font-sans text-sm text-neutral-500">New courses become available immediately in Course setup.</p>
            <LineField label="Course name" value={courseName} onChange={setCourseName} />
            <LineField label="Short name" value={courseShortName} onChange={setCourseShortName} />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <SelectField label="Grade" value={courseGrade} onChange={(value) => setCourseGrade(Number(value))} options={[9, 10, 11]} />
              <SelectField label="Class" value={courseSection} onChange={setCourseSection} options={["All", "Ac", "Mc"]} />
              <SelectField label="Default period" value={coursePeriod} onChange={(value) => setCoursePeriod(Number(value))} options={Array.from({ length: 11 }, (_, index) => index + 1)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <LineField label="Teacher" value={courseTeacher} onChange={setCourseTeacher} />
              <LineField label="Room" value={courseRoom} onChange={setCourseRoom} />
            </div>
            <button type="submit" disabled={saving || !courseName.trim() || !courseShortName.trim()} className="mt-4 bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.16em] text-white disabled:opacity-40">
              {saving ? "Adding…" : "Add course"}
            </button>
          </form>
          <aside className="border border-black p-4">
            <h2 className="font-serif text-2xl">Course catalog</h2>
            <div className="mt-3 grid gap-2">
              {(data?.subjects || []).map((subject) => (
                <div key={subject.id} className="flex items-center justify-between gap-3 border-b border-neutral-200 py-2 font-sans text-sm">
                  <div>
                    <span className="block">{subject.name}</span>
                    <span className="text-xs text-neutral-500">G{subject.grade} · {subject.class_section} · P{subject.default_period}</span>
                  </div>
                  {!teacherMode && subject.is_custom ? (
                    <button type="button" disabled={saving} onClick={() => handleCourseDelete(subject)} className="border border-red-700 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-red-700 disabled:opacity-40">
                      Delete
                    </button>
                  ) : (
                    <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">{subject.is_custom ? "Custom" : "School"}</span>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </div>
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

function DateField({ weekStart, dayIndex, onChange }) {
  const { t } = useI18n();
  return (
    <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {t("cj.date")}
      <input
        type="date"
        value={isoDate(dateForDay(dateFromIso(weekStart), dayIndex))}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal"
      />
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

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full border border-black bg-white p-2 font-sans text-sm normal-case tracking-normal text-neutral-900">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
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
