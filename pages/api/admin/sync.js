import { syncProducts } from "../../../lib/syncProducts";

// Called on a schedule (see vercel.json cron, or an external
// scheduler like cron-job.org on Hobby plans) to refresh our local
// product cache from DigiTrust.
export default async function handler(req, res) {
  // Vercel Cron automatically sends "Authorization: Bearer <CRON_SECRET>"
  // when a CRON_SECRET env var is set on the project. We also accept a
  // manual header/query value for external schedulers / testing.
  const bearer = (req.headers.authorization || "").replace("Bearer ", "");
  const secret = bearer || req.headers["x-cron-secret"] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  try {
    const result = await syncProducts();
    return res.status(200).json({ success: true, ...result });
  } catch (e) {
    return res.status(502).json({ success: false, error: e.message });
  }
}
