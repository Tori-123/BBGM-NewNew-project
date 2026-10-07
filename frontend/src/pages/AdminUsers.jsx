import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { useI18n } from "../i18n";
import { useLiveRefresh } from "../live";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsers() {
  const { user, ready, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/sign-in?next=/admin/users", { replace: true });
      return;
    }
    if (user.role !== "super_admin") {
      navigate("/", { replace: true });
    }
  }, [ready, user, navigate]);

  const refreshUsers = useCallback(async () => {
    const data = await api.listUsers({ pageSize: 50 });
    setItems(data.items);
    setError(null);
  }, []);

  useEffect(() => {
    if (!user || user.role !== "super_admin") return undefined;
    let cancelled = false;
    setLoading(true);
    refreshUsers()
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          navigate("/sign-in?next=/admin/users");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          navigate("/", { replace: true });
          return;
        }
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, navigate, setUser, refreshUsers]);

  useLiveRefresh(Boolean(user && user.role === "super_admin") && !loading, refreshUsers);

  function replaceItem(updated) {
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function setRole(target, role) {
    setError(null);
    try {
      replaceItem(await api.patchUserRole(target.id, role));
    } catch (err) {
      setError(err);
    }
  }

  async function setMuted(target, muted) {
    setError(null);
    try {
      replaceItem(await api.setUserMuted(target.id, muted));
    } catch (err) {
      setError(err);
    }
  }

  async function removeUser(target) {
    if (!window.confirm(t("users.deleteConfirm", { name: target.display_name }))) return;
    setError(null);
    try {
      await api.deleteUser(target.id);
      setItems((current) => current.filter((item) => item.id !== target.id));
    } catch (err) {
      setError(err);
    }
  }

  if (!ready || !user || user.role !== "super_admin") return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>{t("users.title")}</SectionRule>
      <ErrorBanner error={error} />
      {loading ? (
        <p className="font-sans text-sm text-neutral-500">{t("users.loading")}</p>
      ) : (
        <table className="w-full border-t border-black font-sans text-sm">
          <thead>
            <tr className="border-b border-black text-left text-[11px] uppercase tracking-[0.14em]">
              <th className="py-3 font-medium">{t("users.name")}</th>
              <th className="py-3 font-medium">{t("users.email")}</th>
              <th className="py-3 font-medium">{t("users.role")}</th>
              <th className="py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const locked = item.role === "super_admin" || item.id === user.id;
              return (
                <tr key={item.id} className="border-b border-neutral-200 align-top">
                  <td className="py-3">{item.display_name}</td>
                  <td className="py-3">{item.email}</td>
                  <td className="py-3 uppercase tracking-[0.08em]">{item.role}</td>
                  <td className="py-3 text-right">
                    {locked ? null : (
                      <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
                        {ROLES.filter((role) => role.value !== item.role).map((role) => (
                          <button
                            key={role.value}
                            type="button"
                            onClick={() => setRole(item, role.value)}
                            className="uppercase tracking-[0.12em] text-[#1A4FBF]"
                          >
                            {t(`users.${role.value}`)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setMuted(item, !item.muted)}
                          className="uppercase tracking-[0.12em] text-[#1A4FBF]"
                        >
                          {item.muted ? t("users.unmute") : t("users.mute")}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUser(item)}
                          className="uppercase tracking-[0.12em] text-red-700"
                        >
                          {t("users.delete")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
