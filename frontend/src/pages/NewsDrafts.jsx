import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api, fieldMessage } from "../api";
import { useAuth } from "../auth";
import { ErrorBanner, FieldError, FrontPageLink, SectionRule } from "../components/ui";
import { canEditNews } from "../format";
import { useLiveRefresh } from "../live";

const FALLBACK = {
  0: { kicker: "FEATURED", title: "The biggest story goes here" },
  1: { kicker: "NEWS", title: "Secondary story with a strong image" },
  2: { kicker: "NEWS", title: "A smaller story with a different rhythm" },
  3: {
    kicker: "NEWS",
    title: "Another story with a wider text treatment",
    dek: "A short summary can appear here when the story needs more context.",
  },
};

function fallback(index) {
  return FALLBACK[index] || { kicker: "NEWS", title: "An open slot on the front page" };
}

function blockTone(block) {
  if (!block) return "empty";
  const matchesLive =
    block.review_status === "published" &&
    block.heading === (block.published_heading || "") &&
    block.draft_body === (block.published_body || "");
  return matchesLive ? "live" : "review";
}

function toneClass(tone) {
  if (tone === "empty") return "bg-[#A67C52] text-[#111111]";
  if (tone === "review") return "bg-[#1A4FBF] text-white";
  return "bg-white text-[#111111]";
}

function wellClass(tone) {
  if (tone === "empty") return "bg-[#A67C52]";
  if (tone === "review") return "bg-[#1A4FBF]";
  return "bg-[#D6DEEE]";
}

function kickerClass(tone) {
  if (tone === "review") return "text-white";
  if (tone === "empty") return "text-[#111111]";
  return "text-[#1A4FBF]";
}

function dekClass(tone) {
  if (tone === "review") return "text-white/90";
  if (tone === "empty") return "text-[#111111]";
  return "text-neutral-600";
}

function excerpt(block, tone) {
  if (!block) return "";
  const source = tone === "live" ? block.published_body || block.draft_body : block.draft_body;
  const text = (source || "").trim();
  if (text.length > 160) return `${text.slice(0, 157)}...`;
  return text;
}

