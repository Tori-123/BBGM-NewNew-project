import { FrontPageLink, SectionRule } from "../components/ui";

export default function Contact() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>Contact</SectionRule>
      <p className="font-serif text-3xl leading-snug">Write to 广东智云建材有限公司.</p>
      <p className="mt-4 font-sans text-[15px] leading-7">
        Elegram is owned by 广东智云建材有限公司, 珠海市横琴新区港澳大道88号2栋1507. Tips, corrections,
        and section questions go to the company.
      </p>
      <p className="mt-6 font-sans text-[15px] leading-7">
        <a
          className="text-[#1A4FBF] hover:text-[#111111]"
          href="mailto:tori.zhao1700299-bbgm@basischina.com"
        >
          tori.zhao1700299-bbgm@basischina.com
        </a>
      </p>
    </div>
  );
}
