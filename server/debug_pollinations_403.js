const https = require('https');

const API_KEY = 'sk_Lz0BlLCnRap7iyjFzGKbiNnDfEEfQB9s';
const MODEL = 'flux'; // 'flux' is the best for photorealism

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

async function test(prompt, label) {
  console.log(`\n=== Test: ${label} ===`);
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://gen.pollinations.ai/image/${encodedPrompt}?width=512&height=512&model=${MODEL}&nologo=true`;

  try {
    const r = await httpGet(url);
    console.log(`Prompt: "${prompt.slice(0, 50)}..."`);
    console.log('Status:', r.status);
    if (r.status === 200) {
      console.log('SUCCESS! Image generated.');
    } else {
      console.log('FAILED. Body:', r.body.toString().slice(0, 300));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

async function runTests() {
  // Test 1: Simple prompt (baseline)
  await test('simple house floor plan', 'Short Prompt FLUX');

  // Test 2: The complex 3D prompt causing issues
  const complexPrompt = 'hyper-realistic 3D isometric floor plan, cinematic lighting, Unreal Engine 5 render, Octane Render, ray tracing, global illumination, ambient occlusion, extensive realistic furniture, modern interior design, 8k resolution, sharp focus, 4k textures, soft shadows, warm atmosphere, architectural visualization masterpiece, depth of field';
  await test(complexPrompt, 'Complex 3D Prompt FLUX');

  // Test 3: Fallback model (turbo)
  // await test('house floor plan', 'Fallback Turbo'); 
}

runTests();
