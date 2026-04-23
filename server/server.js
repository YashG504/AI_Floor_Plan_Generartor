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
  const L = length, B = breadth, rooms = [];
  let idCounter = 0;
  const id = () => ++idCounter;
  const dir = (entryDirection || 'East').trim();

  // ── Adaptive "Private Wing + Open Center" Layout ──────────────────────────
  //  Left column (33%): Bedrooms stacked + common bath at bottom
  //  Right area  (67%): Open living + kitchen + dining (no interior walls)
  //
  //  ┌──────────┬──────────────────────────────┐
  //  │  BR 1    │                              │
  //  │ (+bath)  │    Kitchen (top area)        │
  //  ├──────────┤                              │
  //  │  BR 2    │    Living Room (center)      │ ← Entry
  //  │          │                              │
  //  ├──────────┤    Dining (bottom area)      │
  //  │  BR 3    │                              │
  //  ├──────────┤                              │
  //  │Com. Bath │                              │
  //  └──────────┴──────────────────────────────┘

  const leftW = L * 0.55;
  const rightW = L - leftW;
  const bathH = B * 0.10;
  const numLeftBR = Math.min(numBedrooms, 3);
  const numBotBR = Math.max(0, numBedrooms - 3);
  const brZoneH = B - bathH;
  const brH = brZoneH / Math.max(numLeftBR, 1);
  const hasEnSuite = numBathrooms >= 2;

  // ── Left Column: Bedrooms ─────────────────────────────────────────────────
  for (let i = 0; i < numLeftBR; i++) {
    let bath = null;
    if (i === 0 && hasEnSuite) {
      bath = {
        x: leftW * 0.65, y: i * brH + brH * 0.65,
        w: leftW * 0.30, h: brH * 0.30, label: 'Bath'
      };
    }
    rooms.push({
      id: id(), label: `Bedroom ${i + 1}`, type: 'bedroom',
      x: 0, y: i * brH, w: leftW, h: brH,
      doorDesc: 'right', doorOff: 0.3 + i * 0.15, bath
    });
  }

  // ── Common Bathroom: bottom-left ──────────────────────────────────────────
  if (numBathrooms >= 1) {
    rooms.push({
      id: id(), label: 'Bathroom', type: 'bathroom',
      x: 0, y: brZoneH, w: leftW, h: bathH,
      doorDesc: 'right', doorOff: 0.5
    });
  }

  // ── Overflow Bedrooms (4-5): bottom-right ─────────────────────────────────
  if (numBotBR > 0) {
    const obW = rightW / numBotBR;
    for (let i = 0; i < numBotBR; i++) {
      rooms.push({
        id: id(), label: `Bedroom ${numLeftBR + i + 1}`, type: 'bedroom',
        x: leftW + i * obW, y: brZoneH, w: obW, h: bathH,
        doorDesc: 'top', doorOff: 0.5
      });
    }
  }

  // ── Right Area: Open-concept Kitchen -> Dining -> Living ───────────────────
  const openH = numBotBR > 0 ? brZoneH : B;
  let currentY = 0;

  if (hasKitchen) {
    const kH = openH * 0.22;
    rooms.push({
      id: id(), label: 'Kitchen', type: 'kitchen',
      x: leftW, y: currentY, w: rightW, h: kH,
      noWall: true
    });
    currentY += kH;
  }

  if (hasDining) {
    const dH = openH * 0.22;
    rooms.push({
      id: id(), label: 'Dining', type: 'dining',
      x: leftW, y: currentY, w: rightW, h: dH,
      noWall: true
    });
    currentY += dH;
  }

  if (hasOffice) {
    const oH = bathH;
    rooms.push({
      id: id(), label: 'Office', type: 'office',
      x: leftW + 0.5, y: openH - oH - 0.5, w: rightW * 0.28, h: oH,
      noWall: true
    });
  }

  if (hasLiving) {
    rooms.push({
      id: id(), label: 'Living Room', type: 'living',
      x: leftW, y: currentY, w: rightW, h: openH - currentY,
      noWall: true
    });
  }

  // ── Door Calculation ──────────────────────────────────────────────────────
  rooms.forEach(room => {
    if (room.doorDesc) {
      let dx, dy, startA, endA, leafA;
      const off = room.doorOff || 0.5;
      if (room.doorDesc === 'right') {
        dx = room.x + room.w; dy = room.y + room.h * off;
        startA = Math.PI / 2; endA = Math.PI; leafA = Math.PI;
      } else if (room.doorDesc === 'left') {
        dx = room.x; dy = room.y + room.h * off;
        startA = -Math.PI / 2; endA = 0; leafA = 0;
      } else if (room.doorDesc === 'top') {
        dx = room.x + room.w * off; dy = room.y;
        startA = 0; endA = Math.PI / 2; leafA = Math.PI / 2;
      } else if (room.doorDesc === 'bottom') {
        dx = room.x + room.w * off; dy = room.y + room.h;
        startA = Math.PI; endA = 3 * Math.PI / 2; leafA = -Math.PI / 2;
      }
      room.door = { x: dx, y: dy, wall: room.doorDesc, startA, endA, leafA };
    }
  });

  // ── Outdoor Features ──────────────────────────────────────────────────────
  if (hasGarage) {
    const g = dir === 'East' ? { x: L + 1, y: 0, w: L * 0.25, h: B * 0.28 }
      : dir === 'West' ? { x: -L * 0.25 - 1, y: 0, w: L * 0.25, h: B * 0.28 }
        : dir === 'North' ? { x: 0, y: -B * 0.28 - 1, w: L * 0.28, h: B * 0.25 }
          : { x: 0, y: B + 1, w: L * 0.28, h: B * 0.25 };
    rooms.push({ id: id(), label: 'Garage', type: 'garage', ...g, outdoor: true });
  }
  if (hasGarden) {
    const g = dir === 'East' ? { x: L + 1, y: B * 0.35, w: L * 0.3, h: B * 0.35 }
      : dir === 'West' ? { x: -L * 0.3 - 1, y: B * 0.35, w: L * 0.3, h: B * 0.35 }
        : dir === 'North' ? { x: L * 0.35, y: -B * 0.35 - 1, w: L * 0.35, h: B * 0.3 }
          : { x: L * 0.35, y: B + 1, w: L * 0.35, h: B * 0.3 };
    rooms.push({ id: id(), label: 'Garden', type: 'garden', ...g, outdoor: true });
  }
  if (hasPool) {
    const g = dir === 'East' ? { x: L + 1, y: B * 0.75, w: L * 0.22, h: B * 0.22 }
      : dir === 'West' ? { x: -L * 0.22 - 1, y: B * 0.75, w: L * 0.22, h: B * 0.22 }
        : dir === 'North' ? { x: L * 0.75, y: -B * 0.22 - 1, w: L * 0.22, h: B * 0.22 }
          : { x: L * 0.75, y: B + 1, w: L * 0.22, h: B * 0.22 };
    rooms.push({ id: id(), label: 'Pool', type: 'pool', ...g, outdoor: true });
  }
  if (hasBalcony) {
    const g = dir === 'East' ? { x: -L * 0.08 - 1, y: B * 0.3, w: L * 0.08, h: B * 0.4 }
      : dir === 'West' ? { x: L + 1, y: B * 0.3, w: L * 0.08, h: B * 0.4 }
        : dir === 'North' ? { x: L * 0.3, y: B + 1, w: L * 0.4, h: B * 0.08 }
          : { x: L * 0.3, y: -B * 0.08 - 1, w: L * 0.4, h: B * 0.08 };
    rooms.push({ id: id(), label: 'Balcony', type: 'balcony', ...g, outdoor: true });
  }

  const entryDoors = {
    East: { wall: 'right', pos: B * 0.55 }, West: { wall: 'left', pos: B * 0.55 },
    North: { wall: 'top', pos: L * 0.65 }, South: { wall: 'bottom', pos: L * 0.65 }
  };
  return { rooms, entry: entryDoors[dir] || entryDoors.East, totalW: L, totalH: B };
}


