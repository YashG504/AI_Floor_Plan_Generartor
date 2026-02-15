const axios = require('axios');

const models = ['turbo', 'flux', 'unity', 'midjourney', 'stable-diffusion'];
const prompt = "Professional 2D architectural floor plan, black and white technical line drawing. Rectangular footprint 40ft x 30ft. Total area approx 1200 sqft. 3 Bedrooms, 2 Bathrooms. Main Entrance facing South. Clean lines, high contrast, white background. Clearly labeled rooms. No furniture, only architectural symbols. Single story layout.";

async function testModel(model) {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=${model}&nologo=true&seed=${Math.floor(Math.random() * 10000)}`;

  console.log(`Testing model: ${model}...`);
  const start = Date.now();

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const duration = (Date.now() - start) / 1000;
    console.log(`✅ ${model}: Success (${duration}s) - Size: ${response.data.length} bytes`);
    return true;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    console.log(`❌ ${model}: Failed (${duration}s) - ${error.message} - Status: ${error.response?.status}`);
    return false;
  }
}

async function runTests() {
  console.log("Starting model reliability tests...");
  for (const model of models) {
    await testModel(model);
  }
}

runTests();
