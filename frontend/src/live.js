import { useEffect } from "react";

export const LIVE_INTERVAL_MS = 4000;

export function mergeLivePosts(current, incoming) {
  const fresh = new Map(incoming.map((item) => [item.id, item]));
  const head = incoming.map((item) => fresh.get(item.id));
  const tail = current.filter((item) => !fresh.has(item.id));
  return [...head, ...tail];
}

export function mergeLiveFloors(current, incoming) {
  const byId = new Map(current.map((floor) => [floor.id, floor]));
  incoming.forEach((floor) => byId.set(floor.id, floor));
  return [...byId.values()].sort((left, right) => (left.floor ?? 0) - (right.floor ?? 0));
}

export function useLiveRefresh(enabled, refresh, intervalMs = LIVE_INTERVAL_MS) {
  useEffect(() => {
    if (!enabled || typeof refresh !== "function") return undefined;

    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        await refresh();
      } catch {
        /* keep current view */
      } finally {
        inFlight = false;
      }
    }

    const id = setInterval(tick, intervalMs);
    function onVisibility() {
      if (!document.hidden) tick();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, refresh, intervalMs]);
}
