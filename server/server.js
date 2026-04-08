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

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// Route Middlewares
app.use('/api/auth', authRoutes);


// ════════════════════════════════════════════════════════════════════════════════
// CAD LAYOUT ENGINE  (runs server-side, returns structured room data)
// The frontend uses this JSON to draw a pixel-perfect 2D CAD floor plan on Canvas.
// No AI image generation is used for Sketch / Blueprint mode.
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Compute a smart room grid layout given all inputs.
 * Returns an array of room objects: { id, label, x, y, w, h, type }
 * All coordinates are in FEET (the frontend scales to pixels).
 *
 * Layout strategy:
 *   - Left half  → bedrooms (stacked vertically), each with en-suite bath
 *   - Right half → living / kitchen / dining / office (stacked vertically)
 *   - Garage     → attached below, left side
 *   - Balcony    → attached above, right side
 *   - Garden     → attached below, right side (dashed boundary)
 *   - Pool       → attached right, bottom corner
 */
function computeCADLayout({
  length, breadth, numBedrooms, numBathrooms,
  hasLiving, hasKitchen, hasDining, hasOffice,
  hasGarage, hasBalcony, hasGarden, hasPool,
  entryDirection, vastuCompliant
}) {
  const L = length;
  const B = breadth;
  const rooms = [];
  let idCounter = 0;
  const id = () => ++idCounter;

  // ── Vastu adjustments ────────────────────────────────────────────────────────
  // When vastu is on we just adjust which side the bedrooms go to.
  // East/default → bedrooms on West (left) side.
  // No layout flip needed since left = West in standard orientation.

  // ── Proportions ──────────────────────────────────────────────────────────────
  const leftW  = L * 0.50;   // bedroom zone width
  const rightW = L * 0.50;   // common rooms zone width
  const rightX = leftW;

  // ── RIGHT SIDE: common rooms ──────────────────────────────────────────────────
  const rightRooms = [];
  if (hasLiving)  rightRooms.push({ label: 'Living Room',  type: 'living'  });
  if (hasKitchen) rightRooms.push({ label: 'Kitchen',      type: 'kitchen' });
  if (hasDining)  rightRooms.push({ label: 'Dining Room',  type: 'dining'  });
  if (hasOffice)  rightRooms.push({ label: 'Office',       type: 'office'  });
  if (rightRooms.length === 0) rightRooms.push({ label: 'Hall / Corridor', type: 'hall' });

  const rhEach = B / rightRooms.length;
  rightRooms.forEach((r, i) => {
    rooms.push({ id: id(), label: r.label, type: r.type,
      x: rightX, y: i * rhEach, w: rightW, h: rhEach });
  });

  // ── LEFT SIDE: bedrooms + en-suite bathrooms ──────────────────────────────────
  const bedH = B / numBedrooms;
  for (let i = 0; i < numBedrooms; i++) {
    const by = i * bedH;

    // En-suite bathroom carved from bottom-right corner of bedroom
    const bathW = leftW  * 0.42;
    const bathH = bedH   * 0.48;
    const bathX = leftW  - bathW;
    const bathY = by + bedH - bathH;

    // Main bedroom area (full rect; bath is visually overlaid inside it)
    rooms.push({ id: id(), label: `Bedroom ${i + 1}`, type: 'bedroom',
      x: 0, y: by, w: leftW, h: bedH,
      bath: i < numBathrooms
        ? { x: bathX, y: bathY, w: bathW, h: bathH, label: `Bath ${i + 1}` }
        : null
    });
  }

  // ── OUTDOOR: Garage (attached below-left) ─────────────────────────────────────
  if (hasGarage) {
    const gw = L * 0.40;
    const gh = B * 0.18;
    rooms.push({ id: id(), label: 'Garage', type: 'garage',
      x: 0, y: B, w: gw, h: gh, outdoor: true });
  }

  // ── OUTDOOR: Balcony (attached above-right) ───────────────────────────────────
  if (hasBalcony) {
    const bw = L * 0.38;
    const bh = B * 0.10;
    rooms.push({ id: id(), label: 'Balcony', type: 'balcony',
      x: rightX, y: -bh, w: bw, h: bh, outdoor: true });
  }

  // ── OUTDOOR: Garden (attached below-right) ────────────────────────────────────
  if (hasGarden) {
    const gw = L * 0.45;
    const gh = B * 0.22;
    rooms.push({ id: id(), label: 'Garden', type: 'garden',
      x: rightX + rightW * 0.1, y: B, w: gw, h: gh, outdoor: true });
  }

  // ── OUTDOOR: Pool (attached right side) ──────────────────────────────────────
  if (hasPool) {
    const pw = L * 0.14;
    const ph = B * 0.35;
    rooms.push({ id: id(), label: 'Pool', type: 'pool',
      x: L, y: B * 0.55, w: pw, h: ph, outdoor: true });
  }

  // ── Entry door position ───────────────────────────────────────────────────────
  const entryDoors = {
    East:  { wall: 'right',  pos: B * 0.50 },
    West:  { wall: 'left',   pos: B * 0.50 },
    North: { wall: 'top',    pos: L * 0.50 },
    South: { wall: 'bottom', pos: L * 0.50 }
  };
  const entry = entryDoors[entryDirection] || entryDoors['East'];

  return { rooms, entry, totalW: L, totalH: B };
}


