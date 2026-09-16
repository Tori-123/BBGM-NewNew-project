import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth";
import { StoryRow, StoryRowSkeleton } from "../components/StoryRow";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { canEditPaper } from "../format";

export default function MyPosts() {
  const { user, ready, setUser } = useAuth();
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

  useEffect(() => {
    if (!ready || !user) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .myPosts({ page: 1, pageSize: 20 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      })
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
  }, [ready, user, navigate, setUser]);

  if (!ready || !user) return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>My Posts</SectionRule>
      <ErrorBanner error={error} />
      {loading ? (
        <>
          <StoryRowSkeleton />
          <StoryRowSkeleton />
        </>
      ) : total === 0 ? (
        <div className="mt-6">
          <p className="font-serif text-2xl">You have not published yet.</p>
          <p className="mt-2 font-sans text-sm">
            {canEditPaper(user) ? (
              <span className="text-neutral-500">Publish from the section you want to update.</span>
            ) : (
              <Link to="/community" className="text-[#1A4FBF]">
                Write in Community
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
