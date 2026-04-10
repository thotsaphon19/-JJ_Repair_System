/**
 * /api/proxy.js
 * Proxy ทุก API call ไป GAS — ซ่อน GAS URL จาก client
 */

export const config = { runtime: 'edge' };

const GAS_URL = process.env.GAS_URL;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (!GAS_URL) {
    return Response.json({ error: 'GAS_URL not configured' }, { status: 500 });
  }

  const url    = new URL(req.url);
  const params = url.searchParams.toString();

  try {
    let gasResp;
    if (req.method === 'GET') {
      gasResp = await fetch(`${GAS_URL}?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      const body = await req.text();
      gasResp = await fetch(`${GAS_URL}?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }

    const data = await gasResp.json();
    return Response.json(data, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return Response.json(
      { error: 'Proxy error', message: err.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}
