"use client";

import { use } from "react";
import { Profile } from "@/components/Profile";

// Profile page at /{handle} (Twitter-style, no `@` in the URL), inside the
// shared (app) shell. Literal routes (/login, /register, /tweet/[id]) take
// precedence over this dynamic segment in the App Router, so this only catches
// single-segment paths that aren't a literal route. Profile applies a
// reserved-word guard for paths like /explore that have no literal route yet.
export default function ProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const decoded = decodeURIComponent(handle);
  // key={decoded} remounts Profile when navigating between profiles, resetting
  // its tab/timeline state cleanly instead of bleeding across handles.
  return <Profile key={decoded} handle={decoded} />;
}
