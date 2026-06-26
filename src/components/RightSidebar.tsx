"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconMore, IconSearch } from "@/components/icons";
import { WhoToFollow } from "@/components/WhoToFollow";

// Trending is still static placeholder data (real trending = Module 6). "Who to
// follow" is now real (Module 3D, see WhoToFollow).
const TRENDS = [
  { meta: "Programming · Trending", topic: "#dotnet", posts: "12.4K posts" },
  { meta: "Technology · Trending", topic: "ASP.NET Core", posts: "8,932 posts" },
  { meta: "Trending in Bangladesh", topic: "#CleanArchitecture", posts: "3,184 posts" },
  { meta: "Programming · Trending", topic: "SignalR", posts: "2,051 posts" },
  { meta: "Technology · Trending", topic: "EF Core", posts: "5,677 posts" },
];

// Submit-on-enter → /search?q=… (Module 8B). Reads the live `q` so the box
// stays in sync with the results page (and prefills when you land on /search).
// useSearchParams means this must render inside a <Suspense> boundary.
function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";

  const [value, setValue] = useState(currentQ);
  const [focus, setFocus] = useState(false);

  // Keep the input mirroring the URL query when navigation changes it
  // (e.g. landing on /search?q=… from elsewhere, or clearing the search).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(currentQ);
  }, [currentQ]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return; // ignore empty / whitespace-only submits
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      className={`search ${focus ? "focus" : ""}`}
      role="search"
      onSubmit={submit}
    >
      <span className="search-ico">
        <IconSearch size={19} />
      </span>
      <input
        className="search-input"
        type="search"
        placeholder="Search"
        aria-label="Search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      />
    </form>
  );
}

// Static shell shown while SearchBar's Suspense boundary resolves the URL query.
function SearchBarFallback() {
  return (
    <div className="search">
      <span className="search-ico">
        <IconSearch size={19} />
      </span>
      <input
        className="search-input"
        type="search"
        placeholder="Search"
        aria-label="Search"
        disabled
      />
    </div>
  );
}

export function RightSidebar() {
  return (
    <div className="side-inner">
      <Suspense fallback={<SearchBarFallback />}>
        <SearchBar />
      </Suspense>

      <section className="side-card" aria-label="What's happening">
        <h2 className="side-title">What&apos;s happening</h2>
        {TRENDS.map((tr, i) => (
          <div className="trend-row" key={i}>
            <div className="trend-meta">
              <div className="trend-cat">{tr.meta}</div>
              <div className="trend-topic">{tr.topic}</div>
              <div className="trend-posts">{tr.posts}</div>
            </div>
            <span className="trend-more">
              <IconMore />
            </span>
          </div>
        ))}
        <span className="side-more">Show more</span>
      </section>

      <WhoToFollow />

      <footer className="side-foot">
        <a>Terms of Service</a>
        <a>Privacy Policy</a>
        <a>Cookie Policy</a>
        <a>Accessibility</a>
        <a>About</a>
        <span>© 2026 T Corp.</span>
      </footer>
    </div>
  );
}
