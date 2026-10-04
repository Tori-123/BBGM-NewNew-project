import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isoDate, mondayOf, monthWeeks } from "../cjDates";
import { useI18n } from "../i18n";

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function CjMonth() {
  const { lang, t } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const todayIso = isoDate(today);

  function moveMonth(offset) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
  }

  const monthTitle =
    lang === "zh"
      ? t("cj.monthTitle", { year: month.getFullYear(), month: month.getMonth() + 1 })
      : `${MONTHS_EN[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("cj.directory")}</p>
          <h1 className="mt-2 font-serif text-4xl">{t("cj.pickWeek")}</h1>
          <p className="mt-2 font-sans text-sm text-neutral-600">{t("cj.pickHint")}</p>
        </div>
        <div className="flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.14em]">
          <button type="button" onClick={() => moveMonth(-1)} className="border border-black px-3 py-2">
            {t("cj.prevMonth")}
          </button>
          <button
            type="button"
            onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12))}
            className="border border-black px-3 py-2"
          >
            {t("cj.thisMonth")}
          </button>
          <button type="button" onClick={() => moveMonth(1)} className="border border-black px-3 py-2">
            {t("cj.nextMonth")}
          </button>
        </div>
      </div>

      <div className="mt-8 border border-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black px-4 py-3">
          <p className="font-serif text-2xl">{monthTitle}</p>
          <Link to={`/cj/day?date=${todayIso}`} className="font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]">
            {t("cj.today")}
          </Link>
        </div>
        <div className="grid grid-cols-7 border-b border-neutral-200 font-sans text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className="px-2 py-2 text-center">
              {t(`cj.wd.${index}`)}
            </span>
          ))}
        </div>
        {weeks.map((week) => {
          const start = week[0];
          const currentWeek = isoDate(mondayOf(today)) === isoDate(start);
          return (
            <div
              key={isoDate(start)}
              className={`grid grid-cols-7 border-b border-neutral-200 last:border-b-0 ${currentWeek ? "bg-neutral-50" : ""}`}
            >
              {week.map((date, dayIndex) => {
                const inMonth = date.getMonth() === month.getMonth();
                const isToday = isoDate(date) === todayIso;
                return (
                  <Link
                    key={isoDate(date)}
                    to={`/cj/day?date=${isoDate(date)}`}
                    aria-label={t("cj.viewDay", { date: isoDate(date) })}
                    className={`px-2 py-3 text-center font-sans text-sm no-underline ${
                      inMonth ? "text-neutral-900" : "text-neutral-300"
                    }`}
                  >
                    <b className={isToday ? "text-[#1A4FBF]" : ""}>{date.getDate()}</b>
                    {dayIndex === 0 ? (
                      <small className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                        {t("cj.weekLabel", { index: weekIndexOf(date) })}
                      </small>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-sans text-sm">
        <Link to="/cj/admin" className="text-[#1A4FBF]">
          {t("cj.admin")}
        </Link>
      </p>
    </section>
  );
}

function weekIndexOf(monday) {
  const first = new Date(monday.getFullYear(), monday.getMonth(), 1, 12);
  const start = new Date(first);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return Math.round((monday.getTime() - start.getTime()) / 86400000 / 7) + 1;
}
