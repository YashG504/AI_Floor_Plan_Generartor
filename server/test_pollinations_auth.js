const axios = require('axios');

const API_KEY = 'sk_B9nqllRHDAzmwwADkzT2hnfnphEAW229';

async function testPollinations() {
  console.log("Testing Pollinations.ai with new key...");
  try {
    const response = await axios.get(
      `https://gen.pollinations.ai/image/${encodeURIComponent("A house plan")}`,
      {
        params: {
          model: 'nanobanana',
          width: 1024,
          height: 1024,
          nologo: true,
        },
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        },
        responseType: 'arraybuffer'
      }
    );
    console.log("Status:", response.status);
    console.log("Data Length:", response.data.byteLength);
    console.log("Content Type:", response.headers['content-type']);

    if (response.status === 200 && response.data.byteLength > 1000) {
      console.log("SUCCESS: Image generated successfully!");
    } else {
      console.log("FAILURE: Image generation failed or returned unexpected data.");
    }
  } catch (e) {
    console.error("Error:", e.response?.status, e.response?.statusText);
    console.error("Error Data:", e.response?.data?.toString());
  }
}

testPollinations();
