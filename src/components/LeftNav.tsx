"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { avatarColor, initials } from "@/lib/format";
import {
  IconBell,
  IconExplore,
  IconHome,
  IconMail,
  IconMore,
  IconMoreCircle,
  IconPlus,
  IconUser,
  Svg,
} from "@/components/icons";

const IconBookmarkNav = () => (
  <Svg>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </Svg>
);

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: (p: { on?: boolean }) => React.ReactNode;
  badge?: boolean;
};

// Only Home is functional in 2B; the rest are styled placeholders that route
// to "/" for now (Explore/Notifications/etc. arrive in later modules).
const NAV: NavItem[] = [
  { id: "home", label: "Home", href: "/", icon: IconHome },
  { id: "explore", label: "Explore", href: "/", icon: IconExplore },
  { id: "notif", label: "Notifications", href: "/", icon: IconBell, badge: true },
  { id: "msg", label: "Messages", href: "/", icon: IconMail },
  { id: "bookmarks", label: "Bookmarks", href: "/", icon: IconBookmarkNav },
  { id: "profile", label: "Profile", href: "/", icon: IconUser },
  { id: "more", label: "More", href: "/", icon: IconMoreCircle },
];

export function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const chipRef = useRef<HTMLDivElement | null>(null);

  // Close the logout popover on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  return (
    <nav className="nav-inner" aria-label="Primary">
      <div className="nav-logo">
        <Link href="/" className="logo-mark" aria-label="Home">
          T
        </Link>
      </div>

      <ul className="nav-list">
        {NAV.map((it) => {
          const Ico = it.icon;
          const isActive = it.id === "home" && pathname === "/";
          return (
            <li key={it.id}>
              <Link
                href={it.href}
                className={`nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-ico">
                  <Ico on={isActive} />
                  {it.badge && !isActive && <span className="nav-badge" />}
                </span>
                <span className="nav-label">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href="/" className="post-btn">
        <span className="post-btn-full">Post</span>
        <span className="post-btn-ico">
          <IconPlus />
        </span>
      </Link>

      {/* Account chip (auth-aware). Hidden until the auth bootstrap resolves. */}
      {!isLoading &&
        (isAuthenticated && user ? (
          <div className="acct-chip-wrap" ref={chipRef} style={{ marginTop: "auto" }}>
            {menuOpen && (
              <div className="acct-menu" role="menu">
                <button type="button" onClick={handleLogout} role="menuitem">
                  Log out @{user.handle}
                </button>
              </div>
            )}
            <button
              type="button"
              className="acct-chip"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span
                className="avatar sm"
                style={{ background: avatarColor(user.handle) }}
              >
                {initials(user.displayName)}
              </span>
              <span className="acct-meta">
                <span className="acct-name">{user.displayName}</span>
                <span className="acct-handle">@{user.handle}</span>
              </span>
              <span className="acct-more">
                <IconMore />
              </span>
            </button>
          </div>
        ) : (
          <div className="nav-auth">
            <Link href="/register" className="btn-primary">
              Create account
            </Link>
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          </div>
        ))}
    </nav>
  );
}
