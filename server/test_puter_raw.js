const axios = require('axios');

async function testDriver() {
  try {
    const response = await axios.post('https://api.puter.com/drivers/call', {
      interface: 'puter-image-generation',
      driver: 'ai-image',
      method: 'generate',
      test_mode: true,
      args: {
        prompt: "A simple house sketch"
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log("Status:", response.status);
    console.log("Data:", response.data);
  } catch (e) {
    console.error("Error Status:", e.response?.status);
    console.error("Error Data:", e.response?.data);
  }
}

testDriver();
