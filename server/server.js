const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const { HfInference } = require('@huggingface/inference');

// Routes imports
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Route Middlewares
app.use('/api/auth', authRoutes);

app.post('/api/generate-floorplan', async (req, res) => {
  try {
    const { model, details } = req.body;
    const { bedrooms, bathrooms, sqFeet, layoutType, archStyle, renderStyle, features: featureList, entryDirection } = details || {};

    const numBedrooms = parseInt(bedrooms) || 1;
    const numBathrooms = parseInt(bathrooms) || 1;
    const isSketch = renderStyle === 'Sketch' || renderStyle === 'Blueprint';

    const activeModel = isSketch ? 'flux-realism' : (model || 'flux');

    let stylePrompt = '';
    if (isSketch) {
      stylePrompt = 'wide angle full view, professional 2D marketing floor plan, Nordic style, completely visible exterior walls, perfectly joined thick dark blue walls, logical room alignment, light gray flooring, top-down vector view, minimalist clean aesthetic, high-quality architectural visualization, simple furniture icons, no perspective, flat colors, white background, HUGE BOLD CLEAR TEXT LABELS INSIDE EVERY ROOM';
    } else {
      stylePrompt = 'stunning isometric 3D architectural rendering of a complete home floor plan, dollhouse view, angled cutaway perspective, high angular camera, photorealistic, raytracing, 8k resolution. ENTIRE BUILDING FITS FULLY INSIDE THE IMAGE WITH WIDE MARGINS. Outer walls fully visible inside the frame without cropping, completely zoomed out. High-quality realistic natural lighting, thick sturdy external walls, perfectly aligned rooms, seamless layout. Crisp dark studio background, highly detailed minimalist furniture, BOLD HUGE TYPOGRAPHY LABELS CLEARLY WRITTEN ON THE FLOOR OF EACH ROOM';
    }

    const spatialRooms = [];
    spatialRooms.push('central open-plan living room seamlessly connected directly perfectly joined to the kitchen');
    for (let i = 0; i < numBedrooms; i++) {
      spatialRooms.push(`well-aligned ${i === 0 ? 'Master Bedroom with wardrobe' : `Bedroom ${i + 1}`} properly connected to hallway`);
    }
    for (let i = 0; i < numBathrooms; i++) {
      spatialRooms.push(`Bathroom ${i + 1} correctly adjacent and perfectly joined to rooms`);
    }
    const spatialLayout = spatialRooms.join(', ');

    const featureContext = featureList ? `also logically place and include ${featureList}` : '';
    const entryContext = entryDirection ? `The main entry gate and driveway must be prominently facing ${entryDirection}.` : '';

    let explicitLabels = `"Living Room", "Kitchen"`;
    for (let i = 1; i <= numBedrooms; i++) explicitLabels += `, "Bedroom ${i}"`;
    for (let i = 1; i <= numBathrooms; i++) explicitLabels += `, "Bathroom ${i}"`;
    if (featureList) explicitLabels += `, ${featureList.split(',').map(f => `"${f.trim()}"`).join(', ')}`;

    const finalPrompt = `${stylePrompt}, ${archStyle || 'modern'} style architecture. ${entryContext} The floor plan exact continuous layout must include: [${spatialLayout}]. Precisely scaled perfectly aligned rooms, proper wall connections between all separate rooms without breaking walls, ${sqFeet} sqft total scale, ${layoutType} spatial flow, ${featureContext}, highly consistent structural walls. KEEP THE ENTIRE HOUSE CENTERED AND VISIBLE. CRITICAL INSTRUCTION: YOU MUST DRAW LARGE TYPOGRAPHY TEXT LABELS INSIDE EVERY SINGLE ROOM. THE TEXT MUST SPELL OUT: ${explicitLabels}.`;

    //const API_KEY = process.env.STABILITY_API_KEY;

    const rawSqFt = parseInt(sqFeet) || 1000;
    const totalSqFt = Math.max(800, Math.min(rawSqFt, 5000));

    const breakdown = [
      { name: 'Living Area', percentage: 0.30 },
      { name: 'Kitchen & Dining', percentage: 0.20 },
    ];

    for (let i = 1; i <= numBedrooms; i++) breakdown.push({ name: `Bedroom ${i}`, percentage: 0.15 / (numBedrooms / 2 || 1) });
    for (let i = 1; i <= numBathrooms; i++) breakdown.push({ name: `Bathroom ${i}`, percentage: 0.08 / (numBathrooms / 2 || 1) });
    if (featureList?.includes('garage')) breakdown.push({ name: 'Garage', percentage: 0.15 });

    const layout_breakdown = breakdown.map(room => {
      const area = Math.round(totalSqFt * room.percentage);
      const side = Math.sqrt(area);
      const dim1 = Math.round(side);
      const dim2 = Math.round(area / dim1);
      return { name: room.name, area, dimensions: `${dim1}' x ${dim2}'` };
    });

    // Pollinations AI Implementation (Commented out per request)
    /*
    const response = await axios.get(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt.substring(0, 800))}`,
      {
        params: { width: 1024, height: 1024, nologo: true, seed: Math.floor(Math.random() * 1000000) },
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        responseType: 'arraybuffer'
      }
    );
    */

    // Hugging Face Implementation
    const HF_API_KEY = process.env.HF_API_KEY;

    if (!HF_API_KEY) {
      return res.status(500).json({
        error: 'Missing Hugging Face API Key',
        details: 'Please add HF_API_KEY to your .env file.'
      });
    }

    const hf = new HfInference(HF_API_KEY);

    const blob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: finalPrompt.substring(0, 800),
      parameters: {
        guidance_scale: 7.5,
        num_inference_steps: 4
      }
    });

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:${blob.type};base64,${buffer.toString('base64')}`;

    res.json({ image: base64Image, layout_breakdown, status: 'success' });

  } catch (error) {
    let errorString = error.message;
    if (error.response?.data) {
      if (Buffer.isBuffer(error.response.data)) {
        errorString = error.response.data.toString('utf-8');
      } else if (error.response.data instanceof ArrayBuffer) {
        errorString = Buffer.from(error.response.data).toString('utf-8');
      } else {
        errorString = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      }
    }

    if (error.response?.status === 402 || error.response?.status === 503 || errorString.includes('1033') || error.response?.status === 403) {
      if (errorString.includes("1033")) {
        return res.status(503).json({
          error: 'API Error: Image generation server is currently down (Cloudflare Error 1033). Please try again later.',
          details: errorString
        });
      }
      return res.status(error.response?.status || 500).json({
        error: 'API Error: Hugging Face model is loading or rate limit hit. Please try again.',
        details: errorString
      });
    }
    console.error('Error generating floor plan:', errorString);
    res.status(500).json({ error: 'Failed to generate floor plan', details: errorString });
  }
});

app.get('/api/generate-floorplan', (req, res) => {
  res.status(405).json({
    error: 'Method Not Allowed',
    message: 'This endpoint requires a POST request with model and layout details.'
  });
});

app.get('/', (req, res) => res.send('AI Floor Plan Generator API is running.'));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} already in use.`);
    process.exit(1);
  }
});
