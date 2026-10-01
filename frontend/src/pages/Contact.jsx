import { FrontPageLink, SectionRule } from "../components/ui";

export default function Contact() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>Contact</SectionRule>
      <p className="font-serif text-3xl leading-snug">Write to the forum, not to a help desk.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        Tips, corrections, and section questions stay on this community-hosted site. Students write in
        Forum; editors work in News drafts.
      </p>
    </div>
  );
}
