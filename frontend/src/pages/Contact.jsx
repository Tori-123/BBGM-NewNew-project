import { FrontPageLink, SectionRule } from "../components/ui";
import { useI18n } from "../i18n";

export default function Contact() {
  const { t } = useI18n();
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <SectionRule>{t("contact.kicker")}</SectionRule>
      <p className="font-serif text-3xl leading-snug">{t("contact.lead")}</p>
      <p className="mt-4 font-sans text-[15px] leading-7">{t("contact.body")}</p>
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
