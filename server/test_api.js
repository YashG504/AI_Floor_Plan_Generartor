const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
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
  // Test new unified endpoint
  console.log('=== Test: gen.pollinations.ai (new endpoint) ===');
  try {
    const r = await httpGet('https://gen.pollinations.ai/image/house%20floor%20plan?width=512&height=512&model=flux&nologo=true');
    console.log('Status:', r.status, 'Type:', r.type, 'Size:', r.size);
    if (r.status === 200 && r.type && r.type.includes('image')) {
      console.log('SUCCESS! Image generated!');
      require('fs').writeFileSync('test_output.jpg', r.body);
      console.log('Saved to test_output.jpg');
    } else {
      console.log('Body preview:', r.body.toString().slice(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