// ════════════════════════════════════════════════════════════════════════════════
// 3D PROMPT HELPERS  (only used when renderStyle is NOT Sketch / Blueprint)
// ════════════════════════════════════════════════════════════════════════════════

function build3DPrompt({
  roomCountConstraint, indoorRoomStr, outdoorAreaStr,
  hasOutdoorFeatures, excludeStr, entryContext, rawLength, rawBreadth
}) {
  const noOutdoors = hasOutdoorFeatures ? '' : 'NO outdoor landscaping, NO garden, NO external areas. ';
  const outdoorSection = hasOutdoorFeatures
    ? `OUTDOOR AREAS outside the house boundary walls as separate open-air zones (NOT inside any room): ${outdoorAreaStr}.`
    : '';

  return [
    `${roomCountConstraint}`,
    'Photorealistic top-down orthographic 3D architectural floor plan of a modern single-story home.',
    'Cutaway view from directly above — no roof.',
    'Distinct solid interior walls separating each room.',
    'Precisely scaled miniature 3D furniture.',
    'V-Ray render, soft ambient lighting, clean lines.',
    entryContext || '',
    `INDOOR ROOMS inside the house walls: ${indoorRoomStr}.`,
    outdoorSection,
    noOutdoors,
    `DO NOT include: ${excludeStr}.`,
    'NO ROOF. NO SECOND FLOOR. NO STAIRS. Single level ground floor only.',
    'Every bathroom must be en-suite attached to a bedroom with a shared wall and door.',
    `CRITICAL: ${roomCountConstraint}`
  ].filter(Boolean).join(' ');
}


// ════════════════════════════════════════════════════════════════════════════════
// 3D IMAGE GENERATION  (HuggingFace FLUX → Pollinations fallback)
// ════════════════════════════════════════════════════════════════════════════════

async function generate3DImage(hf, prompt) {
  const cleanPrompt = prompt.replace(/\r?\n|\r/g, ' ').substring(0, 2000);

  // Strategy 1: FLUX.1-schnell
  try {
    console.log('3D strategy 1: HF FLUX.1-schnell...');
    const blob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-schnell',
      inputs: cleanPrompt,
      parameters: {
        guidance_scale: 7.5,
        num_inference_steps: 8,
        width: 1024,
        height: 1024
      }
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.warn('FLUX.1-schnell failed:', err.message);
  }

  // Strategy 2: Pollinations fallback
  try {
    console.log('3D strategy 2: Pollinations fallback...');
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&nologo=true&enhance=true&seed=${seed}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer',
      timeout: 25000
    });
    return `data:image/jpeg;base64,${Buffer.from(response.data, 'binary').toString('base64')}`;
  } catch (err) {
    console.warn('Pollinations 3D fallback failed:', err.message);
  }

  throw new Error('All 3D image generation strategies failed.');
}


