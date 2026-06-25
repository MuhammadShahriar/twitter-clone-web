"use client";

import { use } from "react";
import { FollowList } from "@/components/FollowList";

// /{handle}/followers — users who follow {handle}, inside the shared (app) shell
// (Module 7B). Nested under [handle]; literal routes (/login, /tweet/…) still
// take precedence, and FollowList applies the reserved-word guard. key remounts
// the list on handle/mode change so its state resets cleanly (like the profile).
export default function FollowersPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const decoded = decodeURIComponent(handle);
  return (
    <FollowList key={`${decoded}:followers`} handle={decoded} mode="followers" />
  );
}
