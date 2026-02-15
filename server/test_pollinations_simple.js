const axios = require('axios');

async function testSimple() {
  const prompt = "floor plan";
  const encodedPrompt = encodeURIComponent(prompt);
  // minimal url
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

  console.log("Testing minimal URL:", url);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    console.log("✅ Success! Size:", response.data.length);
  } catch (error) {
    console.error("❌ Failed:", error.message);
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", error.response.data.toString());
    }
  }
}

testSimple();
