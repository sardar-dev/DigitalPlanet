import Link from "next/link";
import SEO from "../components/SEO";
import { SITE_NAME } from "../lib/siteConfig";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <SEO
        title="Privacy Policy"
        description={`Privacy Policy for ${SITE_NAME} — what data we collect and how it's used.`}
        path="/privacy"
      />
      <header className="border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/" className="font-display text-2xl">
            {SITE_NAME}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6 text-sm">
        <h1 className="font-display text-2xl">Privacy Policy</h1>
        <p className="text-wire text-xs">Last updated: {new Date().toLocaleDateString()}</p>

        <p>
          This Policy explains what information {SITE_NAME} collects and how it's
          used.
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-lg">1. What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account information: your email address and password (stored securely, hashed).</li>
            <li>Order information: products purchased, quantities, prices, and delivery details.</li>
            <li>Payment information: the on-chain transaction hash you submit, and the wallet address it came from — we never ask for or store private keys.</li>
            <li>Basic technical data (like IP address) collected automatically by our hosting provider for security and abuse prevention.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">2. How it's used</h2>
          <p>
            We use this information to process orders, verify payments on-chain,
            deliver products, maintain your wallet balance, provide customer
            support, and keep the Site secure.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">3. Third parties</h2>
          <p>
            We use Supabase for authentication and data storage, and public BNB
            Smart Chain nodes to verify payments — both process data only as needed
            to provide the Site. Blockchain transactions themselves are public by
            nature and visible to anyone, independent of this Site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">4. Data retention</h2>
          <p>
            We keep account and order data for as long as your account is active,
            and as needed for support, fraud prevention, and legal recordkeeping
            afterward.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">5. Your rights</h2>
          <p>
            You can ask us to access, correct, or delete your account data by
            contacting us through the channel linked on the Site — note that
            on-chain transaction records themselves cannot be deleted, as they
            exist on the public blockchain independent of us.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">6. Contact</h2>
          <p>Reach us through the WhatsApp channel linked on the Site.</p>
        </section>

        <p className="pt-4">
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
        </p>
      </main>
    </div>
  );
}
