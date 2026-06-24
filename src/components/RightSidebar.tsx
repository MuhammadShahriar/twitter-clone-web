"use client";

import { useState } from "react";
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

function SearchBar() {
  const [focus, setFocus] = useState(false);
  return (
    <div className={`search ${focus ? "focus" : ""}`}>
      <span className="search-ico">
        <IconSearch size={19} />
      </span>
      <input
        className="search-input"
        placeholder="Search"
        aria-label="Search"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      />
    </div>
  );
}

export function RightSidebar() {
  return (
    <div className="side-inner">
      <SearchBar />

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
