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
    const { bedrooms, bathrooms, sqFeet, length, breadth, layoutType, archStyle, renderStyle, features: featureList, entryDirection, vastuCompliant } = details || {};

    const rawLength = parseFloat(length);
    const rawBreadth = parseFloat(breadth);
    if (!rawLength || rawLength <= 0 || !rawBreadth || rawBreadth <= 0) {
      return res.status(400).json({ error: 'Invalid dimensions provided. Length and Breadth must be greater than 0.' });
    }

    const numBedrooms = parseInt(bedrooms) || 1;
    const numBathrooms = parseInt(bathrooms) || 1;
    if (numBedrooms <= 0 || numBathrooms < 0) {
      return res.status(400).json({ error: 'Invalid room counts provided.' });
    }

    const isSketch = renderStyle === 'Sketch' || renderStyle === 'Blueprint';
    const activeModel = isSketch ? 'flux-realism' : (model || 'flux');

    // --- Build EXACT room inventory from user selections ---
    const featureIncludeMap = {
      kitchen: '[1] modern kitchen',
      livingRoom: '[1] open-plan living room with miniature scaled sofas',
      diningRoom: '[1] dining area',
      office: '[1] dedicated indoor home office room',
      garage: '[1] garage',
      balcony: '[1] balcony',
      garden: '[1] outdoor garden plot adjacent to the house',
      pool: '[1] outdoor patio with a pool'
    };
    const featureExcludeMap = {
      kitchen: 'kitchen', livingRoom: 'living room', diningRoom: 'dining room',
      office: 'office, study, workplace', garage: 'garage, cars', balcony: 'balcony', garden: 'garden, outdoor plants, landscaping, outdoors', pool: 'swimming pool, water'
    };
    const allFeatureKeys = Object.keys(featureIncludeMap);
    const selectedFeatureKeys = featureList ? featureList.split(',').map(f => f.trim()) : [];

    // Build exact room list
    const exactRooms = [];
    for (let i = 1; i <= numBedrooms; i++) {
      exactRooms.push(`Bedroom ${i} with a bed`);
    }
    for (let i = 1; i <= numBathrooms; i++) {
      exactRooms.push(`Bathroom ${i} (en-suite, directly attached to Bedroom ${i}, sharing an internal wall with a connecting door)`);
    }
    selectedFeatureKeys.forEach(key => {
      if (featureIncludeMap[key]) exactRooms.push(featureIncludeMap[key]);
    });
    const roomListStr = exactRooms.join(', ');

    // Build strict exclude list
    const excludedItems = allFeatureKeys
      .filter(key => !selectedFeatureKeys.includes(key))
      .map(key => featureExcludeMap[key]);
    excludedItems.push('stairs', 'staircase', 'second floor', 'upper level', 'roof elements', 'multi-story');
    const excludeStr = excludedItems.join(', ');

    // --- Vastu Shastra Constraints ---
    let vastuPrompt = '';
    if (vastuCompliant) {
      const vastuMap = {
        'East': 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.',
        'West': 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East or North-West.'
      };
      const cleanDirection = entryDirection ? entryDirection.trim() : 'East';
      vastuPrompt = `Strictly follow Vastu Shastra architectural principles: ${vastuMap[cleanDirection] || 'Master bedroom in South-West, Kitchen in South-East.'}`;
    }

    const cleanDir = entryDirection ? entryDirection.trim() : 'East';
    const entryContext = cleanDir ? `Main entry door facing ${cleanDir}. ${vastuPrompt}` : '';

    let finalPrompt = '';

    if (isSketch) {
      const sketchStyle = `Pure orthogonal 2D CAD floor plan, technical architectural drawing, blueprint style, stark black and white schematic, AutoCAD aesthetic, minimalist drafting. Top-down flat view ONLY. Straight geometric lines, crisp borders, solid black walls on a pure white background. NO colors. NO 3D elements. NO perspective.`;
      finalPrompt = `${sketchStyle} ${entryContext} Structure must include: ${roomListStr}. DO NOT include: ${excludeStr}. NO photorealism, NO furniture textures, NO 3D rendering, NO shading. Single level ground floor only. Space dimensions: ${rawLength} ft by ${rawBreadth} ft.`;
    } else {
      const style3d = `A photorealistic, top-down orthographic 3D architectural floor plan of a modern home. The floor plan is floating, viewed from directly above with no roof (antigravity cutaway view). The layout is a complex, multi-room structure with distinct, solid interior walls separating each section. Highly accurate architectural scaling, small precisely scaled furniture. High-end V-Ray 3D render, soft ambient lighting, clean lines.`;
      const noOutdoors = (selectedFeatureKeys.includes('garden') || selectedFeatureKeys.includes('pool') || selectedFeatureKeys.includes('balcony')) ? '' : 'NO outdoor landscaping. ';
      
      finalPrompt = `${style3d} ${entryContext} Strictly includes: ${roomListStr}. DO NOT include: ${excludeStr}. ${noOutdoors}NO ROOF. NO SECOND FLOOR. NO STAIRS. Every room separated by solid walls. Single level ground floor only. IMPORTANT: Every bathroom must be en-suite — directly attached to a bedroom with a shared internal wall and door, NOT floating or isolated.`;
    }

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
          const cleanedPrompt = finalPrompt.replace(/\r?\n|\r/g, ' ').substring(0, 1000); // Remove hidden newlines
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
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
        const cleanedPromptHF = finalPrompt.replace(/\r?\n|\r/g, ' ').substring(0, 800);
        const blob = await hf.textToImage({
          model: 'black-forest-labs/FLUX.1-schnell',
          inputs: cleanedPromptHF,
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