function SlotButton({ index, block, selected, onSelect, children, className = "" }) {
  const tone = blockTone(block);
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      aria-label={block ? `Edit ${block.heading}` : `Edit empty slot ${index + 1}`}
      className={`block w-full p-3 text-left ${toneClass(tone)} ${
        selected ? "outline outline-2 outline-offset-2 outline-black" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

function SlotCopy({ index, block, titleClass }) {
  const tone = blockTone(block);
  const place = fallback(index);
  const title = block ? (tone === "live" ? block.published_heading || block.heading : block.heading) : place.title;
  const dek = block ? excerpt(block, tone) : place.dek;
  return (
    <>
      <p className={`font-sans text-[11px] font-semibold uppercase tracking-[0.16em] ${kickerClass(tone)}`}>
        {place.kicker}
      </p>
      <p className={`mt-1 font-serif font-semibold leading-[1.12] tracking-[-0.02em] ${titleClass}`}>{title}</p>
      {dek ? <p className={`mt-2 font-sans text-[13px] font-normal leading-relaxed ${dekClass(tone)}`}>{dek}</p> : null}
    </>
  );
}

function Well({ tone, className }) {
  return <div className={`${wellClass(tone)} ${className}`} aria-hidden="true" />;
}

function StaticRail({ kicker, title, note, wellClassName = "h-28" }) {
  return (
    <section>
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1A4FBF]">{kicker}</h2>
      <div className={`mt-2 bg-[#D6DEEE] ${wellClassName}`} aria-hidden="true" />
      <p className="mt-2 font-serif text-lg font-semibold leading-snug">{title}</p>
      <p className="mt-1 font-sans text-sm font-normal text-neutral-500">{note}</p>
    </section>
  );
}

function DraftBoard({ draft, isSuper, error, onSave, onSubmit, onApprove, onReject }) {
  const [active, setActive] = useState(null);
  const blocks = Object.fromEntries(draft.blocks.map((block) => [block.position, block]));
  const activeBlock = active == null ? null : blocks[active + 1] || null;

  return (
    <div className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-3xl">{draft.title}</h2>
        {draft.status === "published" ? (
          <Link to={`/posts/${draft.id}`} className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">
            View live
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-5 pt-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <button
            type="button"
            onClick={() => setActive(0)}
            aria-label={blocks[1] ? `Edit ${blocks[1].heading}` : "Edit empty slot 1"}
            className={`block w-full ${active === 0 ? "outline outline-2 outline-offset-2 outline-black" : ""}`}
          >
            <Well tone={blockTone(blocks[1])} className="h-full min-h-[320px] w-full" />
          </button>
        </div>
        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[1, 2].map((index) => (
              <SlotButton key={index} index={index} block={blocks[index + 1]} selected={active === index} onSelect={setActive}>
                <Well tone={blockTone(blocks[index + 1])} className="aspect-square w-full" />
                <div className="mt-3">
                  <SlotCopy index={index} block={blocks[index + 1]} titleClass="text-[21px]" />
                </div>
              </SlotButton>
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 lg:pr-6">
          <SlotButton index={0} block={blocks[1]} selected={active === 0} onSelect={setActive}>
            <SlotCopy index={0} block={blocks[1]} titleClass="text-[40px] font-bold sm:text-[44px]" />
          </SlotButton>
        </div>
        <div className="lg:col-span-5">
          <SlotButton index={3} block={blocks[4]} selected={active === 3} onSelect={setActive}>
            <div className="grid grid-cols-[minmax(120px,0.85fr)_1.15fr] gap-4">
              <Well tone={blockTone(blocks[4])} className="h-[110px] w-full" />
              <SlotCopy index={3} block={blocks[4]} titleClass="text-[22px]" />
            </div>
          </SlotButton>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SectionRule>LATEST</SectionRule>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-7">
              <SlotButton index={4} block={blocks[5]} selected={active === 4} onSelect={setActive}>
                <Well tone={blockTone(blocks[5])} className="h-56 w-full" />
                <div className="mt-3">
                  <SlotCopy index={4} block={blocks[5]} titleClass="text-[1.25rem]" />
                </div>
              </SlotButton>
            </div>
            <div className="flex flex-col gap-5 md:col-span-5">
              {[5, 6, 7].map((index) => (
                <SlotButton key={index} index={index} block={blocks[index + 1]} selected={active === index} onSelect={setActive}>
                  <Well tone={blockTone(blocks[index + 1])} className="h-24 w-full" />
                  <div className="mt-3">
                    <SlotCopy index={index} block={blocks[index + 1]} titleClass="text-[1.25rem]" />
                  </div>
                </SlotButton>
              ))}
            </div>
          </div>

          <SectionRule>FEATURES</SectionRule>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="flex flex-col gap-5 md:col-span-5">
              {[8, 9, 10].map((index) => (
                <SlotButton key={index} index={index} block={blocks[index + 1]} selected={active === index} onSelect={setActive}>
                  <SlotCopy index={index} block={blocks[index + 1]} titleClass="text-xl" />
                </SlotButton>
              ))}
            </div>
            <div className="md:col-span-7">
              <SlotButton index={11} block={blocks[12]} selected={active === 11} onSelect={setActive}>
                <Well tone={blockTone(blocks[12])} className="h-56 w-full" />
                <div className="mt-3">
                  <SlotCopy index={11} block={blocks[12]} titleClass="text-[1.25rem]" />
                </div>
              </SlotButton>
            </div>
          </div>

          <SectionRule>MORE STORIES</SectionRule>
          <div className="grid gap-6 md:grid-cols-3">
            {[12, 13, 14].map((index) => (
              <SlotButton key={index} index={index} block={blocks[index + 1]} selected={active === index} onSelect={setActive}>
                <Well tone={blockTone(blocks[index + 1])} className="h-36 w-full" />
                <div className="mt-3">
                  <SlotCopy index={index} block={blocks[index + 1]} titleClass="text-[1.25rem]" />
                </div>
              </SlotButton>
            ))}
          </div>

          <SectionRule>Special Feature</SectionRule>
          <SlotButton index={15} block={blocks[16]} selected={active === 15} onSelect={setActive}>
            <Well tone={blockTone(blocks[16])} className="h-64 w-full" />
            <div className="mt-3">
              <SlotCopy index={15} block={blocks[16]} titleClass="text-[1.25rem]" />
            </div>
          </SlotButton>
        </div>

        <aside className="flex flex-col gap-8 lg:col-span-4">
          <StaticRail
            kicker="Photo of the Day"
            title="From the quad"
            note="Photo submissions open in a later version."
          />
          <StaticRail
            kicker="Track of the Day"
            title="No playlist today"
            note="A track will live here later. No Spotify embed in this version."
            wellClassName="h-16"
          />
          <StaticRail
            kicker="Art"
            title="Open wall"
            note="Art submissions are a later version. This frame stays empty on purpose."
          />
        </aside>
      </div>

      {active == null ? (
        <p className="mt-8 font-sans text-sm text-neutral-500">Click a slot to edit it.</p>
      ) : (
        <SlotEditor
          key={`${draft.id}-${active}-${activeBlock?.id || "new"}-${activeBlock?.updated_at || ""}`}
          block={activeBlock}
          isSuper={isSuper}
          error={error}
          onSave={(heading, body) => onSave(active + 1, activeBlock, heading, body)}
          onSubmit={(heading, body) => onSubmit(active + 1, activeBlock, heading, body)}
          onApprove={() => onApprove(activeBlock)}
          onReject={() => onReject(activeBlock)}
        />
      )}
    </div>
  );
}

function SlotEditor({ block, isSuper, error, onSave, onSubmit, onApprove, onReject }) {
  const [heading, setHeading] = useState(block?.heading || "");
  const [body, setBody] = useState(block?.draft_body || "");

  return (
    <form
      className="mt-8 max-w-xl border-t border-black pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(heading, body);
      }}
    >
      <p className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]">
        {block ? block.review_status : "Empty slot"}
      </p>
      <input
        value={heading}
        onChange={(event) => setHeading(event.target.value)}
        placeholder="Section heading"
        className="mt-3 w-full border-0 border-b border-black bg-transparent py-2 font-serif text-2xl outline-none"
      />
      <FieldError message={fieldMessage(error, "heading")} />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={6}
        placeholder="Section draft"
        className="mt-4 w-full border border-black p-3 font-sans text-[15px] outline-none"
      />
      <FieldError message={fieldMessage(error, "body") || fieldMessage(error, "position")} />
      {block?.published_body ? (
        <p className="mt-3 font-sans text-sm text-neutral-500">
          Live: {block.published_heading}. The public page keeps that text until this draft is approved.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-4">
        <button type="submit" className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#1A4FBF]">
          Save draft
        </button>
        <button
          type="button"
          onClick={() => onSubmit(heading, body)}
          className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#1A4FBF]"
        >
          Submit
        </button>
        {isSuper && block?.review_status === "pending" ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="font-sans text-[11px] uppercase tracking-[0.18em] text-[#1A4FBF]"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="font-sans text-[11px] uppercase tracking-[0.18em] text-red-700"
            >
              Send back
            </button>
          </>
        ) : null}
      </div>
    </form>
  );
}

export default function NewsDrafts() {
  const { user, ready, setUser } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      navigate("/sign-in?next=/news/drafts", { replace: true });
      return;
    }
    if (!canEditNews(user)) navigate("/", { replace: true });
  }, [ready, user, navigate]);

  const refreshDrafts = useCallback(async () => {
    const data = await api.listDrafts();
    setDrafts(data.items);
    setError(null);
  }, []);

  useEffect(() => {
    if (!user || !canEditNews(user)) return undefined;
    let cancelled = false;
    setLoading(true);
    refreshDrafts()
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          navigate("/sign-in?next=/news/drafts");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          navigate("/", { replace: true });
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
  }, [user, navigate, setUser, refreshDrafts]);

  useLiveRefresh(Boolean(user && canEditNews(user)) && !loading, refreshDrafts);

  function openDraft(next) {
    setDraft(next);
    setDrafts((current) => current.map((item) => (item.id === next.id ? { ...item, title: next.title, status: next.status } : item)));
    setError(null);
  }

  async function selectDraft(id) {
    setError(null);
    try {
      openDraft(await api.getDraft(id));
    } catch (err) {
      setError(err);
    }
  }

  async function createDraft(event) {
    event.preventDefault();
    setError(null);
    try {
      const created = await api.createDraft(title.trim());
      setDrafts((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setTitle("");
      openDraft(created);
    } catch (err) {
      setError(err);
    }
  }

  async function saveSlot(position, block, heading, body, thenSubmit = false) {
    if (!draft) return;
    setError(null);
    try {
      const saved = block
        ? await api.patchBlock(draft.id, block.id, { heading, body })
        : await api.addBlock(draft.id, { heading, body, position });
      const nextBlock = saved.blocks.find((item) => item.position === position);
      openDraft(thenSubmit ? await api.submitBlock(draft.id, nextBlock.id) : saved);
    } catch (err) {
      setError(err);
    }
  }

  async function reviewSlot(block, action) {
    if (!draft || !block) return;
    setError(null);
    try {
      openDraft(await action(draft.id, block.id));
    } catch (err) {
      setError(err);
    }
  }

  if (!ready || !user || !canEditNews(user)) return null;

  return (
    <div className="mt-8">
      <FrontPageLink />
      <SectionRule>Drafts</SectionRule>
      <ErrorBanner error={error && !error.fields?.length ? error : null} />
      <form onSubmit={createDraft} className="mt-6 max-w-xl">
        <label className="block font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]" htmlFor="draft-title">
          New story
        </label>
        <input
          id="draft-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full border-0 border-b border-black bg-transparent py-2 font-serif text-2xl outline-none"
        />
        <FieldError message={fieldMessage(error, "title")} />
        <button type="submit" className="mt-3 font-sans text-[11px] uppercase tracking-[0.18em] text-[#1A4FBF]">
          Create draft
        </button>
      </form>

      {loading ? (
        <p className="mt-8 font-sans text-sm text-neutral-500">Loading drafts.</p>
      ) : (
        <ul className="mt-8 border-t border-black">
          {drafts.map((item) => (
            <li key={item.id} className="border-b border-neutral-200">
              <button
                type="button"
                onClick={() => selectDraft(item.id)}
                className="flex w-full items-baseline justify-between py-3 text-left"
              >
                <span className="font-serif text-xl">{item.title}</span>
                <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  {item.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <DraftBoard
          draft={draft}
          isSuper={user.role === "super_admin"}
          error={error}
          onSave={(position, block, heading, body) => saveSlot(position, block, heading, body)}
          onSubmit={(position, block, heading, body) => saveSlot(position, block, heading, body, true)}
          onApprove={(block) => reviewSlot(block, api.approveBlock)}
          onReject={(block) => reviewSlot(block, api.rejectBlock)}
        />
      ) : null}
    </div>
  );
}
