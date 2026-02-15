const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY;
// Trying FLUX.1-dev as a superior alternative to SDXL
const MODEL = "black-forest-labs/FLUX.1-dev";

async function testRouter() {
  console.log(`Testing ${MODEL} on router.huggingface.co...`);
  try {
    const response = await axios.post(
      `https://router.huggingface.co/models/${MODEL}`,
      {
        inputs: "Architectural floor plan of a 3-bedroom house, technical drawing, white background, black lines",
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );
    console.log("✅ Success! Image size:", response.data.length);
  } catch (error) {
    console.error("❌ Failed:", error.message);
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data.toString());
    }
  }
}

testRouter();
