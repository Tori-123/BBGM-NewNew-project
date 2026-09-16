import { Link } from "react-router-dom";
import { categoryLabel, formatDateline, formatStartsAt } from "../format";

export function ImageWell({ className = "h-40" }) {
  return <div className={`bg-[#D6DEEE] ${className}`} aria-hidden="true" />;
}

export function TitleLine({ className = "h-0.5 w-3/4 bg-neutral-200" }) {
  return <div className={className} />;
}

export function ErrorBanner({ error }) {
  if (!error?.message) return null;
  return <p className="mb-4 text-sm text-red-700">{error.message}</p>;
}

export function FieldError({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-700">{message}</p>;
}

export function FrontPageLink() {
  return (
    <p className="mb-6 font-sans text-[11px] font-medium uppercase tracking-[0.16em]">
      <Link to="/" className="text-[#1A4FBF] hover:text-[#111111]">
        ← Front page
      </Link>
    </p>
  );
}

export function Kicker({ category }) {
  if (!category) return null;
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A4FBF]">
      {categoryLabel(category)}
    </p>
  );
}

export function Headline({ to, children, className = "text-[1.35rem] font-bold" }) {
  const classes = `font-serif leading-[1.12] tracking-[-0.02em] text-[#111111] ${className}`;
  if (to) {
    return (
      <h3 className={classes}>
        <Link to={to} className="hover:text-[#1A4FBF]">
          {children}
        </Link>
      </h3>
    );
  }
  return <h1 className={classes}>{children}</h1>;
}

export function Dek({ children }) {
  if (!children) return null;
  return <p className="mt-2 font-sans text-sm leading-relaxed text-neutral-800">{children}</p>;
}

export function ActivityLine({ post }) {
  if (!post?.is_activity) return null;
  return (
    <p className="mt-1 font-sans text-[13px] text-neutral-500">
      {formatStartsAt(post.starts_at)}
      {post.location ? ` · ${post.location}` : ""}
    </p>
  );
}

export function Dateline({ iso }) {
  if (!iso) return null;
  return <p className="mt-1 font-sans text-xs text-neutral-500">{formatDateline(iso)}</p>;
}

export function SectionRule({ children }) {
  return (
    <div className="mb-5 mt-10 flex items-center gap-4">
      <h2 className="font-serif text-[28px] font-bold leading-none tracking-[-0.02em]">{children}</h2>
      <div className="h-[2px] flex-1 bg-black" />
    </div>
  );
}

export function StoryTile({ post, wellClassName = "h-36", showExcerpt = true, showDate = false }) {
  if (!post) {
    return (
      <div>
        <ImageWell className={wellClassName} />
        <TitleLine className="mt-3" />
      </div>
    );
  }
  return (
    <article>
      <ImageWell className={wellClassName} />
      <div className="mt-3">
        <Kicker category={post.category} />
        <Headline to={`/posts/${post.id}`} className="mt-1 text-[1.25rem]">
          {post.title}
        </Headline>
        {showExcerpt ? <Dek>{post.excerpt}</Dek> : null}
        <ActivityLine post={post} />
        {showDate ? <Dateline iso={post.created_at} /> : null}
      </div>
    </article>
  );
}
