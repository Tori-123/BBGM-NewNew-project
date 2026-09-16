import { FrontPageLink, SectionRule } from "../components/ui";

export default function About() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>About</SectionRule>
      <p className="font-serif text-3xl leading-snug">BBGM Scoop is student media for one campus.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        Students sign in, publish a story, and classmates read it in News, Sports, Dorm Life, or Events.
        Activities carry a start time and a place so readers can tell a notice from something they can attend.
      </p>
      <p className="mt-4 font-sans text-[15px] leading-7 text-neutral-500">
        Scoop is independent student journalism. It is not the registrar, not a ticket office, and not a
        recommendation engine.
      </p>
    </div>
  );
}
