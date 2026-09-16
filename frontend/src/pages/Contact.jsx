import { FrontPageLink, SectionRule } from "../components/ui";

export default function Contact() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>Contact</SectionRule>
      <p className="font-serif text-3xl leading-snug">Write to student media, not to a help desk.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        Tips, corrections, and section questions go to the Scoop desk at BBGM Student Media. Students write in
        Community; editors publish from the section they want to update.
      </p>
      <p className="mt-4 font-sans text-[15px] leading-7 text-neutral-500">
        This page does not send mail. It is a static masthead notice.
      </p>
    </div>
  );
}
