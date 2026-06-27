import type { Message } from "@/lib/api";
import { bare } from "@/lib/handles";

/**
 * Whether a message was authored by the signed-in user. Tolerates either DTO
 * shape 12A might return — an explicit `isMine`, a `senderId`, or a nested
 * `sender.handle`. Shared by the thread (bubble side) and the conversation list
 * (skip bumping unread for my own echo).
 */
export function messageIsMine(
  m: Message,
  me: { id?: string; handle?: string } | null
): boolean {
  if (typeof m.isMine === "boolean") return m.isMine;
  if (m.senderId && me?.id) return m.senderId === me.id;
  if (m.sender?.handle && me?.handle) return bare(m.sender.handle) === bare(me.handle);
  return false;
}
