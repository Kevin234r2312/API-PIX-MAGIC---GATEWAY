// api/magic-pix.js
// Handler inicial só para testar a API na Vercel

export default function handler(req, res) {
  res.status(200).json({ ok: true, message: "Magic PIX API funcionando" });
}
