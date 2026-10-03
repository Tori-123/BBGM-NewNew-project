"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(12, 0, 0, 0);
  return result;
}

function monthWeeks(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = mondayOf(first);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const weeks: Date[][] = [];
  const cursor = new Date(start);
  while (cursor <= last || weeks.length < 5) {
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      return date;
    });
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

export function MonthCalendar() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const weeks = useMemo(() => monthWeeks(month), [month]);

  function moveMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand-mark" aria-label="CJ Online 首页">
            <span className="brand-icon"><BookOpen /></span>
            <span><strong>CJ Online</strong><small>BASIS BILINGUAL GUANGMING</small></span>
          </Link>
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/admin"><Settings2 /> 管理端</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-7 lg:py-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">MONTHLY DIRECTORY</p>
            <h1 className="page-title">选择一周</h1>
            <p className="page-description">点击任意一行，查看这一周完整的 CJ 与考试安排。</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white p-1.5 shadow-sm">
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="上个月" onClick={() => moveMonth(-1)}><ChevronLeft /></Button>
            <Button variant="ghost" className="min-w-32 rounded-full" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))}>回到本月</Button>
            <Button size="icon" variant="ghost" className="rounded-full" aria-label="下个月" onClick={() => moveMonth(1)}><ChevronRight /></Button>
          </div>
        </div>

        <div className="calendar-shell">
          <div className="calendar-month-bar">
            <div><span>{month.getFullYear()}</span><strong>{month.getMonth() + 1} 月</strong></div>
            <Button asChild className="rounded-full bg-white text-[var(--blue-700)] hover:bg-[var(--blue-50)]">
              <Link href={`/week?start=${isoDate(mondayOf(today))}`}>查看本周</Link>
            </Button>
          </div>
          <div className="calendar-weekdays">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-weeks">
            {weeks.map((week, weekIndex) => {
              const start = week[0];
              const end = week[4];
              const currentWeek = isoDate(start) === isoDate(mondayOf(today));
              return (
                <Link
                  key={isoDate(start)}
                  href={`/week?start=${isoDate(start)}`}
                  className={`calendar-week ${currentWeek ? "calendar-week-current" : ""}`}
                  aria-label={`查看 ${start.getMonth() + 1}月${start.getDate()}日至${end.getMonth() + 1}月${end.getDate()}日的 CJ`}
                >
                  {week.map((date, dayIndex) => {
                    const inMonth = date.getMonth() === month.getMonth();
                    const isToday = isoDate(date) === isoDate(today);
                    return (
                      <span key={isoDate(date)} className={`calendar-day ${!inMonth ? "calendar-day-muted" : ""} ${isToday ? "calendar-day-today" : ""}`}>
                        <b>{date.getDate()}</b>
                        {dayIndex === 0 && <small>第 {weekIndex + 1} 周</small>}
                      </span>
                    );
                  })}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
