import { Logo } from "./Logo";

// Standalone split-screen auth layout (no app nav/sidebar — that arrives with
// the feed in a later module). Left: brand panel. Right: the form card.
// Stacks vertically below 860px.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen max-[860px]:flex-col">
      {/* Left — brand panel. Pure black with a soft blue glow + vignette. */}
      <section
        aria-hidden
        className="relative grid grow-[1.18] shrink basis-0 place-items-center overflow-hidden max-[860px]:min-h-[220px] max-[860px]:grow-0 max-[860px]:basis-auto max-[860px]:py-6"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 46%, rgba(29,155,240,0.20) 0%, rgba(29,155,240,0.05) 38%, transparent 70%), #000000",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.65) 100%)",
          }}
        />
        <div className="relative z-10 px-10 text-center">
          <div
            className="text-[clamp(180px,22vw,320px)] font-extrabold leading-[0.86] tracking-[-0.04em] text-accent max-[860px]:text-[120px]"
            style={{ textShadow: "0 0 80px rgba(29,155,240,0.45)" }}
          >
            T
          </div>
          <p className="mx-auto mt-7 max-w-[360px] text-[22px] font-bold leading-[1.4] tracking-[-0.01em] text-text max-[860px]:mt-3.5 max-[860px]:max-w-[280px] max-[860px]:text-[17px]">
            যা ঘটছে এখন — সব এক জায়গায়।
          </p>
        </div>
      </section>

      {/* Right — form panel (~41%), vertically centered, 380px card. */}
      <main className="flex grow-[0.82] shrink basis-0 items-center justify-center border-l border-border px-14 py-12 max-[860px]:grow max-[860px]:items-start max-[860px]:border-l-0 max-[860px]:border-t max-[860px]:px-[22px] max-[860px]:pb-16 max-[860px]:pt-9">
        <div className="w-full max-w-[380px]">
          <div className="mb-7">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
