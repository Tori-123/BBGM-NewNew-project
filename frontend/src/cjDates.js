export const SCHOOL_NAME = "BASIS Bilingual School Guangming Shenzhen";
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
export const PERIOD_COUNT = 11;
export const SCHEDULE_KEY = "cj-schedule-v4";
export const SCHEDULE_PROFILE_KEY = "cj-schedule-profile-v1";

export const PERIOD_TIMES = [
  { period: 1, start: "08:00", end: "08:10" },
  { period: 2, start: "08:15", end: "09:00" },
  { period: 3, start: "09:05", end: "09:50" },
  { period: 4, start: "09:55", end: "10:40" },
  { period: 5, start: "10:45", end: "11:30" },
  { period: 6, start: "11:35", end: "12:20" },
  { period: 7, start: "12:25", end: "12:55" },
  { period: 8, start: "13:00", end: "13:30" },
  { period: 9, start: "13:35", end: "14:20" },
  { period: 10, start: "14:25", end: "15:10" },
  { period: 11, start: "15:15", end: "16:00" },
];

export const GRADE_OPTIONS = [
  { grade: 9, available: false },
  { grade: 10, available: false },
  { grade: 11, available: true },
];

export const CLASS_BUNDLES = {
  "11Ac": {
    label: "Grade 11 · Ac",
    description: "Applies the fixed 11Ac courses and the reference timetable from the school schedule.",
    schedule: [
      "advisory-11ac",
      "chinese-11ac",
      "ap-micro-macro",
      "study-hall",
      "ap-lang-11ac",
      "ap-euro-11ac",
      "lunch-11ac",
      "ae-11ac",
      "ap-physics",
      "ap-calculus-11ac",
      "ap-csa",
    ],
    lockedPeriods: [1, 2, 5, 6, 7, 8, 10],
  },
  "11Mc": {
    label: "Grade 11 · Mc",
    description: "Applies the fixed 11Mc courses. Open periods remain available for electives.",
    schedule: [
      "advisory-11mc",
      "ap-euro-11mc",
      "ap-lang-11mc",
      "ap-calculus-11mc",
      "chinese-11mc",
      "",
      "lunch-11mc",
      "ae-11mc",
      "",
      "",
      "",
    ],
    lockedPeriods: [1, 2, 3, 4, 5, 7, 8],
  },
};

export function periodTime(period) {
  return PERIOD_TIMES[period - 1] || { period, start: "TBA", end: "TBA" };
}

export function periodTimeLabel(period) {
  const slot = periodTime(period);
  return `${slot.start}–${slot.end}`;
}

export function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function mondayOf(date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  result.setHours(12, 0, 0, 0);
  return result;
}

export function mondayIso(date = new Date()) {
  return isoDate(mondayOf(date));
}

export function monthWeeks(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const start = mondayOf(first);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const weeks = [];
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

export function formatRange(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 4);
  return `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
}

export function dateForDay(weekStart, index) {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + index);
  return date;
}

export function weekNumber(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function defaultSchedule(subjects, profile = "11Ac") {
  const validIds = new Set(subjects.map((subject) => subject.id));
  const bundle = CLASS_BUNDLES[profile] || CLASS_BUNDLES["11Ac"];
  return bundle.schedule.map((id) => (validIds.has(id) ? id : ""));
}

export function normalizeSchedule(savedIds, subjects, profile = "11Ac") {
  const validIds = new Set(subjects.map((subject) => subject.id));
  const fallback = defaultSchedule(subjects, profile);
  const source = Array.isArray(savedIds) ? savedIds : [];
  const next = Array.from({ length: PERIOD_COUNT }, (_, index) => {
    const id = source[index];
    return id === "" || validIds.has(id) ? id : fallback[index];
  });
  const bundle = CLASS_BUNDLES[profile];
  if (bundle) {
    bundle.lockedPeriods.forEach((period) => {
      const requiredId = bundle.schedule[period - 1];
      if (validIds.has(requiredId)) next[period - 1] = requiredId;
    });
  }
  return next;
}

export function subjectsForProfile(subjects, profile) {
  const section = profile === "11Mc" ? "Mc" : "Ac";
  return subjects.filter(
    (subject) => Number(subject.grade) === 11 && ["All", section].includes(subject.class_section),
  );
}

export function previousSchoolDay(date) {
  const next = new Date(date);
  do next.setDate(next.getDate() - 1); while ([0, 6].includes(next.getDay()));
  return next;
}

export function nextSchoolDay(date) {
  const next = new Date(date);
  do next.setDate(next.getDate() + 1); while ([0, 6].includes(next.getDay()));
  return next;
}
