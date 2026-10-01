import { FrontPageLink, SectionRule } from "../components/ui";

export default function About() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>About</SectionRule>
      <p className="font-serif text-3xl leading-snug">Elegram is a community-hosted campus forum.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        Students sign in and write in Forum. Editors draft News in sections, and a super admin
        approves each section before it appears on the News page.
      </p>
      <p className="mt-4 font-sans text-[15px] leading-7 text-neutral-500">
        Elegram is independent and community-hosted. It is not the registrar, not a ticket office, and not a
        recommendation engine.
      </p>
    </div>
  );
}