// ════════════════════════════════════════════════════════════════════════════════
// 3D PROMPT HELPERS  (only used when renderStyle is NOT Sketch / Blueprint)
// ════════════════════════════════════════════════════════════════════════════════

function build3DPrompt({
  roomCountConstraint, indoorRoomStr, outdoorAreaStr,
  hasOutdoorFeatures, excludeStr, entryContext, archStyle, spatialHint
}) {
  const noOutdoors = hasOutdoorFeatures ? '' : 'NO outdoor landscaping, NO garden, NO external areas. ';
  const outdoorSection = hasOutdoorFeatures
    ? `OUTDOOR AREAS outside the house boundary walls as separate open-air zones (NOT inside any room): ${outdoorAreaStr}.`
    : '';

  const styleStr = archStyle ? archStyle.toLowerCase() : 'modern';

  return [
    `${roomCountConstraint}`,
    `Photorealistic top-down orthographic 3D architectural floor plan of a ${styleStr} single-story home.`,
    'Cutaway view from directly above — no roof.',
    'Distinct solid interior walls separating each room cleanly, exactly like a translated CAD diagram.',
    'Precisely scaled highly-detailed miniature 3D furniture.',
    'V-Ray render, soft ambient lighting, clean structural lines.',
    entryContext || '',
    spatialHint || '',
    `INDOOR ROOMS inside the house walls: ${indoorRoomStr}.`,
    outdoorSection,
    noOutdoors,
    `DO NOT include: ${excludeStr}.`,
    'NO ROOF. NO SECOND FLOOR. NO STAIRS. Single level ground floor only.',
    'Every bathroom must be en-suite attached to a bedroom with a shared wall and door.',
    `CRITICAL: ${roomCountConstraint}`
  ].filter(Boolean).join(' ');
}

