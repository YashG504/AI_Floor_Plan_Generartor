const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const models = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "black-forest-labs/FLUX.1-schnell",
  "CompVis/stable-diffusion-v1-4",
  "gpt2" // simple text model to test API
];

async function testModel(model) {
  console.log(`Testing ${model} on api-inference.huggingface.co...`);
  try {
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${model}`,
      model === 'gpt2' ? { inputs: "Hello" } : { inputs: "floor plan" },
      {
        headers: { Authorization: `Bearer ${HF_API_KEY}` },
        responseType: 'arraybuffer',
        timeout: 10000
      }
    );
    console.log(`✅ ${model}: Success! Size: ${response.data.length}`);
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${model}: Failed - Status: ${error.response.status}`);
      // Log data if possible
      try { console.log(error.response.data.toString()) } catch (e) { }
    } else {
      console.log(`❌ ${model}: Failed - ${error.message}`);
    }
  }
}

async function run() {
  for (const m of models) {
    await testModel(m);
  }
}

run();
