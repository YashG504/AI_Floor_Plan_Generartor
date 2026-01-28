const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');


router.post('/generate-floorplan', async (req, res) => {
  try {
    const { prompt: userPrompt, details } = req.body;

  
    let finalPrompt = userPrompt;
    if (details) {
      const { bedrooms, bathrooms, sqFeet, layoutType, archStyle, features } = details;
      finalPrompt = `Top-down floor plan, architectural blueprint style, ${sqFeet} sqft, ${bedrooms} bedrooms, ${bathrooms} bathrooms, ${layoutType}, ${archStyle}. Distinct room labels. Clear wall lines. Spaces: ${features}. High contrast, white background.`;
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Prompt or details are required' });
    }

   
    const encodedPrompt = encodeURIComponent(finalPrompt + " text labels, measurements, dimensions, technical drawing, 8k");
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&model=flux`;

    console.log('Generating floor plan via Pollinations:', url);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 300000, // 5 minutes (effectively no timeout for this use case)
    });

    console.log('Pollinations response received, processing image...');

    // Crop bottom 60 pixels to remove watermark (768x768 -> 768x708)
    const processedBuffer = await sharp(response.data)
      .extract({ left: 0, top: 0, width: 768, height: 708 })
      .toBuffer();

    const base64Image = processedBuffer.toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    // GENERATE ROOM BREAKDOWN
    // Parse features from the comma-separated string provided by the client
    const layoutBreakdown = generateRoomBreakdown({
      ...details,
      featuresList: details && details.features ? details.features.split(',').map(f => f.trim()) : []
    });

    console.log('Floor plan processed and generated successfully');
    res.json({
      image: imageDataUrl,
      layout_breakdown: layoutBreakdown
    });

  } catch (error) {
    console.error('Error generating floor plan:', error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Generation timed out. The model is taking longer than expected.'
      });
    }

    if (error.response && error.response.data) {
      try {
        const errorJson = JSON.parse(Buffer.from(error.response.data).toString());
        if (errorJson.error && errorJson.error.includes('loading')) {
          return res.status(503).json({
            error: 'Model is loading. Please try again in 30 seconds.',
            details: errorJson
          });
        }
      } catch (e) { }
    }

    res.status(500).json({
      error: `Error generating floor plan: ${error.message}`,
    });
  }
});

function generateRoomBreakdown(details) {
  const { sqFeet = 1500, bedrooms = 3, bathrooms = 2, featuresList = [] } = details;
  const rooms = [];

  // Base internal area calculation
  let remainingSqFt = parseInt(sqFeet) * 0.90; // Keep 10% for walls/circulation

  // Helper to generate dimensions roughly matching an area
  const getDims = (area) => {
    const width = Math.floor(Math.sqrt(area));
    const length = Math.floor(area / width);
    return `${width}' x ${length}'`;
  }

  // 1. Always add Bedrooms
  // Master Bedroom (approx 15% of total)
  const masterArea = Math.floor(parseInt(sqFeet) * 0.15);
  rooms.push({ name: "Master Bedroom", area: masterArea, dimensions: getDims(masterArea) });
  remainingSqFt -= masterArea;

  // Other Bedrooms
  const otherBedroomsCount = Math.max(0, parseInt(bedrooms) - 1);
  if (otherBedroomsCount > 0) {
    // Allocate about 12% per extra bedroom
    const bedArea = Math.floor(parseInt(sqFeet) * 0.12);
    for (let i = 1; i <= otherBedroomsCount; i++) {
      rooms.push({ name: `Bedroom ${i}`, area: bedArea, dimensions: getDims(bedArea) });
      remainingSqFt -= bedArea;
    }
  }

  // 2. Always add Bathrooms
  const bathArea = 60; // Standard size
  for (let i = 1; i <= parseInt(bathrooms); i++) {
    rooms.push({ name: `Bathroom ${i}`, area: bathArea, dimensions: "8' x 7'" });
    remainingSqFt -= bathArea;
  }

  // 3. Process Selected Features
  // Map common features to approximate sizes relative to total sqFeet or fixed sizes
  // Note: we use the feature names exactly as they might come from the client or mapped nicely

  featuresList.forEach(feature => {
    const normalizeFeature = feature.toLowerCase().replace(/\s+/g, '');
    let itemArea = 0;
    let displayName = feature; // Default to utilizing the provided name
    let isExternal = false;

    // Capitalize first letter for display if it's lowercase
    displayName = feature.charAt(0).toUpperCase() + feature.slice(1);

    if (normalizeFeature.includes('kitchen')) {
      itemArea = Math.floor(parseInt(sqFeet) * 0.12);
    } else if (normalizeFeature.includes('living')) {
      displayName = "Living Room";
      itemArea = Math.floor(parseInt(sqFeet) * 0.18);
    } else if (normalizeFeature.includes('dining')) {
      displayName = "Dining Room";
      itemArea = Math.floor(parseInt(sqFeet) * 0.10);
    } else if (normalizeFeature.includes('office')) {
      itemArea = Math.floor(parseInt(sqFeet) * 0.08);
    } else if (normalizeFeature.includes('garage')) {
      itemArea = 400; // Standard 2-car
      isExternal = true; // Usually doesn't count against internal sqft
    } else if (normalizeFeature.includes('balcony')) {
      itemArea = 80;
      isExternal = true;
    } else if (normalizeFeature.includes('garden')) {
      itemArea = 500; // Arbitrary nice size
      isExternal = true;
    } else if (normalizeFeature.includes('pool')) {
      itemArea = 450;
      isExternal = true;
    } else {
      // Fallback for unknown features
      itemArea = 100;
    }

    // Only subtract from remaining interior sqft if it's an internal room
    if (!isExternal) {
      // If we represent it, subtract it, but don't go below zero logic (just let it be loose)
      remainingSqFt -= itemArea;
    }

    // Avoid duplicates if logic above somehow added them (though we removed hardcoded kitchen/living)
    // We only have Bedrooms/Bathrooms hardcoded now.
    rooms.push({ name: displayName, area: itemArea, dimensions: getDims(itemArea) });
  });

  return rooms;
}

module.exports = router;
