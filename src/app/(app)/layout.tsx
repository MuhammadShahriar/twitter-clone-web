import { LeftNav } from "@/components/LeftNav";
import { RightSidebar } from "@/components/RightSidebar";
import { ToastProvider } from "@/context/ToastContext";

// Shared 3-column app shell (Brief 2). Every feature page under (app) reuses
// this — left nav + center column + right sidebar. The 1E auth screens live
// outside this group, so they stay standalone (no shell). ToastProvider (3C)
// wraps the shell so engagement actions can surface subtle feedback.
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <div className="app">
        <header className="col-left">
          <LeftNav />
        </header>
        <main className="col-center">{children}</main>
        <aside className="col-right">
          <RightSidebar />
        </aside>
      </div>
    </ToastProvider>
  );
}
