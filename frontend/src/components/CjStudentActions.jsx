import CjTooltip from "./CjTooltip";

const square = "flex h-9 w-9 items-center justify-center border border-black bg-white text-inherit no-underline";

export default function CjStudentActions({ onToday, onRefresh, onCourses, coursesOpen = false, coursesDisabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-2 font-sans text-xs">
      {onToday ? (
        <CjTooltip label="Open today">
          <button type="button" aria-label="Open today" onClick={onToday} className="h-9 border border-black bg-white px-3">Today</button>
        </CjTooltip>
      ) : null}
      {onRefresh ? (
        <CjTooltip label="Refresh CJ">
          <button type="button" aria-label="Refresh CJ" onClick={onRefresh} className={square}>↻</button>
        </CjTooltip>
      ) : null}
      {onCourses ? (
        <CjTooltip label={coursesOpen ? "Close courses" : "Choose courses"}>
          <button
            type="button"
            aria-label={coursesOpen ? "Close courses" : "Choose courses"}
            disabled={coursesDisabled}
            onClick={onCourses}
            className={`h-9 px-3 text-white disabled:opacity-40 ${coursesOpen ? "bg-[#1A4FBF]" : "bg-black"}`}
          >
            Courses
          </button>
        </CjTooltip>
      ) : null}
    </div>
  );
}
