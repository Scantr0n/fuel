// Netlify serverless function — keeps the real Anthropic API key server-side.
// Set ANTHROPIC_API_KEY in Netlify's dashboard (Site settings > Environment variables),
// never in client code. The browser calls this function instead of api.anthropic.com directly.
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Server is not configured with ANTHROPIC_API_KEY yet.' }),
    };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: event.body,
    });
    const data = await res.text();
    return {
      statusCode: res.status,
      headers: { 'content-type': 'application/json' },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach Claude API.' }),
    };
  }
};
