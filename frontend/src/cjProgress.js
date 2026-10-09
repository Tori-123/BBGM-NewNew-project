import { useCallback, useState } from "react";
import { dateForDay, isoDate } from "./cjDates";

const HOMEWORK_KEY = "cj-homework-progress-v1";

function readStored() {
  try {
    const value = JSON.parse(window.localStorage.getItem(HOMEWORK_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function homeworkKey(entry) {
  return `${entry.id}:${entry.hw}`;
}

export function useHomeworkProgress() {
  const [completed, setCompleted] = useState(readStored);
  const toggle = useCallback((entry) => {
    const key = homeworkKey(entry);
    setCompleted((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(HOMEWORK_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return { isComplete: (entry) => Boolean(completed[homeworkKey(entry)]), toggle };
}

export function isExamComplete(exam, weekStart, now = new Date()) {
  const examDate = dateForDay(weekStart, exam.day_index);
  const [hours, minutes] = String(exam.time || "23:59").split(":").map(Number);
  examDate.setHours(Number.isFinite(hours) ? hours : 23, Number.isFinite(minutes) ? minutes : 59, 0, 0);
  return examDate.getTime() < now.getTime();
}

export function examDateLabel(exam, weekStart) {
  return isoDate(dateForDay(weekStart, exam.day_index));
}
