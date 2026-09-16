import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { canEditPaper, categoryLabel } from "../format";
import { ActivityLine, Dek, Headline, ImageWell, Kicker, SectionRule, StoryTile, TitleLine } from "./ui";

const PLACEHOLDER = {
  featured: {
    kicker: "FEATURED",
    title: "The biggest story on campus goes here",
  },
  secondary: {
    kicker: "NEWS",
    title: "Secondary campus story with a strong image",
  },
  dorm: {
    kicker: "DORM LIFE",
    title: "A smaller story with a different rhythm",
  },
  sports: {
    kicker: "SPORTS",
    title: "Sports headline with a wider text treatment",
    dek: "A short summary can appear here when the story needs more context.",
  },
};

function slot(items, index) {
  return items[index] ?? null;
}

function SlotKicker({ post, fallback }) {
  if (post?.category) return <Kicker category={post.category} />;
  return (
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A4FBF]">
      {fallback}
    </p>
  );
}

function SlotTitle({ post, fallback, className }) {
  if (post) {
    return (
      <Headline to={`/posts/${post.id}`} className={className}>
        {post.title}
      </Headline>
    );
  }
  return <h2 className={`font-serif font-bold leading-[1.12] tracking-[-0.02em] text-[#111111] ${className}`}>{fallback}</h2>;
}

function Hero({ items, loading }) {
  const featured = loading ? null : slot(items, 0);
  const secondary = loading ? null : slot(items, 1);
  const dorm = loading ? null : slot(items, 2);
  const sports = loading ? null : slot(items, 3);

  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-5 pt-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <ImageWell className="h-full min-h-[320px] w-full" />
      </div>

      <div className="lg:col-span-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <article>
            <ImageWell className="aspect-square w-full" />
            <div className="mt-3 border-b border-neutral-200 pb-4">
              <SlotKicker post={secondary} fallback={PLACEHOLDER.secondary.kicker} />
              <SlotTitle
                post={secondary}
                fallback={PLACEHOLDER.secondary.title}
                className="mt-1 text-[21px] font-semibold"
              />
            </div>
          </article>
          <article>
            <ImageWell className="aspect-square w-full" />
            <div className="mt-3 border-b border-neutral-200 pb-4">
              <SlotKicker post={dorm} fallback={PLACEHOLDER.dorm.kicker} />
              <SlotTitle post={dorm} fallback={PLACEHOLDER.dorm.title} className="mt-1 text-[21px] font-semibold" />
            </div>
          </article>
        </div>
      </div>

      <div className="lg:col-span-7 lg:pr-6">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1A4FBF]">
          {PLACEHOLDER.featured.kicker}
        </p>
        <SlotTitle
          post={featured}
          fallback={PLACEHOLDER.featured.title}
          className="mt-1 text-[40px] font-bold sm:text-[44px]"
        />
        {featured?.excerpt ? <Dek>{featured.excerpt}</Dek> : null}
        <ActivityLine post={featured} />
      </div>

      <div className="grid grid-cols-[minmax(120px,0.85fr)_1.15fr] gap-4 lg:col-span-5">
        <ImageWell className="h-[110px] w-full" />
        <article>
          <SlotKicker post={sports} fallback={PLACEHOLDER.sports.kicker} />
          <SlotTitle post={sports} fallback={PLACEHOLDER.sports.title} className="mt-1 text-[22px] font-semibold" />
          {sports?.excerpt ? (
            <p className="mt-2 font-sans text-[13px] font-normal leading-relaxed text-neutral-600">{sports.excerpt}</p>
          ) : (
            <p className="mt-2 font-sans text-[13px] font-normal leading-relaxed text-neutral-600">
              {PLACEHOLDER.sports.dek}
            </p>
          )}
          <ActivityLine post={sports} />
        </article>
      </div>
    </div>
  );
}

