const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');

// POST /api/generate-floorplan
router.post('/generate-floorplan', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Using Pollinations.ai (Free, no key required)
    const encodedPrompt = encodeURIComponent(prompt + " photorealistic, 8k, architectural render, top view");
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&model=flux`;

    console.log('Generating floor plan via Pollinations:', url);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 seconds
    });

    console.log('Pollinations response received, processing image...');

    // Crop bottom 60 pixels to remove watermark (768x768 -> 768x708)
    const processedBuffer = await sharp(response.data)
      .extract({ left: 0, top: 0, width: 768, height: 708 })
      .toBuffer();

    // Convert binary data to base64
    const base64Image = processedBuffer.toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    console.log('Floor plan processed and generated successfully');
    res.json({ image: imageDataUrl });

  } catch (error) {
    console.error('Error generating floor plan:', error.message);

    // Check if it's a model loading error (common with free HF API)
    if (error.response && error.response.data) {
      try {
        // HF sends JSON error even with arraybuffer responseType sometimes
        const errorJson = JSON.parse(Buffer.from(error.response.data).toString());
        console.error('HF Error Data:', errorJson);

        if (errorJson.error && errorJson.error.includes('loading')) {
          return res.status(503).json({
            error: 'Model is loading. Please try again in 30 seconds.',
            details: errorJson
          });
        }
      } catch (e) {
        // Could not parse error JSON, ignore
      }
    }

    if (error.response) {
      console.error('Response status:', error.response.status);
    }

    res.status(500).json({
      error: `Error generating floor plan: ${error.message}`,
    });
  }
});

module.exports = router;
