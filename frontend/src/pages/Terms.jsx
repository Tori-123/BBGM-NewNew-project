import { useEffect, useState } from "react";
import { FrontPageLink, SectionRule } from "../components/ui";

const STORAGE_KEY = "elegram_terms_lang";

const COPY = {
  en: {
    title: "Terms",
    lead: "Elegram is owned and operated by 广东智云建材有限公司. It is not a ticket office, and not a recommendation engine. Creating an account means you accept this agreement.",
    sections: [
      {
        heading: "Account and cybersecurity",
        items: [
          "Use only your own email address.",
          "Do not give your password to anyone else.",
          "Do not break into another account, skip sign-in, upload malicious files, or disrupt the service.",
          "Passwords are stored as hashes. The session cookie is HttpOnly.",
        ],
      },
      {
        heading: "A healthy network",
        intro: "Do not post:",
        items: [
          "Content that breaks the law, including material that endangers national security, rumors, obscenity, pornography, gambling, violence, terrorism or extremism, insults, defamation, or another person’s private information.",
          "Harassment or impersonation.",
        ],
      },
      {
        heading: "What the site will do",
        items: [
          "A News section stays off the public page until a super admin approves it.",
          "An admin can delete a post that breaks these rules. The author sees a notice on System.",
          "A super admin can mute an account. A muted account can still sign in and read, and cannot post, reply, like, or write a draft.",
          "A super admin can delete an account. That ends its session and removes its posts and comments.",
          "Forum posts are public as soon as they are published. Elegram does not review them automatically.",
        ],
      },
      {
        heading: "What you should do",
        items: [
          "Register with your own email address.",
          "Do not spread the content listed above.",
          "If you see a violation, tell a super admin. This site has no report form. The Contact page does not send mail.",
        ],
      },
    ],
    closing:
      "These are Elegram’s own site rules. This page is not a government filing, and the site does not send reports to an authority.",
  },
  zh: {
    title: "用户协议",
    lead: "Elegram 由广东智云建材有限公司所有并运营。不是售票处，也不是推荐引擎。注册即表示接受本协议。",
    sections: [
      {
        heading: "账号与网络安全",
        items: [
          "只用自己的邮箱。",
          "不要把密码交给别人。",
          "不要入侵他人账号、绕过登录、上传恶意文件或扰乱服务。",
          "密码只以哈希保存。会话 Cookie 为 HttpOnly。",
        ],
      },
      {
        heading: "维护健康的网络环境",
        intro: "不要发布：",
        items: [
          "违法信息，包括危害国家安全、谣言、淫秽色情、赌博、暴力、恐怖极端、侮辱诽谤，以及他人的隐私。",
          "骚扰与冒充。",
        ],
      },
      {
        heading: "站点会怎么处理",
        items: [
          "News 板块在超级管理员同意之前不会出现在公开页面。",
          "管理员可以删除违规帖。作者会在 System 看到一条通知。",
          "超级管理员可以禁言。被禁言的账号仍可登录阅读，不能发帖、跟帖、点赞或写稿。",
          "超级管理员可以删除账号。删除后会话作废，其帖子与评论一并去掉。",
          "Forum 帖子一经发布即公开。Elegram 不做自动审核。",
        ],
      },
      {
        heading: "你该怎么做",
        items: [
          "用本人的邮箱注册。",
          "不传播上面列出的内容。",
          "看到违规内容，告诉超级管理员。站内没有举报表单。Contact 页不发信。",
        ],
      },
    ],
    closing: "本页是 Elegram 自己的站点规则，不是备案，站点也不向主管机关报送。",
  },
};

function readLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

function TermsBody() {
  const [lang, setLang] = useState(readLang);
  const copy = COPY[lang];

  function choose(next) {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => choose(lang === "en" ? "zh" : "en")}
          className="font-sans text-[11px] uppercase tracking-[0.16em] text-[#1A4FBF]"
        >
          {lang === "en" ? "中文" : "English"}
        </button>
      </div>
      <SectionRule>{copy.title}</SectionRule>
      <p className="font-serif text-3xl leading-snug">{copy.lead}</p>
      {copy.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h3 className="font-serif text-xl">{section.heading}</h3>
          {section.intro ? <p className="mt-3 font-sans text-[15px] leading-7">{section.intro}</p> : null}
          <ul className="mt-3 list-disc space-y-2 pl-5 font-sans text-[15px] leading-7">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-8 font-sans text-[15px] leading-7 text-neutral-500">{copy.closing}</p>
    </>
  );
}

export function TermsDialog({ onClose, onAgree }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-title"
        className="relative z-10 w-full max-w-2xl bg-white p-8"
      >
        <h2 id="terms-dialog-title" className="sr-only">
          User agreement
        </h2>
        <TermsBody />
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em]"
          >
            Close
          </button>
          {onAgree ? (
            <button
              type="button"
              onClick={onAgree}
              className="rounded-[2px] bg-black px-5 py-2 font-sans text-[11px] uppercase tracking-[0.18em] text-white"
            >
              I agree
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Terms() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <FrontPageLink />
      <TermsBody />
    </div>
  );
}
