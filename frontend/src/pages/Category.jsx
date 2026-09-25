import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { CommunityCard, CommunityCardSkeleton } from "../components/CommunityCard";
import ComposeForm from "../components/ComposeForm";
import { EmptyCategory, StoryRow, StoryRowSkeleton } from "../components/StoryRow";
import { ErrorBanner, FrontPageLink, SectionRule } from "../components/ui";
import { canEditPaper } from "../format";
import { mergeLivePosts, useLiveRefresh } from "../live";

function ComposeFab({ to, onClick }) {
  const className =
    "fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A4FBF] text-[2rem] leading-none text-white";
  if (to) {
    return (
      <Link to={to} className={className} aria-label="Write a post">
        +
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label="Write a post">
      +
    </button>
  );
}

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
  const [ready, setReady] = useState(false);

  const isForum = category === "forum";
  const canWrite = isForum ? Boolean(user) : canEditPaper(user);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReady(false);
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
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const refreshList = useCallback(
    () =>
      api.listPosts({ category, page: 1, pageSize }).then((data) => {
        setItems((current) => mergeLivePosts(current, data.items));
        setPageSize(data.page_size);
        setTotal(data.total);
        setError(null);
      }),
    [category, pageSize],
  );

  useLiveRefresh(ready, refreshList);

  useEffect(() => {
    if (!writing) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setWriting(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [writing]);

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
      {canWrite && !isForum ? (
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
      ) : null}
      <ErrorBanner error={error} />
      {loading ? (
        isForum ? (
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
            isForum ? (
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
      {isForum && !writing ? (
        user ? (
          <ComposeFab onClick={() => setWriting(true)} />
        ) : (
          <ComposeFab to="/sign-in?next=/forum" />
        )
      ) : null}
      {isForum && writing ? (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close compose"
            onClick={() => setWriting(false)}
          />
          <div className="relative z-10 w-full max-w-2xl bg-white p-8">
            <ComposeForm category={category} onPublished={onPublished} onCancel={() => setWriting(false)} />
          </div>
        </div>
      ) : null}
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
