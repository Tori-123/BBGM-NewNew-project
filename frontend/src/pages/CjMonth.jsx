import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CjPortalBadge from "../components/CjPortalBadge";
import { WEEKDAYS, isoDate, mondayIso, monthWeeks } from "../cjDates";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CjMonth() {
  const today = useMemo(() => new Date(), []);
  const [params, setParams] = useSearchParams();
  const requestedMonth = params.get("month") || "";
  const month = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(requestedMonth);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, 1, 12) : new Date(today.getFullYear(), today.getMonth(), 1, 12);
  }, [requestedMonth, today]);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const todayIso = isoDate(today);

  function moveMonth(offset) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
    setParams({ month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}` });
  }

  return (
    <section className="mt-8">
      <CjPortalBadge portal="student" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#1A4FBF]">Calendar</p>
          <h1 className="mt-1 font-sans text-2xl font-semibold">Choose a day</h1>
        </div>
        <div className="flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
          <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="h-9 w-9 border border-black text-lg">‹</button>
          <Link aria-label="Weekly view" title="Weekly view" to={`/cj/student/week?start=${mondayIso(today)}`} className="flex h-9 w-9 items-center justify-center border border-black text-inherit no-underline">▦</Link>
          <button type="button" aria-label="This month" onClick={() => setParams({ month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` })} className="border border-black px-3 py-2">Today</button>
          <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="h-9 w-9 border border-black text-lg">›</button>
        </div>
      </div>

      <div className="mt-8 border border-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-4 py-3">
          <p className="font-serif text-2xl">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
          <Link to={`/cj/student/day?date=${todayIso}`} className="font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">Open today</Link>
        </div>
        <div className="grid grid-cols-7 border-b border-neutral-200 font-sans text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {WEEKDAYS.map((day) => <span key={day} className="px-2 py-2 text-center">{day.slice(0, 3)}</span>)}
        </div>
        {weeks.map((week) => (
          <div key={isoDate(week[0])} className="grid grid-cols-7 border-b border-neutral-200 last:border-b-0">
            {week.map((date, dayIndex) => {
              const dateIso = isoDate(date);
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = dateIso === todayIso;
              const isSchoolDay = dayIndex < 5;
              const className = `min-h-16 px-2 py-3 text-center font-sans text-sm transition-colors ${
                inMonth ? "text-neutral-900" : "text-neutral-300"
              } ${isSchoolDay ? "hover:bg-[#f3f6fd]" : "bg-neutral-50"}`;
              return isSchoolDay ? (
                <Link key={dateIso} to={`/cj/student/day?date=${dateIso}`} aria-label={`Open CJ for ${dateIso}`} className={`${className} text-inherit no-underline`}>
                  <b className={isToday ? "text-[#1A4FBF]" : ""}>{date.getDate()}</b>
                  <small className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-neutral-400">Open day</small>
                </Link>
              ) : (
                <span key={dateIso} className={className}><b>{date.getDate()}</b></span>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
