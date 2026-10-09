import { Link, useNavigate } from "react-router-dom";
import { isoDate, mondayOf, weekNumber } from "../cjDates";
import CjTooltip from "./CjTooltip";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthParam(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function CjDateNavigation({
  date,
  mode = "day",
  onPrevious,
  onNext,
  eyebrow,
  detail,
  weekEnd,
}) {
  const navigate = useNavigate();
  const year = date.getFullYear();
  const weekStart = mondayOf(date);
  const referenceDate = isoDate(date);
  const monthHref = `/cj/student/calendar?month=${monthParam(date)}&date=${referenceDate}`;
  const yearHref = `/cj/student/year?year=${year}&date=${referenceDate}`;
  const weekHref = `/cj/student/week?start=${isoDate(weekStart)}`;
  const viewLabel = mode === "day"
    ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : mode === "week"
      ? `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${(weekEnd || date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "";
  const itemClass = "inline-flex h-9 min-w-0 items-center justify-center border border-black px-2 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] no-underline";
  const itemStyle = (active) => `${itemClass} ${active ? "bg-black text-white" : "bg-white text-black hover:bg-[#edf3ff]"}`;

  return (
    <div className="flex items-center gap-2">
      <CjTooltip label="Back to previous page" align="left">
        <button type="button" aria-label="Back to previous page" onClick={() => navigate(-1)} className="h-9 w-9 border border-black bg-white text-base">←</button>
      </CjTooltip>
      {onPrevious ? (
        <CjTooltip label={`Previous ${mode}`} align="left">
          <button type="button" aria-label={`Previous ${mode}`} onClick={onPrevious} className="h-9 w-9 border border-black bg-white text-lg">‹</button>
        </CjTooltip>
      ) : null}
      <div>
        {eyebrow ? <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-[#1A4FBF]">{eyebrow}</p> : null}
        <nav aria-label="CJ date views" className="mt-1 grid w-[276px] grid-cols-3 gap-1.5">
          <Link to={weekHref} className={itemStyle(mode === "week")}>Week {weekNumber(date)}</Link>
          <Link to={monthHref} className={itemStyle(mode === "month")}>{MONTHS[date.getMonth()]}</Link>
          <Link to={yearHref} className={itemStyle(mode === "year")}>{year}</Link>
        </nav>
        <p className="mt-1 min-h-4 font-sans text-[11px] text-neutral-500">{[viewLabel, detail].filter(Boolean).join(" · ")}</p>
      </div>
      {onNext ? (
        <CjTooltip label={`Next ${mode}`} align="left">
          <button type="button" aria-label={`Next ${mode}`} onClick={onNext} className="h-9 w-9 border border-black bg-white text-lg">›</button>
        </CjTooltip>
      ) : null}
    </div>
  );
}
