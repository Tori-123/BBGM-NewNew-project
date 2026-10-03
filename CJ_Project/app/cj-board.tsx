"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CJEntry, CJPayload, Exam, Subject } from "./cj-types";

const weekdays = ["周一", "周二", "周三", "周四", "周五"];
const englishDays = ["MON", "TUE", "WED", "THU", "FRI"];
const selectionKey = "cj-schedule-v3";
const periodCount = 8;
type ScheduledSubject = Subject & { period: number };

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRange(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4);
  return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
}

function dateForDay(weekStart: Date, index: number) {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + index);
  return date;
}

function defaultSchedule(subjects: Subject[]) {
  if (!subjects.length) return Array.from({ length: periodCount }, () => "");
  return Array.from({ length: periodCount }, (_, index) => subjects[index % subjects.length].id);
}

function normalizeSchedule(savedIds: string[], subjects: Subject[]) {
  const validIds = new Set(subjects.map((subject) => subject.id));
  const fallback = defaultSchedule(subjects);
  return Array.from({ length: periodCount }, (_, index) => validIds.has(savedIds[index]) ? savedIds[index] : fallback[index]);
}

export function CJBoard({ initialWeekStart }: { initialWeekStart: string }) {
  const [weekStart, setWeekStart] = useState(() => dateFromIso(initialWeekStart));
  const [data, setData] = useState<CJPayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [draftSelection, setDraftSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/cj?weekStart=${isoDate(weekStart)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("CJ 暂时无法加载");
      const payload = (await response.json()) as CJPayload;
      setData(payload);
      const saved = window.localStorage.getItem(selectionKey);
      const savedIds = saved ? (JSON.parse(saved) as string[]) : defaultSchedule(payload.subjects);
      const initial = normalizeSchedule(savedIds, payload.subjects);
      setSelected(initial);
      setDraftSelection(initial);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "CJ 暂时无法加载");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  // Data fetching intentionally owns the loading state for each selected week.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadWeek(); }, [loadWeek]);

  const subjectMap = useMemo(
    () => new Map(data?.subjects.map((subject) => [subject.id, subject]) ?? []),
    [data],
  );
  const selectedSubjects = useMemo(
    () => selected.flatMap((id, index): ScheduledSubject[] => {
      const subject = subjectMap.get(id);
      return subject ? [{ ...subject, period: index + 1 }] : [];
    }),
    [selected, subjectMap],
  );
  function moveWeek(offset: number) {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + offset * 7);
    setWeekStart(next);
    window.history.replaceState({}, "", `/week?start=${isoDate(next)}`);
  }

  function chooseSubject(period: number, subjectId: string) {
    setDraftSelection((current) => current.map((id, index) => index === period - 1 ? subjectId : id));
  }

  function saveSelection() {
    const next = normalizeSchedule(draftSelection, data?.subjects ?? []);
    setSelected(next);
    setDraftSelection(next);
    window.localStorage.setItem(selectionKey, JSON.stringify(next));
  }

  return (
    <main className="cj-board-page min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="site-header">
        <div className="site-header-inner max-w-[1680px]">
          <Link href="/" className="brand-mark" aria-label="CJ Online 月历">
            <span className="brand-icon"><BookOpen /></span>
            <span><strong>CJ Online</strong><small>BASIS BILINGUAL GUANGMING</small></span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="主要导航">
            <Button asChild variant="ghost" className="rounded-full"><Link href="/"><CalendarRange /> <span className="hidden sm:inline">月历</span></Link></Button>
            <Button asChild variant="ghost" className="hidden rounded-full sm:inline-flex"><Link href="/admin"><Settings2 /> 管理端</Link></Button>
            <SchedulePicker
              subjects={data?.subjects ?? []}
              draftSelection={draftSelection}
              onChoose={chooseSubject}
              onSave={saveSelection}
              disabled={!data}
            />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-[1680px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow"><CalendarDays /> {weekStart.getFullYear()} · 第 {getWeekNumber(weekStart)} 周</p>
            <h1 className="page-title">本周 CJ</h1>
            <p className="page-description">{formatRange(weekStart)} · 我的课表 {selectedSubjects.length} 门</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white p-1.5 shadow-sm">
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="上一周" onClick={() => moveWeek(-1)}><ChevronLeft /></Button>
            <Button asChild variant="ghost" className="rounded-full px-5"><Link href="/">选择其他周</Link></Button>
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="下一周" onClick={() => moveWeek(1)}><ChevronRight /></Button>
          </div>
        </div>

        <ExamList exams={data?.exams ?? []} weekStart={weekStart} loading={loading} />

        {error ? (
          <div className="empty-state"><p>{error}</p><Button onClick={() => void loadWeek()}>重新加载</Button></div>
        ) : (
          <div className="week-scroll" aria-label="周一到周五 CJ">
            <div className="week-columns">
              {weekdays.map((day, dayIndex) => (
                <DayColumn
                  key={day}
                  day={day}
                  englishDay={englishDays[dayIndex]}
                  date={dateForDay(weekStart, dayIndex)}
                  dayIndex={dayIndex}
                  subjects={selectedSubjects}
                  entries={data?.entries ?? []}
                  loading={loading}
                />
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 text-sm text-[var(--muted-foreground)] md:hidden">左右滑动即可查看周一到周五，无需切换日期。</p>
      </section>
    </main>
  );
}

function DayColumn({
  day,
  englishDay,
  date,
  dayIndex,
  subjects,
  entries,
  loading,
}: {
  day: string;
  englishDay: string;
  date: Date;
  dayIndex: number;
  subjects: ScheduledSubject[];
  entries: CJEntry[];
  loading: boolean;
}) {
  return (
    <section className="day-column">
      <header className="day-column-header">
        <span>{englishDay}</span>
        <div><h2>{day}</h2><time>{date.getMonth() + 1}/{date.getDate()}</time></div>
      </header>
      <div className="day-column-content">
        {loading ? Array.from({ length: 5 }, (_, index) => <div key={index} className="course-card course-card-loading" />) : subjects.map((subject) => {
          const entry = entries.find((item) => item.dayIndex === dayIndex && item.subjectId === subject.id);
          return <CourseCard key={`${subject.period}-${subject.id}`} subject={subject} entry={entry} />;
        })}
      </div>
    </section>
  );
}

function CourseCard({ subject, entry }: { subject: ScheduledSubject; entry?: CJEntry }) {
  return (
    <article className="course-card">
      <div className="course-card-title">
        <span className="period-badge">P{subject.period}</span>
        <div><h3>{subject.shortName}</h3><p>{subject.name}</p></div>
      </div>
      <Info label="IC" value={entry?.ic} />
      <Info label="HW" value={entry?.hw} highlight />
      <Info label="A" value={entry?.announcement} />
    </article>
  );
}

function Info({ label, value, highlight = false }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className={`course-info ${highlight && value ? "course-info-highlight" : ""}`}>
      <span>{label}</span><p>{value || "—"}</p>
    </div>
  );
}

function ExamList({ exams, weekStart, loading }: { exams: Exam[]; weekStart: Date; loading: boolean }) {
  return (
    <section className="exam-panel" aria-labelledby="exam-heading">
      <div className="exam-panel-heading">
        <div className="exam-icon"><CalendarDays /></div>
        <div><p>EXAMS</p><h2 id="exam-heading">本周考试时间</h2></div>
      </div>
      <div className="exam-list">
        {loading ? (
          <div className="exam-empty">正在读取考试安排…</div>
        ) : exams.length ? exams.map((exam) => {
          const date = dateForDay(weekStart, exam.dayIndex);
          return (
            <article key={exam.id} className="exam-item">
              <time><b>{weekdays[exam.dayIndex]}</b><span>{date.getMonth() + 1}/{date.getDate()}</span></time>
              <div><h3>{exam.title}</h3><p><Clock3 /> {exam.time}{exam.location && <><span>·</span><MapPin /> {exam.location}</>}</p>{exam.note && <small>{exam.note}</small>}</div>
            </article>
          );
        }) : <div className="exam-empty">这一周暂时没有考试安排</div>}
      </div>
    </section>
  );
}

function SchedulePicker({
  subjects,
  draftSelection,
  onChoose,
  onSave,
  disabled,
}: {
  subjects: Subject[];
  draftSelection: string[];
  onChoose: (period: number, subjectId: string) => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} className="rounded-full bg-[var(--blue-600)] text-white hover:bg-[var(--blue-700)]"><SlidersHorizontal /> 我的课程</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl border-[var(--border)] bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">设置我的课表</DialogTitle>
          <DialogDescription>为 Period 1–8 分别选择课程；每门课程都可以安排在任意 Period。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {Array.from({ length: periodCount }, (_, index) => {
            const period = index + 1;
            const value = draftSelection[index] ?? subjects[0]?.id ?? "";
            return (
              <div key={period} className="schedule-group">
                <label htmlFor={`period-${period}`}>Period {period}</label>
                <Select value={value} onValueChange={(subjectId) => onChoose(period, subjectId)}>
                  <SelectTrigger id={`period-${period}`} aria-label={`Period ${period} 课程`} className="mt-2 h-11 w-full rounded-xl bg-white">
                    <SelectValue placeholder="选择课程" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.shortName} · {subject.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button onClick={onSave} className="rounded-full bg-[var(--blue-600)] px-6 text-white hover:bg-[var(--blue-700)]">保存课表</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getWeekNumber(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
