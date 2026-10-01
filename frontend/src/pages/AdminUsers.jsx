import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { useLiveRefresh } from "../live";

const ROLES = [
  { value: "student", label: "Student" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
];

export default function AdminUsers() {
  const { user, ready, setUser } = useAuth();
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
    if (!window.confirm(`Delete ${target.display_name}? Their posts will be removed.`)) return;
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
      <SectionRule>Users</SectionRule>
      <ErrorBanner error={error} />
      {loading ? (
        <p className="font-sans text-sm text-neutral-500">Loading accounts.</p>
      ) : (
        <table className="w-full border-t border-black font-sans text-sm">
          <thead>
            <tr className="border-b border-black text-left text-[11px] uppercase tracking-[0.14em]">
              <th className="py-3 font-medium">Name</th>
              <th className="py-3 font-medium">Email</th>
              <th className="py-3 font-medium">Role</th>
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
                            {role.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setMuted(item, !item.muted)}
                          className="uppercase tracking-[0.12em] text-[#1A4FBF]"
                        >
                          {item.muted ? "Unmute" : "Mute"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUser(item)}
                          className="uppercase tracking-[0.12em] text-red-700"
                        >
                          Delete user
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
