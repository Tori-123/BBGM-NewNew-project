import { FrontPageLink, SectionRule } from "../components/ui";

export default function About() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>About</SectionRule>
      <p className="font-serif text-3xl leading-snug">Elegram is owned by 广东智云建材有限公司.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        广东智云建材有限公司 owns and operates this site. Its registered address is
        珠海市横琴新区港澳大道88号2栋1507. People sign in and write in Forum. Editors draft News in
        sections, and a super admin approves each section before it appears on the News page.
      </p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        To reach the company, write to{" "}
        <a
          className="text-[#1A4FBF] hover:text-[#111111]"
          href="mailto:tori.zhao1700299-bbgm@basischina.com"
        >
          tori.zhao1700299-bbgm@basischina.com
        </a>
        .
      </p>
      <p className="mt-4 font-sans text-[15px] leading-7 text-neutral-500">
        The owner is 广东智云建材有限公司. This site is not a ticket office, and not a recommendation
        engine.
      </p>
    </div>
  );
}
