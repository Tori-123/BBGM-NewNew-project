export const CATEGORY_LABELS = {
  news: "NEWS",
  dorm_life: "DORM LIFE",
  sports: "SPORTS",
  events: "EVENTS",
  community: "COMMUNITY",
};

export const CATEGORY_ROUTES = [
  { to: "/news", label: "NEWS", category: "news" },
  { to: "/sports", label: "SPORTS", category: "sports" },
  { to: "/dorm-life", label: "DORM LIFE", category: "dorm_life" },
  { to: "/community", label: "COMMUNITY", category: "community" },
  { to: "/opinion", label: "OPINION", category: null },
  { to: "/events", label: "EVENTS", category: "events" },
  { to: "/photo", label: "PHOTO", category: null },
];

export const NEWSPAPER_OPTIONS = [
  { value: "news", label: "News" },
  { value: "dorm_life", label: "Dorm Life" },
  { value: "sports", label: "Sports" },
  { value: "events", label: "Events" },
];

export function canEditPaper(user) {
  return user?.role === "editor" || user?.role === "admin";
}

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || (category || "").toUpperCase();
}

export function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateline(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStartsAt(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const day = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

export function toUtcZ(localDatetime) {
  if (!localDatetime) return null;
  const date = new Date(localDatetime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
