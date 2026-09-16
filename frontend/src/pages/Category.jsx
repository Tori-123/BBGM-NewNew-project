import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CommunityCard, CommunityCardSkeleton } from "../components/CommunityCard";
import ComposeForm from "../components/ComposeForm";
import { EmptyCategory, StoryRow, StoryRowSkeleton } from "../components/StoryRow";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { canEditPaper } from "../format";

export default function Category({ category, title }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [writing, setWriting] = useState(false);

  const isCommunity = category === "community";
  const canWrite = isCommunity ? Boolean(user) : canEditPaper(user);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setWriting(false);
    api
      .listPosts({ category, page: 1, pageSize: 20 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setPage(data.page);
        setPageSize(data.page_size);
        setTotal(data.total);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  function loadOlder() {
    const next = page + 1;
    setLoadingMore(true);
    api
      .listPosts({ category, page: next, pageSize })
      .then((data) => {
        setItems((current) => [...current, ...data.items]);
        setPage(data.page);
        setPageSize(data.page_size);
        setTotal(data.total);
        setError(null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoadingMore(false));
  }

  function onPublished(post) {
    setItems((current) => [post, ...current.filter((item) => item.id !== post.id)]);
    setTotal((current) => current + 1);
    setWriting(false);
  }

  const hasOlder = total > page * pageSize;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>{title}</SectionRule>
      {canWrite ? (
        writing ? (
          <ComposeForm category={category} onPublished={onPublished} />
        ) : (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="mb-6 font-sans text-[11px] uppercase tracking-[0.18em] text-[#1A4FBF]"
          >
            Write
          </button>
        )
      ) : isCommunity && !user ? (
        <p className="mb-6 font-sans text-sm text-neutral-500">
          <Link to="/sign-in?next=/community" className="text-[#1A4FBF]">
            Sign in to post
          </Link>
        </p>
      ) : null}
      <ErrorBanner error={error} />
      {loading ? (
        isCommunity ? (
          <>
            <CommunityCardSkeleton />
            <CommunityCardSkeleton />
            <CommunityCardSkeleton />
          </>
        ) : (
          <>
            <StoryRowSkeleton />
            <StoryRowSkeleton />
            <StoryRowSkeleton />
          </>
        )
      ) : items.length === 0 ? (
        <EmptyCategory name={title} />
      ) : (
        <>
          {items.map((post) =>
            isCommunity ? (
              <CommunityCard key={post.id} post={post} />
            ) : (
              <StoryRow key={post.id} post={post} />
            ),
          )}
          {hasOlder ? (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingMore}
              className="mt-6 font-sans text-sm uppercase tracking-[0.14em] text-[#1A4FBF]"
            >
              Older stories
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

export function StaticCategory({ title }) {
  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>{title}</SectionRule>
      <EmptyCategory name={title} />
    </div>
  );
}
