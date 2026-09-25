import Head from "next/head";
import { SITE_NAME, SITE_URL } from "../lib/siteConfig";

// One shared component so every page gets consistent, correct SEO
// tags instead of copy-pasted <Head> blocks drifting out of sync.
export default function SEO({
  title,
  description,
  path = "",
  noindex = false,
}) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME}`;
  const url = `${SITE_URL}${path}`;
  const desc =
    description ||
    "Digital Planet — buy digital products and accounts instantly online, pay with USDT (BEP20) or wallet balance.";

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />

      {/* Twitter card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />

      {/* Emoji favicon — no image file needed */}
      <link
        rel="icon"
        href={`data:image/svg+xml,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌍</text></svg>'
        )}`}
      />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
  );
}
