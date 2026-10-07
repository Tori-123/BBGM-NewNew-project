import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
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

export function RequireCjRole({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingAccess />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/sign-in?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={CJ_HOME[user.role] || "/"} replace />;
  }
  return children;
}
