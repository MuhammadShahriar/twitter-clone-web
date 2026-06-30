"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useConversations } from "@/context/ConversationsContext";
import {
  IconBell,
  IconHome,
  IconMail,
  IconPlus,
  IconSearch,
  IconUser,
} from "@/components/icons";

// Mobile-only chrome (responsive pass). The desktop 3-column shell hides its
// left nav + right sidebar below the `--mobile` breakpoint (see globals.css);
// this fills the gap with a fixed bottom tab bar + a compose FAB. Pure CSS
// controls visibility (`.bottom-nav` / `.fab` are display:none until the mobile
// media query), so these render on every viewport but only show on phones.
// Mirrors LeftNav's active-state, profile-href, and unread-badge logic.

type Tab = {
  id: string;
  label: string;
  href: string;
  render: (active: boolean) => React.ReactNode;
};

const TABS: Tab[] = [
  { id: "home", label: "Home", href: "/", render: (a) => <IconHome on={a} /> },
  { id: "search", label: "Search", href: "/search", render: () => <IconSearch /> },
  { id: "notif", label: "Notifications", href: "/notifications", render: () => <IconBell /> },
  { id: "msg", label: "Messages", href: "/messages", render: () => <IconMail /> },
  { id: "profile", label: "Profile", href: "/", render: () => <IconUser /> },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  const { unreadCount: dmUnread } = useConversations();

  // Inside an open DM thread (/messages/{id}) the thread is a full-height column
  // with its own pinned composer — hide the whole bar there (matches Twitter
  // mobile) so it can't overlap the message input.
  const inThread = /^\/messages\/.+/.test(pathname);
  if (inThread) return null;

  const profileHref =
    isAuthenticated && user ? `/${user.handle.replace(/^@+/, "")}` : "/";

  // A compose FAB is redundant on the messages list (the Messages tab covers it),
  // so show it everywhere else on mobile. It routes to "/" where the inline
  // composer lives — same destination as the desktop "Post" button.
  const showFab = !pathname.startsWith("/messages");

  return (
    <>
      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map((it) => {
          const href = it.id === "profile" ? profileHref : it.href;
          const active =
            (it.id === "home" && pathname === "/") ||
            (it.id === "search" && pathname.startsWith("/search")) ||
            (it.id === "notif" && pathname === "/notifications") ||
            (it.id === "msg" && pathname.startsWith("/messages")) ||
            (it.id === "profile" && href !== "/" && pathname === href);
          const count = it.id === "notif" ? unreadCount : it.id === "msg" ? dmUnread : 0;
          return (
            <Link
              key={it.id}
              href={href}
              className={`bottom-nav-item ${active ? "active" : ""}`}
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="bottom-nav-ico">
                {it.render(active)}
                {count > 0 && (
                  <span className="bottom-nav-badge" aria-label={`${count} unread`}>
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {showFab && (
        <Link href="/" className="fab" aria-label="Post">
          <IconPlus />
        </Link>
      )}
    </>
  );
}
