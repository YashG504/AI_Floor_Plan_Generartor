const axios = require('axios');

async function testLexica() {
  const query = "architectural floor plan 3 bedrooms 2 bathrooms black and white";
  const url = `https://lexica.art/api/v1/search?q=${encodeURIComponent(query)}`;

  console.log(`Testing Lexica API: ${url}`);

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const images = response.data.images;

    if (images && images.length > 0) {
      console.log(`✅ Success! Found ${images.length} images.`);
      console.log(`First image: ${images[0].src}`);
      return true;
    } else {
      console.log("❌ Success response but no images found.");
      return false;
    }
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return false;
  }
}

testLexica();
