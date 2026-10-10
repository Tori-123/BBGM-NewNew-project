import {
  CLASS_BUNDLES,
  GRADE_OPTIONS,
  PERIOD_COUNT,
  courseOptionLabel,
  defaultSchedule,
  normalizeSchedule,
  periodTimeLabel,
  subjectsForPeriod,
} from "../cjDates";

export default function CjSchedulePicker({ subjects, profile, selection, onProfileChange, onSelectionChange, onSave }) {
  const bundle = CLASS_BUNDLES[profile] || null;
  const locked = new Set(bundle?.lockedPeriods || []);

  function applyBundle(nextProfile) {
    onProfileChange(nextProfile);
    onSelectionChange(defaultSchedule(subjects, nextProfile));
  }

  function updatePeriod(index, value) {
    onSelectionChange(selection.map((id, itemIndex) => (itemIndex === index ? value : id)));
  }

  function startManual() {
    onProfileChange("custom");
    onSelectionChange(Array(PERIOD_COUNT).fill(""));
  }

  function save() {
    onSave(normalizeSchedule(selection, subjects, profile), profile);
  }

  return (
    <section className="mt-4 border border-black bg-white p-3">
      <h2 className="font-sans text-lg font-semibold">Courses</h2>
      <p className="mt-1 font-sans text-xs text-neutral-500">Start with an empty timetable, or apply an optional Ac/Mc class plan.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {GRADE_OPTIONS.map((option) => (
          <div
            key={option.grade}
            className={`border px-3 py-2 ${option.available ? "border-[#1A4FBF] bg-[#f3f6fd]" : "border-neutral-200 text-neutral-400"}`}
          >
            <p className="font-sans text-sm font-semibold">Grade {option.grade}</p>
            <p className="font-sans text-[10px]">{option.available ? "Available" : "Soon"}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={startManual}
          className={`border px-3 py-2 text-left ${!bundle ? "border-black bg-black text-white" : "border-neutral-300"}`}
        >
          <span className="block font-sans text-sm font-semibold">Manual setup</span>
          <span className="mt-0.5 block font-sans text-[10px] opacity-70">Start with all periods unselected</span>
        </button>
        {Object.entries(CLASS_BUNDLES).map(([id, item]) => (
          <button
            key={id}
            type="button"
            onClick={() => applyBundle(id)}
            className={`border px-3 py-2 text-left ${profile === id ? "border-black bg-black text-white" : "border-neutral-300"}`}
          >
            <span className="block font-sans text-sm font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden border border-neutral-300">
        {Array.from({ length: PERIOD_COUNT }, (_, index) => {
          const period = index + 1;
          const isLocked = locked.has(period);
          return (
            <label key={period} className="grid items-center gap-2 border-b border-neutral-200 p-2 font-sans text-[10px] uppercase tracking-[0.12em] text-[#1A4FBF] last:border-b-0 sm:grid-cols-[220px_1fr]">
              <span className="flex items-center justify-between gap-2 sm:pr-3">
                <span>Period {period}<span className="ml-2 text-neutral-500">{periodTimeLabel(period)}</span></span>
                {isLocked ? <span title="Fixed course" className="text-neutral-500">●</span> : null}
              </span>
              <select
                disabled={isLocked}
                className="w-full border border-black bg-white p-1.5 font-sans text-xs normal-case tracking-normal text-neutral-900 disabled:border-neutral-200 disabled:bg-neutral-100"
                value={selection[index] || ""}
                onChange={(event) => updatePeriod(index, event.target.value)}
              >
                <option value="">Free period / no course</option>
                {subjectsForPeriod(subjects, profile, period).map((subject) => (
                  <option key={subject.id} value={subject.id}>{courseOptionLabel(subject)}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      <button type="button" onClick={save} className="mt-3 bg-[#1A4FBF] px-4 py-2 font-sans text-[11px] uppercase tracking-[0.14em] text-white">
        Save courses
      </button>
    </section>
  );
}
