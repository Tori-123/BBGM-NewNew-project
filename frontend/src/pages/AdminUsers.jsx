import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";

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
    if (user.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let cancelled = false;
    setLoading(true);
    api
      .listUsers()
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setError(null);
      })
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
  }, [user, navigate, setUser]);

  async function setBanned(target, banned) {
    setError(null);
    try {
      const updated = await api.setUserBanned(target.id, banned);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err);
    }
  }

  async function setRole(target, role) {
    setError(null);
    try {
      const updated = await api.patchUserRole(target.id, role);
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err);
    }
  }

  if (!ready || !user || user.role !== "admin") return null;

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
            {items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200">
                <td className="py-3">{item.display_name}</td>
                <td className="py-3">{item.email}</td>
                <td className="py-3 uppercase tracking-[0.08em]">{item.role}</td>
                <td className="py-3 text-right">
                  {item.role === "student" ? (
                    <button
                      type="button"
                      onClick={() => setRole(item, "editor")}
                      className="uppercase tracking-[0.12em] text-[#1A4FBF]"
                    >
                      Grant editor
                    </button>
                  ) : null}
                  {item.role === "editor" ? (
                    <button
                      type="button"
                      onClick={() => setRole(item, "student")}
                      className="mr-4 uppercase tracking-[0.12em] text-[#1A4FBF]"
                    >
                      Remove editor
                    </button>
                  ) : null}
                  {item.role !== "admin" && item.id !== user.id ? (
                    <button
                      type="button"
                      onClick={() => setBanned(item, !item.banned)}
                      className="uppercase tracking-[0.12em] text-[#1A4FBF]"
                    >
                      {item.banned ? "Unban" : "Ban"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
