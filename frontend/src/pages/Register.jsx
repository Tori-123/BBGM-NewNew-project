import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, fieldMessage, safeNext } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FieldError, FrontPageLink, ManualPasswordInput, SectionRule } from "../components/ui";

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  async function onSendCode() {
    setSendingCode(true);
    setError(null);
    try {
      await api.sendEmailCode({ email, purpose: "register" });
      setCodeSent(true);
    } catch (err) {
      setCodeSent(false);
      setError(err);
    } finally {
      setSendingCode(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const profile = await api.register({
        email,
        password,
        display_name: displayName,
        code,
      });
      signIn(profile);
      navigate(safeNext(params.get("next")));
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const emailError =
    fieldMessage(error, "email") || (error?.code === "email_taken" ? error.message : "");
  const banner = error && error.code !== "email_taken" && !error.fields?.length ? error : null;
  const nextQuery = params.get("next") ? `?next=${encodeURIComponent(params.get("next"))}` : "";

  return (
    <div className="mx-auto mt-10 max-w-md">
      <FrontPageLink />
      <SectionRule>Register</SectionRule>
      <ErrorBanner error={banner} />
      <form onSubmit={onSubmit} autoComplete="off" className="space-y-5">
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="display_name">
            Display name
          </label>
          <input
            id="display_name"
            autoComplete="off"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full border-0 border-b border-black py-2 font-sans text-sm outline-none"
          />
          <FieldError message={fieldMessage(error, "display_name")} />
        </div>
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="email">
            School email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setCodeSent(false);
            }}
            className="mt-2 w-full border-0 border-b border-black py-2 font-sans text-sm outline-none"
          />
          <FieldError message={emailError} />
        </div>
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="password">
            Password
          </label>
          <ManualPasswordInput id="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <FieldError message={fieldMessage(error, "password")} />
        </div>
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="code">
            Verification code
          </label>
          <div className="mt-2 flex items-end gap-3">
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="min-w-0 flex-1 border-0 border-b border-black py-2 font-sans text-sm outline-none"
            />
            <button
              type="button"
              disabled={sendingCode}
              onClick={onSendCode}
              className="shrink-0 border border-black px-3 py-2 font-sans text-[11px] uppercase tracking-[0.16em]"
            >
              {sendingCode ? "Sending" : "Send code"}
            </button>
          </div>
          <FieldError message={fieldMessage(error, "code")} />
          {codeSent && !fieldMessage(error, "code") && !emailError ? (
            <p className="mt-2 font-sans text-sm text-neutral-500">A code was sent to that school email.</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
        >
          Create account
        </button>
      </form>
      <p className="mt-6 font-sans text-sm text-neutral-500">
        Already have an account?{" "}
        <Link to={`/sign-in${nextQuery}`} className="text-[#1A4FBF]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
