import { Link } from "react-router-dom";
import { Dateline, Dek, Headline, ImageWell, Kicker, TitleLine } from "./ui";

export function StoryRow({ post }) {
  return (
    <article className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-neutral-200 py-5 md:grid-cols-[10rem_1fr]">
      <ImageWell className="h-24 md:h-28" />
      <div>
        <Kicker category={post.category} />
        <Headline to={`/posts/${post.id}`} className="mt-1 text-2xl">
          {post.title}
        </Headline>
        <Dek>{post.excerpt}</Dek>
        <Dateline iso={post.created_at} />
      </div>
    </article>
  );
}

export function StoryRowSkeleton() {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-4 py-5 md:grid-cols-[10rem_1fr]">
      <ImageWell className="h-24 md:h-28" />
      <div className="flex flex-col justify-center gap-3">
        <TitleLine />
        <TitleLine className="w-1/2" />
      </div>
    </div>
  );
}

export function EmptyCategory({ name }) {
  return (
    <div className="mt-6">
      <ImageWell className="h-40 max-w-md" />
      <p className="mt-4 font-serif text-2xl">No stories in {name} yet.</p>
      <p className="mt-2 font-sans text-sm">
        <Link to="/" className="text-[#1A4FBF]">
          Back to the front page
        </Link>
      </p>
    </div>
  );
}