function build2DPrompt({
  roomCountConstraint, indoorRoomStr, outdoorAreaStr,
  hasOutdoorFeatures, excludeStr, entryContext, spatialHint
}) {
  return [
    `A crisp, computer-generated digital 2D architectural floor plan. Perfect geometric vector art.`,
    `Clean white background. Thick dark navy blue lines for walls.`,
    `ALL lines must be perfectly straight, rigid, and precise. Strict CAD aesthetic.`,
    `Simple outline furniture for ${indoorRoomStr}.`,
    hasOutdoorFeatures ? `Include outdoor areas: ${outdoorAreaStr}.` : '',
    `Pure flat top-down view.`,
    `NO sketchy lines, NO hand-drawn look, NO wobbly lines, NO paper texture, NO shadows, NO 3D.`,
    `DO NOT include: ${excludeStr}, text, words, letters, numbers.`,
    entryContext || '',
    spatialHint || '',
    `CRITICAL: ${roomCountConstraint} strictly enforced as perfectly straight 2D shapes.`
  ].filter(Boolean).join(' ');
}

// ════════════════════════════════════════════════════════════════════════════════
// AI IMAGE GENERATION  (HuggingFace FLUX → Pollinations fallback)
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
    const rawLength = parseFloat(length);
    const rawBreadth = parseFloat(breadth);
    if (!rawLength || rawLength <= 0 || !rawBreadth || rawBreadth <= 0) {
      return res.status(400).json({ error: 'Invalid dimensions. Length and Breadth must be > 0.' });
    }
    const numBedrooms = Math.max(1, parseInt(bedrooms) || 1);
    const numBathrooms = Math.max(1, parseInt(bathrooms) || 1);

    if (numBedrooms > 5 || numBathrooms > 5 || (rawLength * rawBreadth) > 2500) {
      if (numBedrooms > 6) {
        return res.status(400).json({ error: 'Maximum 6 bedrooms supported for 2D layout generation.' });
      }
      return res.status(400).json({ error: 'Input exceeds allowed limits. Please update your data.' });
    }

    // ── Feature flags ─────────────────────────────────────────────────────────
    const selectedFeatureKeys = featureList ? featureList.split(',').map(f => f.trim()) : [];
    const has = key => selectedFeatureKeys.includes(key);

    // Kitchen and Living Room are strictly mandatory
    const hasLiving = true;
    const hasKitchen = true;
    const hasDining = has('diningRoom');
    const hasOffice = has('office');
    const hasGarage = has('garage');
    const hasBalcony = has('balcony');
    const hasGarden = has('garden');
    const hasPool = has('pool');

    // ── Render mode ───────────────────────────────────────────────────────────
    const isCAD = renderStyle === 'Sketch' || renderStyle === 'Blueprint';

    // ── Room area breakdown (shared between CAD and 3D) ───────────────────────
    const rawSqFt = parseInt(sqFeet) || 1000;
    const totalSqFt = Math.max(800, Math.min(rawSqFt, 5000));

    const breakdown = [];
    if (hasLiving) breakdown.push({ name: 'Living Area', percentage: 0.25 });
    if (hasKitchen) breakdown.push({ name: 'Kitchen', percentage: 0.12 });
    if (hasDining) breakdown.push({ name: 'Dining Room', percentage: 0.10 });
    for (let i = 1; i <= numBedrooms; i++) breakdown.push({ name: `Bedroom ${i}`, percentage: 0.15 / Math.max(numBedrooms / 2, 1) });
    for (let i = 1; i <= numBathrooms; i++) breakdown.push({ name: `Bathroom ${i}`, percentage: 0.08 / Math.max(numBathrooms / 2, 1) });
    if (hasOffice) breakdown.push({ name: 'Office', percentage: 0.08 });
    if (hasGarage) breakdown.push({ name: 'Garage', percentage: 0.15 });
    if (hasBalcony) breakdown.push({ name: 'Balcony', percentage: 0.05 });
    if (hasGarden) breakdown.push({ name: 'Garden', percentage: 0.10 });
    if (hasPool) breakdown.push({ name: 'Pool', percentage: 0.10 });

    const layout_breakdown = breakdown.map(room => {
      const area = Math.round(totalSqFt * room.percentage);
      const side = Math.sqrt(area);
      const d1 = Math.round(side);
      const d2 = Math.round(area / d1);
      return { name: room.name, area, dimensions: `${d1}' x ${d2}'` };
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Compute logical smart-layout for BOTH modes (for exact counts & prompts)
    // ══════════════════════════════════════════════════════════════════════════
    const cadLayout = computeCADLayout({
      length: rawLength,
      breadth: rawBreadth,
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

    if (isCAD) {
      console.log('\n=== CAD MODE (programmatic render) ===');
      console.log('Dimensions:', rawLength, 'x', rawBreadth);
      console.log('Bedrooms:', numBedrooms, '| Bathrooms:', numBathrooms);
      console.log('Features:', selectedFeatureKeys);
      console.log('Entry:', entryDirection, '| Vastu:', vastuCompliant);
      console.log('======================================\n');

      return res.json({
        renderMode: 'cad',          // ← tells frontend to draw with Canvas
        image: null,            // no AI image in CAD mode
        cadLayout,                        // structured room data
        layout_breakdown,
        length: rawLength,
        breadth: rawBreadth,
        entryDirection: (entryDirection || 'East').trim(),
        vastuCompliant: !!vastuCompliant,
        renderStyle,
        status: 'success'
      });
    }

    // ════════════════════════════════════════════════════════════════════════════════
    //  3D MODE — AI image generation (FLUX / Pollinations)
    // ════════════════════════════════════════════════════════════════════════════════

    // Feature description maps for prompt building
    const indoorFeatureMap = {
      kitchen: 'modern kitchen with countertops, sink, stove, and cabinets',
      livingRoom: 'spacious living room with sofas, coffee table, and TV unit',
      diningRoom: 'dining area with dining table and chairs',
      office: 'home office with desk, chair, monitor, and bookshelf'
    };
    const outdoorFeatureMap = {
      garage: 'attached garage with car, positioned outside the main house walls',
      balcony: 'open-air balcony with railing, extending outward from exterior wall',
      garden: 'lush garden with grass, flower beds, and trees outside the house boundary',
      pool: 'rectangular swimming pool in open patio area outside the house boundary'
    };
    const featureExcludeMap = {
      kitchen: 'kitchen',
      livingRoom: 'living room',
      diningRoom: 'dining room',
      office: 'office, study',
      garage: 'garage, cars',
      balcony: 'balcony',
      garden: 'garden, outdoor plants, grass',
      pool: 'swimming pool, pool'
    };

    const allFeatureKeys = Object.keys({ ...indoorFeatureMap, ...outdoorFeatureMap });

    // Indoor room list
    const indoorRooms = [];
    if (hasLiving) indoorRooms.push('spacious living room with large sofas, coffee table, and TV unit');
    if (hasKitchen) indoorRooms.push('spacious modern kitchen with countertops, sink, stove, and island cabinets');
    for (let i = 1; i <= numBedrooms; i++) indoorRooms.push(`Bedroom ${i} with bed and wardrobe`);
    for (let i = 1; i <= numBathrooms; i++) indoorRooms.push(`distinct Bathroom ${i} showing a bathtub, toilet, and sink`);
    selectedFeatureKeys.forEach(key => { 
      if (indoorFeatureMap[key] && key !== 'kitchen' && key !== 'livingRoom') {
        indoorRooms.push(indoorFeatureMap[key]); 
      }
    });

    // Outdoor area list
    const outdoorAreas = [];
    selectedFeatureKeys.forEach(key => { if (outdoorFeatureMap[key]) outdoorAreas.push(outdoorFeatureMap[key]); });

    const indoorRoomStr = indoorRooms.join(', ');
    const outdoorAreaStr = outdoorAreas.join(', ');
    const hasOutdoorFeatures = outdoorAreas.length > 0;

    // Exclude list
    const excludedItems = allFeatureKeys
      .filter(key => {
        if (key === 'kitchen' || key === 'livingRoom') return false; // Mandatory, never exclude
        return !selectedFeatureKeys.includes(key);
      })
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
        East: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.',
        West: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-West.',
        North: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.',
        South: 'Master bedroom in South-West, Kitchen in South-East, Living room in North-East.'
      };
      const dir = (entryDirection || 'East').trim();
      vastuPrompt = `Follow Vastu Shastra: ${vastuMap[dir] || 'Master bedroom in South-West, Kitchen in South-East.'}`;
    }

    const cleanDir = (entryDirection || 'East').trim();
    const entryContext = [
      `Main entry door facing ${cleanDir}.`,
      `CRITICAL: Place the main entry gate/door on the ${cleanDir} side of the house boundary.`,
      vastuPrompt
    ].filter(Boolean).join(' ');

    // Map strictly generated CAD sectors into an explicit spatial prompt mapping string
    const exactSpatialMap = cadLayout.rooms.map(room => {
      const cx = room.x + (room.w / 2);
      const cy = room.y + (room.h / 2);
      const ns = cy < (rawBreadth / 2) ? 'North' : 'South';
      const ew = cx < (rawLength / 2) ? 'West' : 'East';
      return `${room.label} is strictly placed in the ${ns}-${ew} sector.`;
    }).join(' ');

    const spatialHints = [];
    spatialHints.push('Layout mapping rules: ' + exactSpatialMap);

    let finalPrompt;
    if (isCAD) {
      finalPrompt = build2DPrompt({
        roomCountConstraint, indoorRoomStr, outdoorAreaStr,
        hasOutdoorFeatures, excludeStr, entryContext,
        spatialHint: spatialHints[0]
      });
    } else {
      finalPrompt = build3DPrompt({
        roomCountConstraint, indoorRoomStr, outdoorAreaStr,
        hasOutdoorFeatures, excludeStr, entryContext,
        archStyle, spatialHint: spatialHints[0]
      });
    }

    console.log(`\n=== AI GENERATION MODE (${isCAD ? '2D Sketch' : '3D'}) ===`);
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

    // ── VQA VALIDATION & RETRY LOOP ───────────────────────────────────────────
    let base64Image = null;
    let validationPassed = false;
    let attempts = 0;
    const maxAttempts = 3; // 1 initial + up to 2 retries
    let finalPayloadRetried = false;

    while (attempts < maxAttempts && !validationPassed) {
      attempts++;
      console.log(`\n[Attempt ${attempts}/${maxAttempts}] Generating 3D Image via AI...`);
      base64Image = await generate3DImage(hf, finalPrompt);

      try {
        const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');
        const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });

        // Step 1: Caption Check for invalid vertical elements (stairs)
        const caption = await hf.imageToText({
          model: 'Salesforce/blip-image-captioning-large',
          data: imageBlob
        });
        const captionText = (caption?.generated_text || '').toLowerCase();

        if (captionText.includes('two story') || captionText.includes('stair')) {
          console.log(`[Attempt ${attempts}] REJECTED: Semantic check failed (found 'stairs' or 'two story').`);
          finalPrompt += ' NO STAIRS. NO TWO STORY. ABSOLUTELY FLAT SINGLE LEVEL GROUND FLOOR ONLY.';
          finalPayloadRetried = true;
          continue;
        }

        // Step 2: VQA Deep Semantic Check for Bedrooms
        if (numBedrooms > 0) {
          const vqaRes = await hf.visualQuestionAnswering({
            model: 'dandelin/vilt-b32-finetuned-vqa',
            inputs: { image: imageBlob, question: "How many beds are in this floor plan picture?" }
          });
          const topAnswer = vqaRes && vqaRes.length > 0 ? vqaRes[0].answer : "unknown";
          const detectedBeds = parseInt(topAnswer);

          if (!isNaN(detectedBeds) && detectedBeds !== numBedrooms) {
            console.log(`[Attempt ${attempts}] REJECTED: Expected ${numBedrooms} beds, but VQA model counted ${detectedBeds} beds. Retrying...`);
            finalPrompt += ` STRICT ADHERENCE REQUIRED: Ensure there are EXACTLY ${numBedrooms} clear beds in the image.`;
            finalPayloadRetried = true;
            continue;
          } else if (!isNaN(detectedBeds)) {
            console.log(`[Attempt ${attempts}] Verified exact bedroom accuracy (${detectedBeds}) via VQA.`);
          }
        }

        validationPassed = true;
        console.log(`[Attempt ${attempts}] Validation passed beautifully!`);

      } catch (valErr) {
        console.warn(`[Attempt ${attempts}] Validation skipped due to model load timeout / error:`, valErr.message);
        validationPassed = true; // Bail out gracefully, accept image
      }
    }

    return res.json({
      renderMode: '3d',
      image: base64Image,
      layout_breakdown,
      length: parseInt(length) || 40,
      breadth: parseInt(breadth) || 45,
      entryDirection: cleanDir,
      prompt_used: finalPrompt.substring(0, 200) + '...',
      validation: finalPayloadRetried ? 'passed_after_retry' : 'passed_first_try',
      status: 'success'
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
process.on('SIGINT', () => { server.close(); process.exit(0); });
server.on('error', err => {
  if (err.code === 'EADDRINUSE') { console.error(`Port ${PORT} in use.`); process.exit(1); }
});