// ════════════════════════════════════════════════════════════════════════════════
// MAIN ROUTE
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/generate-floorplan', async (req, res) => {
  try {
    const { model, details } = req.body;
    const {
      bedrooms, bathrooms, sqFeet, length, breadth,
      layoutType, archStyle, renderStyle, features: featureList,
      entryDirection, vastuCompliant
    } = details || {};

    // ── Validation ────────────────────────────────────────────────────────────
    const rawLength  = parseFloat(length);
    const rawBreadth = parseFloat(breadth);
    if (!rawLength || rawLength <= 0 || !rawBreadth || rawBreadth <= 0) {
      return res.status(400).json({ error: 'Invalid dimensions. Length and Breadth must be > 0.' });
    }
    const numBedrooms  = Math.max(1, parseInt(bedrooms)  || 1);
    const numBathrooms = Math.max(1, parseInt(bathrooms) || 1);

    // ── Feature flags ─────────────────────────────────────────────────────────
    const selectedFeatureKeys = featureList ? featureList.split(',').map(f => f.trim()) : [];
    const has = key => selectedFeatureKeys.includes(key);

    const hasLiving  = has('livingRoom');
    const hasKitchen = has('kitchen');
    const hasDining  = has('diningRoom');
    const hasOffice  = has('office');
    const hasGarage  = has('garage');
    const hasBalcony = has('balcony');
    const hasGarden  = has('garden');
    const hasPool    = has('pool');

    // ── Render mode ───────────────────────────────────────────────────────────
    const isCAD = renderStyle === 'Sketch' || renderStyle === 'Blueprint';

    // ── Room area breakdown (shared between CAD and 3D) ───────────────────────
    const rawSqFt   = parseInt(sqFeet) || 1000;
    const totalSqFt = Math.max(800, Math.min(rawSqFt, 5000));

    const breakdown = [];
    if (hasLiving)  breakdown.push({ name: 'Living Area',  percentage: 0.25 });
    if (hasKitchen) breakdown.push({ name: 'Kitchen',      percentage: 0.12 });
    if (hasDining)  breakdown.push({ name: 'Dining Room',  percentage: 0.10 });
    for (let i = 1; i <= numBedrooms;  i++) breakdown.push({ name: `Bedroom ${i}`,  percentage: 0.15 / Math.max(numBedrooms  / 2, 1) });
    for (let i = 1; i <= numBathrooms; i++) breakdown.push({ name: `Bathroom ${i}`, percentage: 0.08 / Math.max(numBathrooms / 2, 1) });
    if (hasOffice)  breakdown.push({ name: 'Office',   percentage: 0.08 });
    if (hasGarage)  breakdown.push({ name: 'Garage',   percentage: 0.15 });
    if (hasBalcony) breakdown.push({ name: 'Balcony',  percentage: 0.05 });
    if (hasGarden)  breakdown.push({ name: 'Garden',   percentage: 0.10 });
    if (hasPool)    breakdown.push({ name: 'Pool',     percentage: 0.10 });

    const layout_breakdown = breakdown.map(room => {
      const area = Math.round(totalSqFt * room.percentage);
      const side = Math.sqrt(area);
      const d1   = Math.round(side);
      const d2   = Math.round(area / d1);
      return { name: room.name, area, dimensions: `${d1}' x ${d2}'` };
    });

    // ══════════════════════════════════════════════════════════════════════════
    //  CAD MODE — no AI image, return structured layout data for frontend render
    // ══════════════════════════════════════════════════════════════════════════
    if (isCAD) {
      console.log('\n=== CAD MODE (programmatic render) ===');
      console.log('Dimensions:', rawLength, 'x', rawBreadth);
      console.log('Bedrooms:', numBedrooms, '| Bathrooms:', numBathrooms);
      console.log('Features:', selectedFeatureKeys);
      console.log('Entry:', entryDirection, '| Vastu:', vastuCompliant);
      console.log('======================================\n');

      const cadLayout = computeCADLayout({
        length:       rawLength,
        breadth:      rawBreadth,
        numBedrooms,
        numBathrooms,
        hasLiving,
        hasKitchen,
        hasDining,
        hasOffice,
        hasGarage,
        hasBalcony,
        hasGarden,
        hasPool,
        entryDirection: (entryDirection || 'East').trim(),
        vastuCompliant: !!vastuCompliant
      });

      return res.json({
        renderMode:      'cad',          // ← tells frontend to draw with Canvas
        image:           null,            // no AI image in CAD mode
        cadLayout,                        // structured room data
        layout_breakdown,
        length:          rawLength,
        breadth:         rawBreadth,
        entryDirection:  (entryDirection || 'East').trim(),
        vastuCompliant:  !!vastuCompliant,
        renderStyle,
        status:          'success'
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  3D MODE — AI image generation (FLUX / Pollinations)
    // ══════════════════════════════════════════════════════════════════════════

    // Feature description maps for prompt building
    const indoorFeatureMap = {
      kitchen:    'modern kitchen with countertops, sink, stove, and cabinets',
      livingRoom: 'spacious living room with sofas, coffee table, and TV unit',
      diningRoom: 'dining area with dining table and chairs',
      office:     'home office with desk, chair, monitor, and bookshelf'
    };
    const outdoorFeatureMap = {
      garage:  'attached garage with car, positioned outside the main house walls',
      balcony: 'open-air balcony with railing, extending outward from exterior wall',
      garden:  'lush garden with grass, flower beds, and trees outside the house boundary',
      pool:    'rectangular swimming pool in open patio area outside the house boundary'
    };
    const featureExcludeMap = {
      kitchen:    'kitchen',
      livingRoom: 'living room',
      diningRoom: 'dining room',
      office:     'office, study',
      garage:     'garage, cars',
      balcony:    'balcony',
      garden:     'garden, outdoor plants, grass',
      pool:       'swimming pool, pool'
    };

    const allFeatureKeys = Object.keys({ ...indoorFeatureMap, ...outdoorFeatureMap });

    // Indoor room list
    const indoorRooms = [];
    for (let i = 1; i <= numBedrooms;  i++) indoorRooms.push(`Bedroom ${i} with bed and wardrobe`);
    for (let i = 1; i <= numBathrooms; i++) indoorRooms.push(`Bathroom ${i} en-suite attached to Bedroom ${i}`);
    selectedFeatureKeys.forEach(key => { if (indoorFeatureMap[key]) indoorRooms.push(indoorFeatureMap[key]); });

    // Outdoor area list
    const outdoorAreas = [];
    selectedFeatureKeys.forEach(key => { if (outdoorFeatureMap[key]) outdoorAreas.push(outdoorFeatureMap[key]); });

    const indoorRoomStr      = indoorRooms.join(', ');
    const outdoorAreaStr     = outdoorAreas.join(', ');
    const hasOutdoorFeatures = outdoorAreas.length > 0;

    // Exclude list
    const excludedItems = allFeatureKeys
      .filter(key => !selectedFeatureKeys.includes(key))
      .map(key => featureExcludeMap[key]);
    excludedItems.push('stairs', 'staircase', 'second floor', 'upper level', 'roof', 'multi-story');
    const excludeStr = excludedItems.join(', ');

    // Room count constraint string
    const roomCountConstraint =
      `EXACTLY ${numBedrooms} bedroom${numBedrooms > 1 ? 's' : ''} and EXACTLY ${numBathrooms} bathroom${numBathrooms > 1 ? 's' : ''}`;

    // Vastu
    let vastuPrompt = '';
    if (vastuCompliant) {
      const vastuMap = {
        East:  'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.',
        West:  'Master bedroom in South-West, Kitchen in South-East, Living room in North-West.',
        North: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.',
        South: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.'
      };
      const dir = (entryDirection || 'East').trim();
      vastuPrompt = `Follow Vastu Shastra: ${vastuMap[dir] || 'Master bedroom in South-West, Kitchen in South-East.'}`;
    }

    const cleanDir    = (entryDirection || 'East').trim();
    const entryContext = [
      `Main entry door facing ${cleanDir}.`,
      `CRITICAL: Place the main entry gate/door on the ${cleanDir} side of the house boundary.`,
      vastuPrompt
    ].filter(Boolean).join(' ');

    const finalPrompt = build3DPrompt({
      roomCountConstraint, indoorRoomStr, outdoorAreaStr,
      hasOutdoorFeatures, excludeStr, entryContext,
      rawLength, rawBreadth
    });

    console.log('\n=== 3D AI GENERATION MODE ===');
    console.log('Render style:', renderStyle);
    console.log('Features:', selectedFeatureKeys);
    console.log('Indoor rooms:', indoorRooms);
    console.log('Outdoor areas:', outdoorAreas);
    console.log('Prompt length:', finalPrompt.length);
    console.log('Prompt:', finalPrompt);
    console.log('=============================\n');

    // HF key check
    const HF_API_KEY = process.env.HF_API_KEY;
    if (!HF_API_KEY) {
      return res.status(500).json({ error: 'Missing HF_API_KEY in environment.' });
    }
    const hf = new HfInference(HF_API_KEY);

    // Generate image
    let base64Image = await generate3DImage(hf, finalPrompt);

    // Optional caption-based validation
    let validationPassed = true;
    try {
      const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');
      const imageBlob   = new Blob([imageBuffer], { type: 'image/jpeg' });
      const caption     = await hf.imageToText({
        model: 'Salesforce/blip-image-captioning-large',
        data:  imageBlob
      });
      const captionText = (caption?.generated_text || '').toLowerCase();
      console.log('Caption:', captionText);

      if (captionText.includes('two story') || captionText.includes('stair')) {
        validationPassed = false;
        console.log('Validation failed — regenerating with reinforced prompt...');
        const reinforced = finalPrompt + ' ABSOLUTELY NO STAIRS. SINGLE FLOOR ONLY. NO SECOND LEVEL.';
        base64Image = await generate3DImage(hf, reinforced);
      }
    } catch (valErr) {
      console.warn('Validation skipped:', valErr.message);
    }

    return res.json({
      renderMode:      '3d',
      image:           base64Image,
      layout_breakdown,
      length:          parseInt(length) || 40,
      breadth:         parseInt(breadth) || 45,
      entryDirection:  cleanDir,
      prompt_used:     finalPrompt.substring(0, 200) + '...',
      validation:      validationPassed ? 'passed' : 'retried',
      status:          'success'
    });

  } catch (error) {
    // Unified error handler
    let errorString = error.message;
    if (error.response?.data) {
      if (Buffer.isBuffer(error.response.data))
        errorString = error.response.data.toString('utf-8');
      else if (error.response.data instanceof ArrayBuffer)
        errorString = Buffer.from(error.response.data).toString('utf-8');
      else
        errorString = typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data);
    }

    const status = error.response?.status;
    if (status === 402 || status === 503 || status === 403 || errorString.includes('1033')) {
      return res.status(status || 503).json({
        error: errorString.includes('1033')
          ? 'Image generation server is down (Cloudflare 1033). Try again later.'
          : 'Hugging Face model is loading or rate limit hit. Try again.',
        details: errorString
      });
    }

    console.error('Error generating floor plan:', errorString);
    res.status(500).json({ error: 'Failed to generate floor plan', details: errorString });
  }
});

app.get('/api/generate-floorplan', (req, res) => {
  res.status(405).json({ error: 'Method Not Allowed', message: 'Use POST with model and layout details.' });
});

app.get('/', (req, res) => res.send('AI Floor Plan Generator API is running.'));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
server.on('error', err => {
  if (err.code === 'EADDRINUSE') { console.error(`Port ${PORT} in use.`); process.exit(1); }
});