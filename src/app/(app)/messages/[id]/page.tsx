"use client";

import { use } from "react";
import { ChatThread } from "@/components/ChatThread";

// /messages/{id} — a DM thread inside the shared app shell (Module 12). Keyed by
// id so it remounts on navigation between conversations (clean state).
export default function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ChatThread key={id} conversationId={id} />;
}
