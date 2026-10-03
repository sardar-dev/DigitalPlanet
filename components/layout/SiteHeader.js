import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { SITE_NAME } from "../../lib/siteConfig";

// Shared storefront/account header. `session` is passed in by the
// page (each page already tracks auth state for its own data needs),
// so this component does no extra Supabase calls of its own.
export default function SiteHeader({ session, balance, onSignOut }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = session
    ? [
        { href: "/", label: "Store" },
        { href: "/account/wallet", label: "Wallet" },
        { href: "/account/orders", label: "My Orders" },
      ]
    : [{ href: "/", label: "Store" }];

  const isActive = (href) => router.pathname === href;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold text-ink">
          {SITE_NAME}
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-medium ${
                isActive(l.href) ? "text-brand" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <>
              {typeof balance === "number" && (
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
                  ${balance.toFixed(2)}
                </span>
              )}
              <button
                onClick={onSignOut}
                className="text-sm font-medium text-muted hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-muted hover:text-ink">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-md p-2 text-ink md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-surface px-4 py-3 md:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive(l.href) ? "bg-brand-soft text-brand" : "text-ink hover:bg-brand-soft"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              {session ? (
                <button
                  onClick={onSignOut}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted hover:bg-brand-soft"
                >
                  Sign out
                </button>
              ) : (
                <div className="flex gap-2 px-3 py-1">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-sm font-medium text-ink"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-medium text-white"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
