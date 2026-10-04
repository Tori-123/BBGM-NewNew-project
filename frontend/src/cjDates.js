export const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export const WEEKDAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI"];
export const PERIOD_COUNT = 8;
export const SCHEDULE_KEY = "cj-schedule-v3";

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
  return `${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
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

export function defaultSchedule(subjects) {
  if (!subjects.length) return Array.from({ length: PERIOD_COUNT }, () => "");
  return Array.from({ length: PERIOD_COUNT }, (_, index) => subjects[index % subjects.length].id);
}

export function normalizeSchedule(savedIds, subjects) {
  const validIds = new Set(subjects.map((subject) => subject.id));
  const fallback = defaultSchedule(subjects);
  return Array.from({ length: PERIOD_COUNT }, (_, index) =>
    validIds.has(savedIds[index]) ? savedIds[index] : fallback[index],
  );
}
