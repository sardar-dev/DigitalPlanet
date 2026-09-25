import Link from "next/link";
import SEO from "../components/SEO";
import { SITE_NAME } from "../lib/siteConfig";

export default function Terms() {
  return (
    <div className="min-h-screen bg-paper text-ink font-body">
      <SEO
        title="Terms of Service"
        description={`Terms of Service for ${SITE_NAME} — digital products, USDT (BEP20) payments, delivery and refunds.`}
        path="/terms"
      />
      <header className="border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/" className="font-display text-2xl">
            {SITE_NAME}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6 text-sm">
        <h1 className="font-display text-2xl">Terms of Service</h1>
        <p className="text-wire text-xs">Last updated: {new Date().toLocaleDateString()}</p>

        <p>
          These Terms govern your use of {SITE_NAME} (the "Site"). By creating an
          account or placing an order, you agree to these Terms.
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-lg">1. What we sell</h2>
          <p>
            We sell digital products (accounts, subscriptions, licenses, and similar
            items). Delivery is either instant/automatic or manual, as shown on each
            product before you pay. Manual items are fulfilled by an administrator
            within the estimated time shown at checkout.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">2. Payments</h2>
          <p>
            Payments are accepted in USDT on the BEP20 (BNB Smart Chain) network, or
            from your wallet balance on this Site. Cryptocurrency transactions are
            irreversible — sending funds to the wrong network or address may result
            in permanent loss, and we cannot recover funds sent incorrectly. Double
            check the network and address shown at checkout before sending.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">3. Digital goods and refunds</h2>
          <p>
            Because our products are digital and delivered electronically, sales are
            generally final once an item has been delivered. If an order cannot be
            fulfilled (for example, the item sold out at the last moment), we will
            refund the payment or credit it to your wallet balance. Refund requests
            for other reasons are reviewed case by case — contact us through the
            channel linked on the Site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">4. Account responsibilities</h2>
          <p>
            You're responsible for keeping your account credentials secure and for
            all activity under your account. You must provide accurate information
            (including a working email address, where a product requires one) for
            delivery purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">5. Prohibited use</h2>
          <p>
            You may not use the Site for any unlawful purpose, to defraud us or
            other users, to attempt to manipulate stock/pricing/payment systems, or
            to resell purchased items in violation of the original provider's terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">6. Limitation of liability</h2>
          <p>
            The Site is provided "as is." To the extent permitted by law, we are not
            liable for indirect or consequential losses, including losses from
            network congestion, blockchain delays, or third-party service outages
            outside our control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">7. Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use of the Site
            after changes means you accept the updated Terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg">8. Contact</h2>
          <p>Reach us through the WhatsApp channel linked on the Site.</p>
        </section>

        <p className="pt-4">
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
        </p>
      </main>
    </div>
  );
}
