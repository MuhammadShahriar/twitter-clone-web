import { LeftNav } from "@/components/LeftNav";
import { RightSidebar } from "@/components/RightSidebar";
import { MobileNav } from "@/components/MobileNav";
import { ToastProvider } from "@/context/ToastContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ConversationsProvider } from "@/context/ConversationsContext";
import { QuoteComposerProvider } from "@/context/QuoteComposerContext";

// Shared 3-column app shell (Brief 2). Every feature page under (app) reuses
// this — left nav + center column + right sidebar. The 1E auth screens live
// outside this group, so they stay standalone (no shell). ToastProvider (3C)
// wraps the shell so engagement actions can surface subtle feedback.
// NotificationsProvider (5C) owns the unread badge + the live SignalR connection;
// it sits inside ToastProvider so live pushes can surface a toast.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <NotificationsProvider>
        <ConversationsProvider>
        <QuoteComposerProvider>
          <div className="app">
            <header className="col-left">
              <LeftNav />
            </header>
            <main className="col-center">{children}</main>
            <aside className="col-right">
              <RightSidebar />
            </aside>
          </div>
          {/* Mobile-only bottom tab bar + compose FAB (responsive pass). */}
          <MobileNav />
        </QuoteComposerProvider>
        </ConversationsProvider>
      </NotificationsProvider>
    </ToastProvider>
  );
}
