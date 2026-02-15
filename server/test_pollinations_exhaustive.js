const axios = require('axios');

const prompt = "floor plan technical drawing";
const encodedPrompt = encodeURIComponent(prompt);

const configs = [
  { name: "Default (No params)", url: `https://image.pollinations.ai/prompt/${encodedPrompt}` },
  { name: "Flux", url: `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux` },
  { name: "Turbo", url: `https://image.pollinations.ai/prompt/${encodedPrompt}?model=turbo` },
  { name: "Midjourney", url: `https://image.pollinations.ai/prompt/${encodedPrompt}?model=midjourney` },
  { name: "No Logo", url: `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true` },
  { name: "Seed", url: `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=123` },
];

async function testConfig(config) {
  console.log(`Testing ${config.name}...`);
  try {
    const response = await axios.get(config.url, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    console.log(`✅ ${config.name}: Success! Size: ${response.data.length}`);
    return config;
  } catch (error) {
    console.log(`❌ ${config.name}: Failed - ${error.response?.status || error.message}`);
    return null;
  }
}

async function run() {
  for (const c of configs) {
    await testConfig(c);
  }
}

run();
