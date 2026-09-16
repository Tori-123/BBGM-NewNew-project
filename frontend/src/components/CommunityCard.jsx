import { uploadSrc } from "../avatar";
import { Headline, TitleLine } from "./ui";
import { Avatar } from "./Avatar";

export function CommunityCard({ post }) {
  const replies = post.reply_preview || [];
  const count = post.reply_count ?? 0;
  return (
    <article className="border-b border-neutral-200 py-5">
      <div className="flex gap-4">
        <Avatar avatar={post.author?.avatar} size={56} />
        <div className="min-w-0 flex-1">
          <Headline to={`/posts/${post.id}`} className="text-2xl">
            {post.title}
          </Headline>
          <p className="mt-1 font-sans text-sm text-neutral-500">{post.author?.display_name}</p>
          {post.images?.[0] ? (
            <img
              src={uploadSrc(post.images[0])}
              alt=""
              className="mt-3 max-h-56 w-full border border-black object-cover"
            />
          ) : null}
          {replies.map((reply) => (
            <div key={reply.id} className="mt-3 flex gap-2">
              <Avatar avatar={reply.author?.avatar} size={24} />
              <div className="min-w-0">
                <p className="font-sans text-[12px] text-neutral-500">{reply.author?.display_name}</p>
                <p className="whitespace-pre-wrap font-sans text-sm leading-6 text-neutral-800">{reply.body}</p>
              </div>
            </div>
          ))}
          <p className="mt-3 font-sans text-[12px] text-neutral-500">
            {count} {count === 1 ? "reply" : "replies"}
          </p>
        </div>
      </div>
    </article>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="flex gap-3 border-b border-neutral-200 py-5">
      <div className="h-14 w-14 bg-[#D6DEEE]" />
      <div className="flex flex-1 flex-col justify-center gap-3">
        <TitleLine />
        <TitleLine className="w-1/3" />
      </div>
    </div>
  );
}
