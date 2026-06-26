"use client";

import { Suspense } from "react";
import { SearchResults } from "@/components/SearchResults";

// /search?q=… (Module 8B), inside the shared (app) shell. A literal route, so
// the App Router matches it before the dynamic /[handle] segment — a profile
// can never shadow it (and `search` is also in RESERVED_HANDLES as a backstop).
// SearchResults reads `q` via useSearchParams, so it lives under a Suspense
// boundary per the App Router's prerendering rules.
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="feed-status">
          <div className="spinner" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
