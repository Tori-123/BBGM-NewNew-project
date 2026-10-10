const PREFIX = "elegram-cj-hello:";

function storageKey(userId) {
  return `${PREFIX}${userId}`;
}

export function hasSeenCjHello(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markCjHelloSeen(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    // Private mode can reject storage; the greeting can play again next visit.
  }
}

export function clearCjHello(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // Ignore storage failures.
  }
}
