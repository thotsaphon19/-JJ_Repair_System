/**
 * /api/upload.js
 * รับไฟล์รูปภาพ → ส่งไป GAS เพื่อบันทึกลง Google Drive
 * GAS จะตอบกลับ fileId และ viewUrl
 */
export const config = { runtime: 'edge' };
const GAS_URL = process.env.GAS_URL;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!GAS_URL) return Response.json({ error: 'GAS_URL not set' }, { status: 500 });

  try {
    const body = await req.text();
    const r = await fetch(`${GAS_URL}?action=uploadFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await r.json();
    return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
