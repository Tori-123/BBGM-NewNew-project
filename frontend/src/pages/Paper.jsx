import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FieldError, FrontPageLink, SectionRule } from "../components/ui";
import { NEWSPAPER_OPTIONS, canEditPaper } from "../format";

export default function Paper() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [promoteError, setPromoteError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/sign-in?next=/paper", { replace: true });
      return;
    }
    if (!canEditPaper(user)) {
      navigate("/", { replace: true });
    }
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user || !canEditPaper(user)) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .listPosts({ category: "forum", page: 1, pageSize: 50 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          navigate("/sign-in?next=/paper");
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

  async function choose(post) {
    setPromoteError(null);
    setSelectedId(post.id);
    setCategory("");
    try {
      const detail = await api.getPost(post.id);
      setTitle(detail.title);
      setBody(detail.body);
    } catch (err) {
      setPromoteError(err);
    }
  }

  async function onPromote(event) {
    event.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setPromoteError(null);
    try {
      const created = await api.promotePost(selectedId, { category, title, body });
      navigate(`/posts/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate("/sign-in?next=/paper");
        return;
      }
      setPromoteError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !user || !canEditPaper(user)) return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>Paper</SectionRule>
      <p className="mb-6 font-sans text-sm text-neutral-500">
        Pick a Forum post, then copy it into News or Sports.
      </p>
      <ErrorBanner error={error} />
      {loading ? (
        <p className="font-sans text-sm text-neutral-500">Loading Forum posts.</p>
      ) : items.length === 0 ? (
        <p className="font-sans text-sm text-neutral-500">No Forum posts yet.</p>
      ) : (
        <ul className="border-t border-black">
          {items.map((post) => (
            <li key={post.id} className="border-b border-neutral-200">
              <button
                type="button"
                onClick={() => choose(post)}
                className={`w-full py-3 text-left font-serif text-xl ${
                  selectedId === post.id ? "text-[#1A4FBF]" : "text-[#111111]"
                }`}
              >
                {post.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId ? (
        <form onSubmit={onPromote} className="mt-10 border-t border-black pt-8">
          <h2 className="font-serif text-2xl">Copy to the paper</h2>
          <ErrorBanner error={promoteError && !promoteError.fields?.length ? promoteError : null} />
          <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="promote-category">
            Section
          </label>
          <select
            id="promote-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
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
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full border-b border-black py-2 font-serif text-xl outline-none"
          />
          <FieldError message={fieldMessage(promoteError, "title")} />
          <label className="mt-4 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="promote-body">
            Body
          </label>
          <textarea
            id="promote-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            className="mt-2 w-full border border-black p-3 font-sans text-sm outline-none"
          />
          <FieldError message={fieldMessage(promoteError, "body")} />
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
          >
            Publish copy
          </button>
        </form>
      ) : null}
    </div>
  );
}
