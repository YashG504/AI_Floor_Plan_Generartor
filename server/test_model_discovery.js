const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const models = [
  "runwayml/stable-diffusion-v1-5",
  "prompthero/openjourney",
  "stabilityai/stable-diffusion-2-1",
  "stabilityai/stable-diffusion-xl-base-1.0",
  "black-forest-labs/FLUX.1-schnell"
];

async function testModel(model) {
  console.log(`Testing ${model}...`);
  try {
    const response = await axios.post(
      `https://router.huggingface.co/hf-inference/models/${model}`,
      { inputs: "floor plan" },
      {
        headers: { Authorization: `Bearer ${HF_API_KEY}` },
        responseType: 'arraybuffer',
        timeout: 10000
      }
    );
    console.log(`✅ ${model}: Success! Size: ${response.data.length}`);
    return model;
  } catch (error) {
    console.log(`❌ ${model}: Failed - ${error.response?.status || error.message}`);
    return null;
  }
}

async function run() {
  for (const m of models) {
    const works = await testModel(m);
    if (works) {
      console.log(`\n🎉 FOUND WORKING MODEL: ${works}`);
      // Keep testing others just in case but we found one
    }
  }
}

run();
