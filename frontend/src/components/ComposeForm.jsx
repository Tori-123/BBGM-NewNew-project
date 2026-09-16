import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "./Avatar";
import { ErrorBanner, FieldError } from "./ui";
import { toUtcZ } from "../format";

export default function ComposeForm({ category, onPublished }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCommunity = category === "community";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isActivity, setIsActivity] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [place, setPlace] = useState("");
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onPublish(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const activity = !isCommunity && isActivity;
    const payload = {
      title,
      body,
      category,
      is_activity: activity,
      starts_at: activity ? toUtcZ(startsAt) : null,
      location: activity ? place : null,
    };
    try {
      let created = await api.createPost(payload);
      if (isCommunity && images.length) {
        for (const file of images.slice(0, 4)) {
          created = await api.uploadPostImage(created.id, file);
        }
      }
      onPublished(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate(`/sign-in?next=${location.pathname}`);
        return;
      }
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function onActivityChange(checked) {
    setIsActivity(checked);
    if (!checked) {
      setStartsAt("");
      setPlace("");
    }
  }

  const topMessage = error && (!error.fields || error.fields.length === 0) ? error : null;

  return (
    <form onSubmit={onPublish} className="mb-8 border-b border-black pb-8">
      <div className="mb-4 flex items-center gap-3">
        <Avatar avatar={user.avatar} size={40} />
        <div>
          <p className="font-sans text-sm">{user.display_name}</p>
          <p className="mt-1 font-sans text-xs text-neutral-500">
            <Link to="/me/avatar" className="text-[#1A4FBF]">
              Change avatar
            </Link>
          </p>
        </div>
      </div>
      <ErrorBanner error={topMessage} />
      <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="compose-title">
        Title
      </label>
      <input
        id="compose-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="mt-2 w-full border-0 border-b border-black bg-transparent py-2 font-serif text-3xl outline-none"
      />
      <FieldError message={fieldMessage(error, "title")} />

      <label className="mt-6 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="compose-body">
        Body
      </label>
      <textarea
        id="compose-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={10}
        className="mt-2 w-full border border-black p-3 font-sans text-[15px] leading-7 outline-none"
      />
      <FieldError message={fieldMessage(error, "body")} />

      {!isCommunity ? (
        <>
          <label className="mt-6 flex items-center gap-2 font-sans text-sm">
            <input
              type="checkbox"
              checked={isActivity}
              onChange={(event) => onActivityChange(event.target.checked)}
            />
            This post is an activity
          </label>
          {isActivity ? (
            <>
              <label className="mt-6 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="compose-starts-at">
                Starts at
              </label>
              <input
                id="compose-starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-2 w-full border border-black px-2 py-2 font-sans text-sm outline-none"
              />
              <FieldError message={fieldMessage(error, "starts_at")} />
              <label className="mt-6 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="compose-location">
                Location
              </label>
              <input
                id="compose-location"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                className="mt-2 w-full border-b border-black py-2 font-sans text-sm outline-none"
              />
              <FieldError message={fieldMessage(error, "location")} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <label className="mt-6 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="compose-images">
            Photos
          </label>
          <input
            id="compose-images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => setImages(Array.from(event.target.files || []).slice(0, 4))}
            className="mt-2 block font-sans text-sm"
          />
          <p className="mt-1 font-sans text-xs text-neutral-500">Up to 4 jpeg, png, or webp files, 2MB each.</p>
          {images.length ? (
            <p className="mt-1 font-sans text-xs text-neutral-500">{images.length} selected.</p>
          ) : null}
          <FieldError message={fieldMessage(error, "file")} />
        </>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
      >
        Publish
      </button>
    </form>
  );
}
