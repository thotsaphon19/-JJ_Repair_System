export const config = { runtime: 'edge' };
const GAS_URL = process.env.GAS_URL;
export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Line-Signature' } });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  if (GAS_URL) fetch(`${GAS_URL}?action=lineWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
