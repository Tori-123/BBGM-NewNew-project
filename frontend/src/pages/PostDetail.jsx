import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { uploadSrc } from "../avatar";
import { Avatar } from "../components/Avatar";
import { ErrorBanner, FieldError, FrontPageLink, Headline, ImageWell, Kicker, TitleLine } from "../components/ui";
import { formatDateline } from "../format";
import { mergeLiveFloors, useLiveRefresh } from "../live";

export default function PostDetail() {
  const { postId } = useParams();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentError, setCommentError] = useState(null);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const commentPageRef = useRef(1);
  commentPageRef.current = commentPage;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReady(false);
    setPost(null);
    setComments([]);
    setCommentError(null);
    api
      .getPost(postId)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
        setError(null);
        if (data.category === "forum") {
          return api.listComments(postId).then((thread) => {
            if (cancelled) return;
            setComments(thread.items);
            setCommentPage(thread.page);
            setCommentTotal(thread.total);
          });
        }
        return null;
      })
      .catch((err) => {
        if (cancelled) return;
        setPost(null);
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
  }, [postId]);

  const refreshThread = useCallback(async () => {
    const data = await api.getPost(postId);
    setPost(data);
    setError(null);
    if (data.category !== "forum") return;
    const pageSize = 20;
    const loadedPages = commentPageRef.current;
    let floors = [];
    let total = 0;
    for (let page = 1; page <= loadedPages; page += 1) {
      const chunk = await api.listComments(postId, { page, pageSize });
      floors = mergeLiveFloors(floors, chunk.items);
      total = chunk.total;
    }
    if (total > floors.length) {
      const extra = await api.listComments(postId, { page: loadedPages + 1, pageSize });
      floors = mergeLiveFloors(floors, extra.items);
      total = extra.total;
      setCommentPage(loadedPages + 1);
    }
    setComments(floors);
    setCommentTotal(total);
  }, [postId]);

  const notFound = error instanceof ApiError && error.code === "not_found";
  const isForum = post?.category === "forum";

  useLiveRefresh(ready && !commentSubmitting && !notFound, refreshThread);

  async function onDelete() {
    if (!post || !window.confirm("Delete this post?")) return;
    setError(null);
    try {
      await api.deletePost(postId);
      const back = post.category === "news" || post.category === "sports" ? `/${post.category}` : "/forum";
      navigate(back);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate(`/sign-in?next=/posts/${postId}`);
        return;
      }
      setError(err);
    }
  }

  async function onComment(event) {
    event.preventDefault();
    if (!user) {
      navigate(`/sign-in?next=/posts/${postId}`);
      return;
    }
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      await api.createComment(postId, {
        body: commentBody,
        parent_id: replyTo,
      });
      const thread = await api.listComments(postId, { page: 1 });
      setComments(thread.items);
      setCommentPage(thread.page);
      setCommentTotal(thread.total);
      setCommentBody("");
      setReplyTo(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate(`/sign-in?next=/posts/${postId}`);
        return;
      }
      setCommentError(err);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function loadOlderComments() {
    const next = commentPage + 1;
    try {
      const thread = await api.listComments(postId, { page: next });
      setComments((current) => [...current, ...thread.items]);
      setCommentPage(thread.page);
      setCommentTotal(thread.total);
    } catch (err) {
      setCommentError(err);
    }
  }

  return (
    <article className="mx-auto mt-10 max-w-[42rem]">
      <FrontPageLink />
      {loading ? (
        <>
          <ImageWell className="h-64" />
          <TitleLine className="mt-6 w-full" />
          <TitleLine className="mt-3 w-2/3" />
        </>
      ) : notFound ? (
        <h1 className="font-serif text-4xl">Story not found.</h1>
      ) : error ? (
        <ErrorBanner error={error} />
      ) : (
        <>
          <Kicker category={post.category} />
          <Headline className="mt-2 text-4xl sm:text-5xl">{post.title}</Headline>
          <div className="mt-3 flex items-center gap-3">
            {isForum ? <Avatar avatar={post.author?.avatar} size={48} /> : null}
            <p className="font-sans text-sm text-neutral-500">
              {post.author?.display_name}
              {post.created_at ? ` · ${formatDateline(post.created_at)}` : ""}
            </p>
          </div>
          {isForum ? (
            post.images?.length ? (
              <div className="mt-6 grid gap-3">
                {post.images.map((src) => (
                  <img
                    key={src}
                    src={uploadSrc(src)}
                    alt=""
                    className="w-full border border-black object-contain"
                  />
                ))}
              </div>
            ) : null
          ) : (
            <ImageWell className="mt-6 h-64" />
          )}
          <div className="mt-8 whitespace-pre-wrap font-sans text-[16px] leading-7 text-neutral-900">
            {post.body}
          </div>

          {user?.role === "admin" ? (
            <button
              type="button"
              onClick={onDelete}
              className="mt-8 font-sans text-[11px] uppercase tracking-[0.18em] text-red-700"
            >
              Delete
            </button>
          ) : null}

          {isForum ? (
            <section className="mt-12 border-t border-black pt-8">
              <h2 className="font-serif text-2xl">Replies</h2>
              <ErrorBanner error={commentError && !commentError.fields?.length ? commentError : null} />
              {comments.length === 0 ? (
                <p className="mt-4 font-sans text-sm text-neutral-500">No replies yet.</p>
              ) : (
                comments.map((floor) => (
                  <div key={floor.id} className="mt-6 border-t border-neutral-200 pt-4">
                    <div className="flex items-center gap-3">
                      <Avatar avatar={floor.author?.avatar} size={28} />
                      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">
                        #{floor.floor} · {floor.author?.display_name}
                      </p>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">{floor.body}</p>
                    {user ? (
                      <button
                        type="button"
                        onClick={() => setReplyTo(floor.id)}
                        className="mt-2 font-sans text-[11px] uppercase tracking-[0.14em] text-[#1A4FBF]"
                      >
                        Reply
                      </button>
                    ) : null}
                    {floor.replies?.map((item) => (
                      <div key={item.id} className="mt-3 ml-6 flex gap-2 border-l border-black pl-4">
                        <Avatar avatar={item.author?.avatar} size={22} />
                        <div>
                          <p className="font-sans text-[11px] text-neutral-500">{item.author?.display_name}</p>
                          <p className="mt-1 whitespace-pre-wrap font-sans text-sm leading-6">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
              {commentTotal > comments.length ? (
                <button
                  type="button"
                  onClick={loadOlderComments}
                  className="mt-6 font-sans text-sm uppercase tracking-[0.14em] text-[#1A4FBF]"
                >
                  Older replies
                </button>
              ) : null}

              {user ? (
                <form onSubmit={onComment} className="mt-8">
                  {replyTo ? (
                    <p className="mb-2 font-sans text-xs text-neutral-500">
                      Replying to a floor.{" "}
                      <button type="button" className="text-[#1A4FBF]" onClick={() => setReplyTo(null)}>
                        Post as a new floor
                      </button>
                    </p>
                  ) : null}
                  <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="comment-body">
                    {replyTo ? "Reply" : "New floor"}
                  </label>
                  <textarea
                    id="comment-body"
                    value={commentBody}
                    onChange={(event) => setCommentBody(event.target.value)}
                    rows={4}
                    className="mt-2 w-full border border-black p-3 font-sans text-sm outline-none"
                  />
                  <FieldError message={fieldMessage(commentError, "body")} />
                  <FieldError message={fieldMessage(commentError, "parent_id")} />
                  <button
                    type="submit"
                    disabled={commentSubmitting}
                    className="mt-4 rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
                  >
                    Post reply
                  </button>
                </form>
              ) : (
                <p className="mt-6 font-sans text-sm text-neutral-500">
                  <Link to={`/sign-in?next=/posts/${postId}`} className="text-[#1A4FBF]">
                    Sign in
                  </Link>{" "}
                  to reply.
                </p>
              )}
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
