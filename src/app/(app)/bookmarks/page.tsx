import { Bookmarks } from "@/components/Bookmarks";

// /bookmarks — the caller's private saved tweets inside the shared app shell
// (Module 6B). Auth-gated; the list logic lives in the Bookmarks component.
export default function BookmarksPage() {
  return <Bookmarks />;
}
