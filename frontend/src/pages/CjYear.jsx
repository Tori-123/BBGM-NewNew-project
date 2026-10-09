import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CjDateNavigation from "../components/CjDateNavigation";
import CjPortalBadge from "../components/CjPortalBadge";
import { isoDate, monthWeeks } from "../cjDates";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function CjYear() {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get("year"));
  const requestedDate = params.get("date") || "";
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : new Date().getFullYear();
  const date = useMemo(() => {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? new Date(`${requestedDate}T12:00:00`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year ? parsed : new Date(year, 0, 1, 12);
  }, [requestedDate, year]);

  return (
    <section className="mt-8">
      <CjPortalBadge portal="student" />
      <CjDateNavigation
        date={date}
        mode="year"
        eyebrow="Year calendar"
        detail="Choose a month"
        onPrevious={() => setParams({ year: String(year - 1), date: `${year - 1}-01-01` })}
        onNext={() => setParams({ year: String(year + 1), date: `${year + 1}-01-01` })}
      />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((name, monthIndex) => {
          const month = new Date(year, monthIndex, 1, 12);
          const monthParam = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
          const weeks = monthWeeks(month);
          return (
            <article key={name} className="border border-black bg-white p-3">
              <Link to={`/cj/student/calendar?month=${monthParam}&date=${monthParam}-01`} className="font-sans text-sm font-semibold text-inherit no-underline hover:text-[#1A4FBF]">{name}</Link>
              <div className="mt-2 grid grid-cols-7 gap-y-1 text-center font-sans text-[9px]">
                {DAYS.map((day, index) => <span key={`${day}-${index}`} className="text-neutral-400">{day}</span>)}
                {weeks.flat().map((day) => (
                  <span key={isoDate(day)} className={day.getMonth() === monthIndex ? "text-neutral-800" : "text-neutral-300"}>{day.getDate()}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
