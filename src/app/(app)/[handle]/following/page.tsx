"use client";

import { use } from "react";
import { FollowList } from "@/components/FollowList";

// /{handle}/following — users {handle} follows, inside the shared (app) shell
// (Module 7B). Nested under [handle]; literal routes still take precedence, and
// FollowList applies the reserved-word guard. key remounts on handle/mode change.
export default function FollowingPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const decoded = decodeURIComponent(handle);
  return (
    <FollowList key={`${decoded}:following`} handle={decoded} mode="following" />
  );
}
