import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { Avatar } from "./Avatar";
import { CATEGORY_ROUTES, formatToday } from "../format";

function navClass({ isActive }) {
  return `font-sans text-[12px] font-medium uppercase tracking-[0.18em] ${
    isActive ? "text-neutral-900" : "text-neutral-900 hover:text-[#1A4FBF]"
  }`;
}

function SearchIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[15px] w-[15px] shrink-0 text-[#1A4FBF]"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.2 16.2 4.3 4.3" />
    </svg>
  );
}

export default function PaperShell() {
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [searchNotice, setSearchNotice] = useState(false);

  function onSearch(event) {
    event.preventDefault();
    setSearchNotice(true);
  }

  async function onSignOut() {
    try {
      await signOut();
    } catch {
      /* 401 still signs out in auth */
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <div className="mx-auto max-w-[1180px] px-8 pb-20">
        <div className="flex items-center justify-between border-b border-black py-[10px] font-sans text-[11px] font-medium tracking-[0.18em] text-[#111111]">
          <nav className="flex items-center gap-7 uppercase">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            {user ? (
              <>
                <Link to="/me/avatar" className="flex items-center gap-2.5 normal-case tracking-normal text-[#111111]">
                  <Avatar avatar={user.avatar} size={28} />
                  {user.display_name}
                </Link>
                <Link to="/me/avatar">Avatar</Link>
                <Link to="/me/posts">My Posts</Link>
                {user.role === "admin" ? <Link to="/admin/users">Users</Link> : null}
                <button type="button" onClick={onSignOut} className="uppercase">
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/sign-in">Sign In</Link>
            )}
          </nav>
          <p className="font-medium tracking-[0.06em] text-[#111111]">Today: {formatToday()}</p>
        </div>

        <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 pb-1 pt-8">
          <form onSubmit={onSearch} className="flex max-w-[13rem] items-end gap-2">
            <label className="sr-only" htmlFor="masthead-search">
              Search
            </label>
            <SearchIcon />
            <input
              id="masthead-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="w-full border-0 border-b border-black bg-transparent pb-[3px] font-sans text-[13px] font-normal text-[#111111] outline-none placeholder:text-neutral-400"
            />
          </form>

          <Link
            to="/"
            aria-label="BBGM Scoop home"
            className="relative z-10 flex cursor-pointer items-center justify-center gap-4 whitespace-nowrap no-underline sm:gap-5"
          >
            <span className="font-wordmark-bbgm text-[56px] sm:text-[72px]">BBGM</span>
            <span className="h-[52px] w-px bg-black sm:h-[66px]" aria-hidden="true" />
            <span className="font-wordmark-scoop text-[60px] sm:text-[78px]">SCOOP</span>
          </Link>

          <Link to="/" className="text-right no-underline">
            <p className="font-sans text-[10px] font-semibold tracking-[0.16em] text-[#1A4FBF]">
              BBGM STUDENT MEDIA
            </p>
            <p className="mt-[3px] font-sans text-[10px] font-normal tracking-[0.01em] text-neutral-500">
              Independent Student Journalism
            </p>
          </Link>
        </header>

        <p className="pb-6 pt-4 text-center font-sans text-[13px] font-semibold uppercase tracking-[0.28em] text-[#111111]">
          <Link to="/" className="text-inherit no-underline">
            Your campus. Your stories. Your voice.
          </Link>
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 border-b-[2.5px] border-black pb-[14px]">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          {CATEGORY_ROUTES.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {searchNotice ? (
          <p className="mt-3 font-sans text-sm text-neutral-500">Search comes in a later version.</p>
        ) : null}

        <Outlet />
      </div>
    </div>
  );
}
