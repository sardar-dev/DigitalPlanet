import Link from "next/link";
import { SITE_NAME } from "../../lib/siteConfig";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted sm:px-6">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <Link href="/terms" className="hover:text-ink hover:underline">
          Terms of Service
        </Link>
        <Link href="/privacy" className="hover:text-ink hover:underline">
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
