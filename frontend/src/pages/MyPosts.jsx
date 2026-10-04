import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { StoryRow, StoryRowSkeleton } from "../components/StoryRow";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { canEditNews } from "../format";
import { useI18n } from "../i18n";
import { useLiveRefresh } from "../live";

export default function MyPosts() {
  const { user, ready, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ready && !user) {
      navigate("/sign-in?next=/me/posts", { replace: true });
    }
  }, [ready, user, navigate]);

  const refreshMine = useCallback(async () => {
    const data = await api.myPosts({ page: 1, pageSize: 20 });
    setItems(data.items);
    setTotal(data.total);
    setError(null);
  }, []);

  useEffect(() => {
    if (!ready || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    refreshMine()
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          navigate("/sign-in?next=/me/posts");
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
  }, [ready, user, navigate, setUser, refreshMine]);

  useLiveRefresh(Boolean(ready && user) && !loading, refreshMine);

  if (!ready || !user) return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>{t("mine.title")}</SectionRule>
      <ErrorBanner error={error} />
      {loading ? (
        <>
          <StoryRowSkeleton />
          <StoryRowSkeleton />
        </>
      ) : total === 0 ? (
        <div className="mt-6">
          <p className="font-serif text-2xl">{t("mine.empty")}</p>
          <p className="mt-2 font-sans text-sm">
            {canEditNews(user) ? (
              <Link to="/news/drafts" className="text-[#1A4FBF]">
                {t("home.editDrafts")}
              </Link>
            ) : (
              <Link to="/forum" className="text-[#1A4FBF]">
                {t("home.writeForum")}
              </Link>
            )}
          </p>
        </div>
      ) : (
        items.map((post) => <StoryRow key={post.id} post={post} />)
      )}
    </div>
  );
}
