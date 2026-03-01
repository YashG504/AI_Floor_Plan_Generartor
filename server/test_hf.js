const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const HF_API_KEY = process.env.HF_API_KEY || 'your_hf_token_here';

async function testHF() {
  console.log("Testing Hugging Face with key:", HF_API_KEY ? "Present" : "Missing");
  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
      { inputs: "A house floor plan blueprint" },
      {
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    console.log("HF Status:", response.status);
    console.log("HF Data Length:", response.data.byteLength);
  } catch (e) {
    console.error("HF Error:", e.response?.data?.toString() || e.message);
  }
}

testHF();
