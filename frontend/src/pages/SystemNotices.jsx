import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { formatDateline } from "../format";
import { useLiveRefresh } from "../live";

export default function SystemNotices() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/sign-in?next=/system", { replace: true });
    }
  }, [ready, user, navigate]);

  const refreshNotices = useCallback(async () => {
    const data = await api.notices();
    setItems(data.items);
    setError(null);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    setLoading(true);
    refreshNotices()
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          navigate("/sign-in?next=/system");
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
  }, [user, navigate, setUser, refreshNotices]);

  useLiveRefresh(Boolean(user) && !loading, refreshNotices);

  if (!ready || !user) return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>System</SectionRule>
      <ErrorBanner error={error} />
      {loading ? (
        <p className="font-sans text-sm text-neutral-500">Loading messages.</p>
      ) : items.length === 0 ? (
        <p className="mt-6 font-serif text-2xl">No messages.</p>
      ) : (
        <ul className="mt-6 border-t border-black">
          {items.map((item) => (
            <li key={item.id} className="border-b border-neutral-200 py-4">
              <p className="font-sans text-[16px] leading-7">{item.body}</p>
              <p className="mt-1 font-sans text-sm text-neutral-500">{formatDateline(item.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
