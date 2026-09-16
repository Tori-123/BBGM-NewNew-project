import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { Avatar, AVATAR_PRESETS } from "../components/Avatar";
import { ErrorBanner, FieldError, FrontPageLink, SectionRule } from "../components/ui";

export default function AvatarSettings() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && !user) {
      navigate("/sign-in?next=/me/avatar", { replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready || !user) return null;

  async function onPreset(preset) {
    setSaving(true);
    setError(null);
    try {
      const profile = await api.setAvatarPreset(preset);
      setUser(profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate("/sign-in?next=/me/avatar");
        return;
      }
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const profile = await api.uploadAvatar(file);
      setUser(profile);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        navigate("/sign-in?next=/me/avatar");
        return;
      }
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const topMessage = error && (!error.fields || error.fields.length === 0) ? error : null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>Avatar</SectionRule>
      <ErrorBanner error={topMessage} />
      <div className="flex items-center gap-4">
        <Avatar avatar={user.avatar} size={64} />
        <div>
          <p className="font-sans text-sm">{user.display_name}</p>
          <p className="mt-1 font-sans text-xs text-neutral-500">Choose a campus mark or upload a photo.</p>
        </div>
      </div>

      <p className="mt-8 font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">Presets</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {AVATAR_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={saving}
            onClick={() => onPreset(item.id)}
            className={`border px-3 py-2 font-sans text-xs uppercase tracking-[0.12em] ${
              user.avatar === `preset:${item.id}` ? "border-black" : "border-neutral-300"
            }`}
          >
            <Avatar avatar={`preset:${item.id}`} size={40} className="mx-auto" />
            <span className="mt-2 block">{item.label}</span>
          </button>
        ))}
      </div>
      <FieldError message={fieldMessage(error, "preset")} />

      <label className="mt-8 block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="avatar-file">
        Upload
      </label>
      <input
        id="avatar-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={saving}
        onChange={onUpload}
        className="mt-2 block font-sans text-sm"
      />
      <FieldError message={fieldMessage(error, "file")} />
    </div>
  );
}
