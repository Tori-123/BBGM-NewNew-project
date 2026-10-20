import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { Avatar, AVATAR_PRESETS } from "../components/Avatar";
import { ButtonSpinner, ErrorBanner, FieldError, FrontPageLink, SectionRule } from "../components/ui";
import { useI18n } from "../i18n";

export default function AvatarSettings() {
  const { user, ready, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState("");

  useEffect(() => {
    if (ready && !user) {
      navigate("/sign-in?next=/me/avatar", { replace: true });
    }
  }, [ready, user, navigate]);

  if (!ready || !user) return null;

  const saving = Boolean(pending);

  async function onPreset(preset) {
    setPending(preset);
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
      setPending("");
    }
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPending("upload");
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
      setPending("");
    }
  }

  const topMessage = error && (!error.fields || error.fields.length === 0) ? error : null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>{t("avatar.title")}</SectionRule>
      <ErrorBanner error={topMessage} />
      <div className="flex items-center gap-4">
        <Avatar avatar={user.avatar} size={64} />
        <div>
          <p className="font-sans text-sm">{user.display_name}</p>
          <p className="mt-1 font-sans text-xs text-neutral-500">{t("avatar.hint")}</p>
        </div>
      </div>

      <DisplayNameForm user={user} setUser={setUser} navigate={navigate} />

      <p className="mt-8 font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("avatar.presets")}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {AVATAR_PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={saving}
            onClick={() => onPreset(item.id)}
            className={`inline-flex flex-col items-center border px-3 py-2 font-sans text-xs uppercase tracking-[0.12em] disabled:opacity-40 ${
              user.avatar === `preset:${item.id}` ? "border-black" : "border-neutral-300"
            }`}
          >
            <Avatar avatar={`preset:${item.id}`} size={40} className="mx-auto" />
            <span className="mt-2 inline-flex items-center gap-1">
              {pending === item.id ? <ButtonSpinner /> : null}
              {t(`avatar.${item.id}`)}
            </span>
          </button>
        ))}
      </div>
      <FieldError message={fieldMessage(error, "preset")} />

      <label className="mt-8 inline-flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="avatar-file">
        {pending === "upload" ? <ButtonSpinner /> : null}
        {t("avatar.upload")}
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

function sameUtcMonth(iso) {
  if (!iso) return false;
  const then = new Date(iso);
  const now = new Date();
  return (
    then.getUTCFullYear() === now.getUTCFullYear() &&
    then.getUTCMonth() === now.getUTCMonth()
  );
}

function nextMonthLabel(iso) {
  const then = new Date(iso);
  const next = new Date(Date.UTC(then.getUTCFullYear(), then.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

function DisplayNameForm({ user, setUser, navigate }) {
  const { t } = useI18n();
  const [name, setName] = useState(user.display_name);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const locked = sameUtcMonth(user.display_name_changed_at);

  useEffect(() => {
    setName(user.display_name);
  }, [user.display_name]);

  async function onSubmit(event) {
    event.preventDefault();
    if (locked || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const profile = await api.changeDisplayName(name.trim());
      setUser(profile);
      setSaved(true);
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

  const banner = error && !error.fields?.length ? error : null;

  return (
    <form onSubmit={onSubmit} autoComplete="off" className="mt-8 border-t border-neutral-200 pt-6">
      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">{t("name.title")}</p>
      <p className="mt-2 font-sans text-xs text-neutral-500">{t("name.hint")}</p>
      <ErrorBanner error={banner} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label
            className="block font-sans text-[13px] uppercase tracking-[0.16em] text-[#1A4FBF]"
            htmlFor="display_name"
          >
            {t("name.label")}
          </label>
          <input
            id="display_name"
            type="text"
            maxLength={40}
            value={name}
            disabled={locked || saving}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-64 border border-neutral-400 px-3 py-2 font-sans text-sm disabled:bg-neutral-100 disabled:opacity-60"
          />
          <FieldError message={fieldMessage(error, "display_name")} />
        </div>
        <button
          type="submit"
          disabled={locked || saving || !name.trim() || name.trim() === user.display_name}
          className="inline-flex items-center gap-2 rounded-[2px] bg-black px-6 py-2.5 font-sans text-[13px] uppercase tracking-[0.16em] text-white disabled:opacity-40"
        >
          {saving ? <ButtonSpinner /> : null}
          {t("name.submit")}
        </button>
      </div>
      {saved ? <p className="mt-2 font-sans text-xs text-[#1A4FBF]">{t("name.updated")}</p> : null}
      {locked ? (
        <p className="mt-2 font-sans text-xs text-neutral-500">
          {t("name.locked", { date: nextMonthLabel(user.display_name_changed_at) })}
        </p>
      ) : null}
    </form>
  );
}
