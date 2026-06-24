"use client";

import { useSuggestions } from "@/lib/useSuggestions";
import { SuggestionList } from "@/components/SuggestionList";

/** Skeleton rows shown while suggestions load. */
function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div className="follow-row" key={i} aria-hidden>
          <span className="avatar skeleton-box" />
          <div className="follow-meta">
            <div className="skeleton-line" style={{ width: "55%" }} />
            <div className="skeleton-line" style={{ width: "40%", marginTop: 6 }} />
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Real "Who to follow" sidebar card (Module 3D). Replaces the static placeholder
 * with live suggestions. Hidden entirely for logged-out users or when there are
 * no suggestions; shows a skeleton while loading.
 */
export function WhoToFollow({ limit = 3 }: { limit?: number }) {
  const { users, loading, isAuthenticated } = useSuggestions(limit);

  if (!isAuthenticated) return null;
  if (!loading && users.length === 0) return null;

  return (
    <section className="side-card" aria-label="Who to follow">
      <h2 className="side-title">Who to follow</h2>
      {loading ? <SkeletonRows count={limit} /> : <SuggestionList users={users} />}
    </section>
  );
}
