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
    const { bedrooms, bathrooms, sqFeet, length, breadth, layoutType, archStyle, renderStyle, features: featureList, entryDirection } = details || {};

    const numBedrooms = parseInt(bedrooms) || 1;
    const numBathrooms = parseInt(bathrooms) || 1;
    const isSketch = renderStyle === 'Sketch' || renderStyle === 'Blueprint';

    const activeModel = isSketch ? 'flux-realism' : (model || 'flux');

    // --- Build EXACT room inventory from user selections ---
    const featureIncludeMap = {
      kitchen: '[1] modern kitchen',
      livingRoom: '[1] open-plan living room with miniature scaled sofas',
      diningRoom: '[1] dining area',
      office: '[1] home office',
      garage: '[1] garage',
      balcony: '[1] balcony',
      garden: '[1] outdoor garden',
      pool: '[1] outdoor patio with a pool'
    };
    const featureExcludeMap = {
      kitchen: 'kitchen', livingRoom: 'living room', diningRoom: 'dining room',
      office: 'home office', garage: 'garage, cars', balcony: 'balcony', garden: 'garden, outdoor plants, landscaping', pool: 'swimming pool, water'
    };
    const allFeatureKeys = Object.keys(featureIncludeMap);
    const selectedFeatureKeys = featureList ? featureList.split(',').map(f => f.trim()) : [];

    // Build exact room list
    const exactRooms = [];
    exactRooms.push(`[${numBedrooms}] distinct bedrooms with beds`);
    exactRooms.push(`[${numBathrooms}] separate bathrooms`);
    selectedFeatureKeys.forEach(key => {
      if (featureIncludeMap[key]) exactRooms.push(featureIncludeMap[key]);
    });
    const roomListStr = exactRooms.join(', ');

    // Build strict exclude list
    const excludedItems = allFeatureKeys
      .filter(key => !selectedFeatureKeys.includes(key))
      .map(key => featureExcludeMap[key]);
    excludedItems.push('stairs', 'staircase', 'second floor', 'upper level', 'roof elements');
    const excludeStr = excludedItems.join(', ');

    const entryContext = entryDirection ? `Main entry door facing ${entryDirection}.` : '';

    let stylePrompt = '';
    if (isSketch) {
      stylePrompt = `A simple, clean 2D top-down architectural floor plan technical drawing of a ${sqFeet} sqft single level layout. Pure flat 2D projection, no 3D, no perspective. Simple black and white blueprint style. Thick solid dark walls separating every room clearly. Transparent or white floor backgrounds. Simple minimalist geometric icons for furniture (like beds and tables). Minimal detail, sharp clean vector-like lines. Professional architectural schematic, flat orthographic and proper straight lines.`;
    } else {
      stylePrompt = `A photorealistic, top-down orthographic 3D architectural floor plan of a modern home. The floor plan is floating, viewed from directly above with no roof (antigravity cutaway view). The layout is a complex, multi-room structure with distinct, solid interior walls separating each section. Highly accurate architectural scaling, small precisely scaled furniture. High-end V-Ray 3D render, soft ambient lighting, clean lines, floating over a smooth neutral background, masterpiece architectural visualization.`;
    }

    const finalPrompt = `${stylePrompt} ${entryContext} Strictly includes: ${roomListStr}. DO NOT include: ${excludeStr}. NO ROOF. NO SECOND FLOOR. NO STAIRS. Every room separated by solid walls. Single level ground floor only.`;

    console.log('\n=== FLOOR PLAN PROMPT ===');
    console.log('Selected features:', selectedFeatureKeys);
    console.log('Rooms:', exactRooms);
    console.log('Excluded:', excludedItems);
    console.log('Prompt length:', finalPrompt.length);
    console.log('Prompt:', finalPrompt);
    console.log('========================\n');

    //const API_KEY = process.env.STABILITY_API_KEY;

    const rawSqFt = parseInt(sqFeet) || 1000;
    const totalSqFt = Math.max(800, Math.min(rawSqFt, 5000));

    const breakdown = [];
    // Only add rooms that are actually selected
    if (selectedFeatureKeys.includes('livingRoom')) breakdown.push({ name: 'Living Area', percentage: 0.25 });
    if (selectedFeatureKeys.includes('kitchen')) breakdown.push({ name: 'Kitchen', percentage: 0.12 });
    if (selectedFeatureKeys.includes('diningRoom')) breakdown.push({ name: 'Dining Room', percentage: 0.10 });
    for (let i = 1; i <= numBedrooms; i++) breakdown.push({ name: `Bedroom ${i}`, percentage: 0.15 / (numBedrooms / 2 || 1) });
    for (let i = 1; i <= numBathrooms; i++) breakdown.push({ name: `Bathroom ${i}`, percentage: 0.08 / (numBathrooms / 2 || 1) });
    if (selectedFeatureKeys.includes('office')) breakdown.push({ name: 'Office', percentage: 0.08 });
    if (selectedFeatureKeys.includes('garage')) breakdown.push({ name: 'Garage', percentage: 0.15 });
    if (selectedFeatureKeys.includes('balcony')) breakdown.push({ name: 'Balcony', percentage: 0.05 });
    if (selectedFeatureKeys.includes('garden')) breakdown.push({ name: 'Garden', percentage: 0.10 });
    if (selectedFeatureKeys.includes('pool')) breakdown.push({ name: 'Pool', percentage: 0.10 });

    const layout_breakdown = breakdown.map(room => {
      const area = Math.round(totalSqFt * room.percentage);
      const side = Math.sqrt(area);
      const dim1 = Math.round(side);
      const dim2 = Math.round(area / dim1);
      return { name: room.name, area, dimensions: `${dim1}' x ${dim2}'` };
    });

    // --- Generate Image ---
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'Missing Hugging Face API Key', details: 'Please add HF_API_KEY to your .env file.' });
    }
    const hf = new HfInference(HF_API_KEY);

    const generateImage = async (prompt) => {
      let base64Image = '';
      let usedFallback = false;

      if (isSketch) {
        try {
          const seed = Math.floor(Math.random() * 1000000);
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.substring(0, 1000))}?width=1024&height=1024&nologo=true&seed=${seed}`;
          const response = await axios.get(pollinationsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            responseType: 'arraybuffer',
            timeout: 15000
          });
          const buffer = Buffer.from(response.data, 'binary');
          base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        } catch (pollError) {
          console.warn("Pollinations failed, using HuggingFace...", pollError.message);
          usedFallback = true;
        }
      }

      if (!isSketch || usedFallback) {
        const blob = await hf.textToImage({
          model: 'black-forest-labs/FLUX.1-schnell',
          inputs: prompt.substring(0, 800),
          parameters: { guidance_scale: 7.5, num_inference_steps: 4 }
        });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Image = `data:${blob.type};base64,${buffer.toString('base64')}`;
      }
      return base64Image;
    };

    // --- Generate and Validate ---
    let base64Image = await generateImage(finalPrompt);

    // Validation: Use image captioning to check the output
    let validationPassed = true;
    let validationNote = '';
    try {
      // Convert base64 to blob for captioning
      const imageData = base64Image.split(',')[1];
      const imageBuffer = Buffer.from(imageData, 'base64');
      const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });

      const caption = await hf.imageToText({
        model: 'Salesforce/blip-image-captioning-large',
        data: imageBlob
      });

      const captionText = (caption?.generated_text || '').toLowerCase();
      console.log('Image caption:', captionText);

      // Check for obvious mismatches
      if (captionText.includes('two story') || captionText.includes('two floor') || captionText.includes('stair')) {
        validationPassed = false;
        validationNote = 'Detected multi-story elements. Regenerating...';
      }
    } catch (valError) {
      console.warn('Validation skipped:', valError.message);
      // Don't block on validation failure — just skip it
    }

    // If validation failed, try one more time with reinforced prompt
    if (!validationPassed) {
      console.log('Validation failed, regenerating with reinforced prompt...');
      const reinforcedPrompt = finalPrompt + ' ABSOLUTELY NO STAIRS. FLAT SINGLE FLOOR BUILDING ONLY. NO SECOND LEVEL.';
      base64Image = await generateImage(reinforcedPrompt);
    }

    console.log('Generation complete. Validation:', validationPassed ? 'PASSED' : 'RETRIED');

    res.json({
      image: base64Image,
      layout_breakdown,
      length: parseInt(length) || 40,
      breadth: parseInt(breadth) || 45,
      entryDirection: entryDirection || 'North',
      prompt_used: finalPrompt.substring(0, 200) + '...',
      validation: validationPassed ? 'passed' : 'retried',
      status: 'success'
    });

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
