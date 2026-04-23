const axios = require('axios');

async function test() {
  try {
    const prompt = '2D architectural floor plan simple layout';
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    console.log("Fetching:", pollinationsUrl);

    const response = await axios.get(pollinationsUrl, {
      responseType: 'arraybuffer',
      timeout: 15000
    });
    console.log("Success! Status:", response.status, "Length:", response.data.length);
  } catch (error) {
    console.error("Error fetching:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data.toString().substring(0, 200));
    } else {
      console.error(error.message);
    }
  }
}
test();
