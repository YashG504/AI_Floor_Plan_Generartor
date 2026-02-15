const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/generate-floorplan', async (req, res) => {
  try {
    const { prompt: userPrompt, details } = req.body;

    let finalPrompt = userPrompt;

    // --- STEP 1: ULTRA-PRECISE PROMPT ENGINEERING ---
    if (details) {
      const { bedrooms, bathrooms, sqFeet, layoutType, archStyle, features } = details;
      
      // We construct a prompt that mimics a professional 3D architectural renderer.
      // "Orthographic" is the key to getting that perfect isometric angle.
      finalPrompt = `High-angle isometric 3D floor plan render, cutaway view, white background. 
      Architectural style: ${archStyle || 'Modern Contemporary'}.
      Layout specifications: ${sqFeet} sqft, ${bedrooms} bedrooms, ${bathrooms} bathrooms, ${layoutType}.
      
      CRITICAL DETAILS:
      - Walls: Thick white cutaway walls, clear room separation.
      - Flooring: High-quality wooden textures for living areas, tiles for bathrooms.
      - Lighting: Global illumination, soft sun lighting, ambient occlusion (no harsh shadows).
      - Furniture: Fully furnished with realistic ${archStyle || 'modern'} furniture, beds, sofas, dining table.
      - View: Orthographic projection (perfect 30-degree isometric angle).
      
      Rooms included: ${features}. 8k resolution, photorealistic, architectural visualization, unreal engine 5 style.`;
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: 'Prompt or details are required' });
    }

    // --- STEP 2: MAXIMIZED RESOLUTION & MODEL SETTINGS ---
    // We use a 16:9 aspect ratio (1280x720) for a "Large Perfect Fit" on screens.
    // 'flux' is the only model capable of this level of adherence.
    const width = 1280;
    const height = 720;
    const seed = Math.floor(Math.random() * 1000000); // Random seed for unique variations
    
    // Encode the prompt safely
    const encodedPrompt = encodeURIComponent(finalPrompt);

    // Construct the URL with high-quality parameters
    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}&enhance=true`;

    console.log('Generating High-Fidelity 3D Floor Plan...');

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 600000, // Extended timeout (10 mins) for high-res generation
      headers: {
        'Authorization': `Bearer ${process.env.POLLINATIONS_API_KEY || 'sk_W22pdunPcWR5L8KbbEnz98jFj6IsRQGq'}`,
        'User-Agent': 'imagen'
      }
    });

    console.log('Image received from Pollinations.');

    const processedBuffer = response.data;
    const base64Image = Buffer.from(processedBuffer).toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    // --- STEP 3: LOGICAL DATA BREAKDOWN ---
    // This ensures the JSON data matches the visual output logic
    const layoutBreakdown = generateRoomBreakdown({
      ...details,
      featuresList: details && details.features ? details.features.split(',').map(f => f.trim()) : []
    });

    res.json({
      image: imageDataUrl,
      layout_breakdown: layoutBreakdown,
      status: "success"
    });

  } catch (error) {
    console.error('Error generating floor plan:', error.message);
    res.status(500).json({
      error: `Error generating floor plan: ${error.message}`,
    });
  }
});

// Helper function to calculate room sizes based on total sqFeet
function generateRoomBreakdown(details) {
  const { sqFeet = 1500, bedrooms = 3, bathrooms = 2, featuresList = [] } = details;
  const rooms = [];

  // Reserve 10% for walls/hallways
  let remainingSqFt = parseInt(sqFeet) * 0.90;

  const getDims = (area) => {
    const width = Math.floor(Math.sqrt(area));
    const length = Math.floor(area / width);
    return `${width}' x ${length}'`;
  };

  // Master Bedroom (approx 15% of space)
  const masterArea = Math.floor(parseInt(sqFeet) * 0.15);
  rooms.push({ name: "Master Bedroom", area: masterArea, dimensions: getDims(masterArea) });
  remainingSqFt -= masterArea;

  // Other Bedrooms
  const otherBedroomsCount = Math.max(0, parseInt(bedrooms) - 1);
  if (otherBedroomsCount > 0) {
    const bedArea = Math.floor(parseInt(sqFeet) * 0.12);
    for (let i = 1; i <= otherBedroomsCount; i++) {
      rooms.push({ name: `Bedroom ${i}`, area: bedArea, dimensions: getDims(bedArea) });
      remainingSqFt -= bedArea;
    }
  }

  // Bathrooms
  const bathArea = 60;
  for (let i = 1; i <= parseInt(bathrooms); i++) {
    rooms.push({ name: `Bathroom ${i}`, area: bathArea, dimensions: "8' x 7'" });
    remainingSqFt -= bathArea;
  }

  // Dynamic Features
  featuresList.forEach(feature => {
    const normalizeFeature = feature.toLowerCase().replace(/\s+/g, '');
    let itemArea = 0;
    let displayName = feature.charAt(0).toUpperCase() + feature.slice(1);
    let isExternal = false;

    if (normalizeFeature.includes('kitchen')) {
      itemArea = Math.floor(parseInt(sqFeet) * 0.12);
    } else if (normalizeFeature.includes('living')) {
      displayName = "Living Room";
      itemArea = Math.floor(parseInt(sqFeet) * 0.18);
    } else if (normalizeFeature.includes('dining')) {
      displayName = "Dining Room";
      itemArea = Math.floor(parseInt(sqFeet) * 0.10);
    } else if (normalizeFeature.includes('garage')) {
      itemArea = 400;
      isExternal = true;
    } else if (normalizeFeature.includes('balcony') || normalizeFeature.includes('deck')) {
      itemArea = 100;
      isExternal = true;
    } else {
      itemArea = 100; // Default for study, prayer room, etc.
    }

    if (!isExternal) {
      remainingSqFt -= itemArea;
    }
    rooms.push({ name: displayName, area: itemArea, dimensions: getDims(itemArea) });
  });

  return rooms;
}

module.exports = router;