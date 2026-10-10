import { useCallback, useEffect, useState } from "react";

const WAIT_MS = 60_000;

function storageKey(purpose, email) {
  return `elegram-code-wait:${purpose}:${email.trim().toLowerCase()}`;
}

export function codeWaitSeconds(purpose, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;
  try {
    const until = Number(sessionStorage.getItem(storageKey(purpose, normalized)));
    if (!Number.isFinite(until)) return 0;
    const left = Math.ceil((until - Date.now()) / 1000);
    if (left <= 0) {
      sessionStorage.removeItem(storageKey(purpose, normalized));
      return 0;
    }
    return left;
  } catch {
    return 0;
  }
}

export function rememberCodeWait(purpose, email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  try {
    sessionStorage.setItem(storageKey(purpose, normalized), String(Date.now() + WAIT_MS));
  } catch {
    // Private mode can reject storage; the button still waits until this page unmounts.
  }
}

export function useCodeCooldown(purpose, email) {
  const [secondsLeft, setSecondsLeft] = useState(() => codeWaitSeconds(purpose, email));

  useEffect(() => {
    const tick = () => setSecondsLeft(codeWaitSeconds(purpose, email));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [purpose, email]);

  const begin = useCallback(() => {
    rememberCodeWait(purpose, email);
    setSecondsLeft(codeWaitSeconds(purpose, email));
  }, [purpose, email]);

  return { secondsLeft, begin };
}