function EmptyFeatured({ user }) {
  if (!user) return null;
  return (
    <div className="mt-6">
      {canEditPaper(user) ? (
        <p className="font-sans text-sm text-neutral-500">Publish from the section you want to update.</p>
      ) : (
        <p className="font-sans text-sm">
          <Link to="/community" className="text-[#1A4FBF]">
            Write in Community
          </Link>
        </p>
      )}
    </div>
  );
}

function StaticRail({ kicker, title, note, wellClassName = "h-28" }) {
  return (
    <section>
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A4FBF]">{kicker}</h2>
      <ImageWell className={`mt-2 ${wellClassName}`} />
      <p className="mt-2 font-serif text-lg font-semibold leading-snug">{title}</p>
      <p className="mt-1 font-sans text-sm font-normal text-neutral-500">{note}</p>
    </section>
  );
}

export default function HomeGrid({ items, total, loading }) {
  const { user } = useAuth();
  const upcoming = items.filter((item) => item.is_activity).slice(0, 3);
  const emptyCampus = !loading && total === 0;

  return (
    <div>
      <Hero items={items} loading={loading} />
      {emptyCampus ? <EmptyFeatured user={user} /> : null}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SectionRule>LATEST</SectionRule>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-7">
              <StoryTile post={loading ? null : slot(items, 4)} wellClassName="h-56" />
            </div>
            <div className="flex flex-col gap-5 md:col-span-5">
              {[5, 6, 7].map((index) => (
                <StoryTile key={index} post={loading ? null : slot(items, index)} wellClassName="h-24" />
              ))}
            </div>
          </div>

          <SectionRule>FEATURES</SectionRule>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="flex flex-col gap-5 md:col-span-5">
              {[8, 9, 10].map((index) => {
                const post = loading ? null : slot(items, index);
                return post ? (
                  <article key={post.id} className="border-b border-neutral-200 pb-4">
                    <Kicker category={post.category} />
                    <Headline to={`/posts/${post.id}`} className="mt-1 text-xl font-semibold">
                      {post.title}
                    </Headline>
                    <Dek>{post.excerpt}</Dek>
                  </article>
                ) : (
                  <div key={index}>
                    <TitleLine />
                    <TitleLine className="mt-2 w-1/2" />
                  </div>
                );
              })}
            </div>
            <div className="md:col-span-7">
              <StoryTile post={loading ? null : slot(items, 11)} wellClassName="h-56" showDate />
            </div>
          </div>

          <SectionRule>CAMPUS LIFE</SectionRule>
          <div className="grid gap-6 md:grid-cols-3">
            {[12, 13, 14].map((index) => (
              <StoryTile
                key={index}
                post={loading ? null : slot(items, index)}
                wellClassName="h-36"
                showDate
              />
            ))}
          </div>

          <SectionRule>Special Feature</SectionRule>
          <StoryTile post={loading ? null : slot(items, 15)} wellClassName="h-64" showDate />
        </div>

        <aside className="flex flex-col gap-8 lg:col-span-4">
          <StaticRail
            kicker="Photo of the Day"
            title="From the quad"
            note="Student photo submissions open in a later version."
          />
          <StaticRail
            kicker="Track of the Day"
            title="No playlist today"
            note="A campus track will live here later. No Spotify embed in this version."
            wellClassName="h-16"
          />
          <section>
            <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A4FBF]">
              Upcoming
            </h2>
            {loading ? (
              <div className="mt-3 space-y-3">
                <TitleLine />
                <TitleLine className="w-1/2" />
              </div>
            ) : upcoming.length === 0 ? (
              <p className="mt-3 font-serif text-lg font-semibold">No upcoming events posted.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {upcoming.map((post) => (
                  <li key={post.id}>
                    <Headline to={`/posts/${post.id}`} className="text-lg font-semibold">
                      {post.title}
                    </Headline>
                    <ActivityLine post={post} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <StaticRail
            kicker="Student Art"
            title="Open wall"
            note="Art submissions are a later version. This frame stays empty on purpose."
          />
        </aside>
      </div>
    </div>
  );
}
