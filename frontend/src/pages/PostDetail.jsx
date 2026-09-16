import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { uploadSrc } from "../avatar";
import { Avatar } from "../components/Avatar";
import { ActivityLine, ErrorBanner, FieldError, FrontPageLink, Headline, ImageWell, Kicker, TitleLine } from "../components/ui";
import { NEWSPAPER_OPTIONS, canEditPaper, formatDateline } from "../format";

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
  const [promoteTitle, setPromoteTitle] = useState("");
  const [promoteBody, setPromoteBody] = useState("");
  const [promoteCategory, setPromoteCategory] = useState("");
  const [promoteError, setPromoteError] = useState(null);
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPost(null);
    setComments([]);
    setCommentError(null);
    api
      .getPost(postId)
      .then((data) => {
        if (cancelled) return;
        setPost(data);
        setError(null);
        setPromoteTitle(data.title);
        setPromoteBody(data.body);
        if (data.category === "community") {
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const notFound = error instanceof ApiError && error.code === "not_found";
  const isCommunity = post?.category === "community";
  const staff = canEditPaper(user);

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

  async function onPromote(event) {
    event.preventDefault();
    setPromoteSubmitting(true);
    setPromoteError(null);
    try {
      const created = await api.promotePost(postId, {
        category: promoteCategory,
        title: promoteTitle,
        body: promoteBody,
        is_activity: false,
      });
      navigate(`/posts/${created.id}`);
    } catch (err) {
      setPromoteError(err);
    } finally {
      setPromoteSubmitting(false);
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
            {isCommunity ? <Avatar avatar={post.author?.avatar} size={48} /> : null}
            <p className="font-sans text-sm text-neutral-500">
              {post.author?.display_name}
              {post.created_at ? ` · ${formatDateline(post.created_at)}` : ""}
            </p>
          </div>
          <ActivityLine post={post} />
          {isCommunity ? (
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

          {isCommunity && staff ? (
            <form onSubmit={onPromote} className="mt-12 border-t border-black pt-8">
              <h2 className="font-serif text-2xl">Copy to the paper</h2>
              <ErrorBanner error={promoteError && !promoteError.fields?.length ? promoteError : null} />
              <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="promote-category">
                Section
              </label>
              <select
                id="promote-category"
                value={promoteCategory}
                onChange={(event) => setPromoteCategory(event.target.value)}
                className="mt-2 w-full border border-black bg-white px-2 py-2 font-sans text-sm outline-none"
              >
                <option value="">Select a section</option>
                {NEWSPAPER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldMessage(promoteError, "category")} />
              <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="promote-title">
                Title
              </label>
              <input
                id="promote-title"
                value={promoteTitle}
                onChange={(event) => setPromoteTitle(event.target.value)}
                className="mt-2 w-full border-b border-black py-2 font-serif text-xl outline-none"
              />
              <FieldError message={fieldMessage(promoteError, "title")} />
              <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="promote-body">
                Body
              </label>
              <textarea
                id="promote-body"
                value={promoteBody}
                onChange={(event) => setPromoteBody(event.target.value)}
                rows={8}
                className="mt-2 w-full border border-black p-3 font-sans text-sm outline-none"
              />
              <FieldError message={fieldMessage(promoteError, "body")} />
              <button
                type="submit"
                disabled={promoteSubmitting}
                className="mt-6 rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
              >
                Publish copy
              </button>
            </form>
          ) : null}

          {isCommunity ? (
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
