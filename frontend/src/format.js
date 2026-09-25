export const CATEGORY_LABELS = {
  news: "NEWS",
  sports: "SPORTS",
  forum: "FORUM",
};

export const CATEGORY_ROUTES = [
  { to: "/news", label: "NEWS", category: "news" },
  { to: "/sports", label: "SPORTS", category: "sports" },
  { to: "/forum", label: "FORUM", category: "forum" },
  { to: "/opinion", label: "OPINION", category: null },
];

export const NEWSPAPER_OPTIONS = [
  { value: "news", label: "News" },
  { value: "sports", label: "Sports" },
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

export function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateline(iso);
}
