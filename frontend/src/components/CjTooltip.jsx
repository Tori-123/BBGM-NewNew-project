import { useEffect, useRef, useState } from "react";

export default function CjTooltip({ label, children, align = "right" }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  function begin() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(true), 1000);
  }

  function end() {
    window.clearTimeout(timer.current);
    setVisible(false);
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span className="relative inline-flex" onMouseEnter={begin} onMouseLeave={end} onFocus={begin} onBlur={end}>
      {children}
      {visible ? (
        <span
          role="tooltip"
          className={`pointer-events-none absolute top-[calc(100%+7px)] z-50 whitespace-nowrap bg-black px-2 py-1 font-sans text-[10px] normal-case tracking-normal text-white shadow-lg ${align === "left" ? "left-0" : "right-0"}`}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
