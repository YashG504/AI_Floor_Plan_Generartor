const https = require('https');

const API_KEY = 'sk_Lz0BlLCnRap7iyjFzGKbiNnDfEEfQB9s';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'Mozilla/5.0'
      }
    };
    https.get(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, type: res.headers['content-type'], size: buf.length, body: buf });
      });
    }).on('error', reject);
  });
}

async function test() {
  console.log('=== Test: gen.pollinations.ai with API Key ===');
  // Note: prompt is part of the path in the new API usually, or query param?
  // Previous test showed gen.pollinations.ai accepts /image/prompt
  const url = 'https://gen.pollinations.ai/image/modern%20house%20floor%20plan?width=512&height=512&model=flux&nologo=true';

  try {
    const r = await httpGet(url);
    console.log('Status:', r.status, 'Type:', r.type, 'Size:', r.size);
    if (r.status === 200 && r.type && r.type.includes('image')) {
      console.log('SUCCESS! Image generated with key!');
    } else {
      console.log('Failed Body:', r.body.toString().slice(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
