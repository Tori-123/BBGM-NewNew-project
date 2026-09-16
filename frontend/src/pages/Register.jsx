import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, fieldMessage, safeNext } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FieldError, FrontPageLink, SectionRule } from "../components/ui";

export default function Register() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const profile = await api.register({
        email,
        password,
        display_name: displayName,
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

  return (
    <div className="mx-auto mt-10 max-w-md">
      <FrontPageLink />
      <SectionRule>Register</SectionRule>
      <ErrorBanner error={banner} />
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="display_name">
            Display name
          </label>
          <input
            id="display_name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full border-0 border-b border-black py-2 font-sans text-sm outline-none"
          />
          <FieldError message={fieldMessage(error, "display_name")} />
        </div>
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full border-0 border-b border-black py-2 font-sans text-sm outline-none"
          />
          <FieldError message={emailError} />
        </div>
        <div>
          <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full border-0 border-b border-black py-2 font-sans text-sm outline-none"
          />
          <FieldError message={fieldMessage(error, "password")} />
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
        <Link to={`/sign-in${params.get("next") ? `?next=${encodeURIComponent(params.get("next"))}` : ""}`} className="text-[#1A4FBF]">
          Sign in
        </Link>
      </p>
    </div>
  );
}
