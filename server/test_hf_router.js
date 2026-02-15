const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
const models = [
  "stabilityai/stable-diffusion-xl-base-1.0",
  "black-forest-labs/FLUX.1-schnell",
  "stabilityai/stable-diffusion-3.5-large",
  "CompVis/stable-diffusion-v1-4"
];

async function testModel(model) {
  console.log(`Testing ${model} on router.huggingface.co...`);
  try {
    // Try standard path
    console.log(`Testing standard path for ${model}...`);
    try {
      const response = await axios.post(
        `https://router.huggingface.co/models/${model}`,
        { inputs: "floor plan" },
        {
          headers: { Authorization: `Bearer ${HF_API_KEY}` },
          responseType: 'arraybuffer', timeout: 5000
        }
      );
      console.log(`✅ ${model} (Standard): Success!`);
      return true;
    } catch (e) { console.log(`❌ ${model} (Standard): ${e.response?.status || e.message}`); }

    // Try hf-inference path
    console.log(`Testing hf-inference path for ${model}...`);
    try {
      const response = await axios.post(
        `https://router.huggingface.co/hf-inference/models/${model}`,
        { inputs: "floor plan" },
        {
          headers: { Authorization: `Bearer ${HF_API_KEY}` },
          responseType: 'arraybuffer', timeout: 5000
        }
      );
      console.log(`✅ ${model} (HF-Inference): Success!`);
      return true;
    } catch (e) { console.log(`❌ ${model} (HF-Inference): ${e.response?.status || e.message}`); }

    return false;
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${model}: Failed - Status: ${error.response.status}`);
    } else {
      console.log(`❌ ${model}: Failed - ${error.message}`);
    }
    return false;
  }
}

async function run() {
  for (const m of models) {
    await testModel(m);
  }
}

run();
