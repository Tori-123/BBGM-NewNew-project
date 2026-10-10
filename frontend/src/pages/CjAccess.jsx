import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { hasSeenCjHello, markCjHelloSeen } from "../cjHello";
import { useI18n } from "../i18n";

const CJ_HOME = {
  student: "/cj/student",
  teacher: "/cj/teacher",
  super_admin: "/cj/admin",
};

function LoadingAccess() {
  const { t } = useI18n();
  return <p className="mt-8 font-sans text-sm text-neutral-500">{t("cj.checkingAccess")}</p>;
}

export default function CjPortal() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingAccess />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Navigate to={CJ_HOME[user.role] || "/"} replace />;
}

function CjHello({ name }) {
  const { t } = useI18n();
  return (
    <div className="min-h-[70vh] px-2 pt-16 sm:px-6 sm:pt-20">
      <h1 className="cj-welcome-in text-left font-serif text-5xl leading-tight sm:text-7xl">{t("cj.hello", { name })}</h1>
    </div>
  );
}

export function RequireCjRole({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  const userId = user?.id;
  const seen = Boolean(userId && hasSeenCjHello(userId));
  const [released, setReleased] = useState(false);
  const entered = seen || released;

  useEffect(() => {
    if (!userId || hasSeenCjHello(userId)) return undefined;
    setReleased(false);
    const timer = window.setTimeout(() => {
      markCjHelloSeen(userId);
      setReleased(true);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [userId]);

  if (!ready) return <LoadingAccess />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={CJ_HOME[user.role] || "/"} replace />;
  }
  if (!entered) return <CjHello name={user.display_name} />;
  return children;
}
