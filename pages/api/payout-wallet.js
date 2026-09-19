export default function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  return res.status(200).json({ address: process.env.PAYOUT_WALLET_ADDRESS || "" });
}
