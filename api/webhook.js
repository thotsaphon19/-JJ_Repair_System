/**
 * /api/webhook.js
 * รับ LINE Webhook → ตอบ 200 ทันที → forward ไป GAS แบบ background
 * แก้ปัญหา GAS 302 redirect ที่ LINE ไม่ยอมรับ
 */

export const config = { runtime: 'edge' };

const GAS_URL = process.env.GAS_URL;

export default async function handler(req) {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Line-Signature',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();

  // Forward ไป GAS แบบ async ไม่รอผล
  if (GAS_URL) {
    fetch(`${GAS_URL}?action=lineWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(err => console.error('GAS forward error:', err));
  }

  // ตอบ LINE ทันที 200 OK
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
