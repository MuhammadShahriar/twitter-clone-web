"use client";

import { use } from "react";
import { Thread } from "@/components/Thread";

// Tweet detail / thread page (Brief 3). The center column renders inside the
// shared (app) shell; Thread handles the focused tweet, reply composer, and the
// replies thread.
export default function TweetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <Thread id={id} />;
}
