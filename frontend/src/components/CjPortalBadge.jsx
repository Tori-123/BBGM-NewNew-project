import { SCHOOL_NAME } from "../cjDates";

const PORTAL_STYLES = {
  student: { label: "Student Portal", className: "bg-[#1A4FBF] text-white" },
  teacher: { label: "Teacher Portal", className: "bg-[#0f766e] text-white" },
  admin: { label: "Admin Portal", className: "bg-black text-white" },
};

export default function CjPortalBadge({ portal = "student" }) {
  const config = PORTAL_STYLES[portal] || PORTAL_STYLES.student;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-3 font-sans">
      <span className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${config.className}`}>
        {config.label}
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">{SCHOOL_NAME}</span>
    </div>
  );
}
