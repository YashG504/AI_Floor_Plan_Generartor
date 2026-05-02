import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

// ─── Drawing constants ────────────────────────────────────────────────────────
const INK_COLOR = '#172554'; // Deep navy blueprint ink
const WALL_EXT_COLOR = INK_COLOR;
const WALL_INT_COLOR = INK_COLOR;
const FURN_COLOR = INK_COLOR;
const LABEL_COLOR = INK_COLOR;
const LABEL_ROOM_COLOR = 'transparent';
const OUTDOOR_COLOR = INK_COLOR;
const BG_COLOR = '#faf9f6'; // Clean warm off-white paper
const GRID_COLOR = 'transparent'; // No grid
const OUTDOOR_BG = 'transparent';
const BATH_BG = 'transparent';
const FURN_FILL = BG_COLOR; // Solid fill for furniture to hide lines underneath

const WALL_EXT_LW = 12.0; // Very thick outer wall matching reference
const WALL_INT_LW = 3.5; // Thicker internal wall
const DOOR_RADIUS = 2.8; // feet (width of gap segment)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function drawRect(ctx, px, py, sc, x, y, w, h, fill, stroke, lw) {
  ctx.beginPath();
  ctx.rect(px(x), py(y), sc(w), sc(h));
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function drawLine(ctx, px, py, sc, x1, y1, x2, y2, color, lw, dash = []) {
  ctx.save();
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(px(x1), py(y1));
  ctx.lineTo(px(x2), py(y2));
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, px, py, text, x, y, size = 9, color = LABEL_COLOR, bold = false) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? '600' : '400'} ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px(x), py(y));
  ctx.restore();
}

function doorArc(ctx, px, py, sc, cx, cy, r, startAngle, endAngle, leafAngle) {
  ctx.save();
  // arc — SOLID line matching reference style
  ctx.strokeStyle = INK_COLOR;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px(cx), py(cy), sc(r), startAngle, endAngle);
  ctx.stroke();

  // door leaf (solid thick line)
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px(cx), py(cy));
  ctx.lineTo(
    px(cx) + sc(r) * Math.cos(leafAngle),
    py(cy) + sc(r) * Math.sin(leafAngle)
  );
  ctx.stroke();
  ctx.restore();
}

// ─── Furniture drawers ────────────────────────────────────────────────────────
function drawBed(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  // pillows
  drawRect(ctx, px, py, sc, x + 0.2, y + 0.2, w * 0.4 - 0.2, h * 0.3, null, FURN_COLOR, 1.0);
  drawRect(ctx, px, py, sc, x + w * 0.6, y + 0.2, w * 0.4 - 0.2, h * 0.3, null, FURN_COLOR, 1.0);
  // mattress divider line
  drawLine(ctx, px, py, sc, x, y + h * 0.4, x + w, y + h * 0.4, FURN_COLOR, 1.0);
}

function drawWardrobe(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  drawLine(ctx, px, py, sc, x + w / 2, y, x + w / 2, y + h, FURN_COLOR, 1.0);
}

function drawToilet(ctx, px, py, sc, x, y, w, h) {
  // tank
  drawRect(ctx, px, py, sc, x, y, w, h * 0.3, FURN_FILL, FURN_COLOR, 1.2);
  // bowl
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + w / 2), py(y + h * 0.7), sc(w * 0.4), sc(h * 0.3), 0, 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function drawSink(ctx, px, py, sc, x, y, s) {
  drawRect(ctx, px, py, sc, x, y, s, s, FURN_FILL, FURN_COLOR, 1.2);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + s / 2), py(y + s / 2), sc(s * 0.35), sc(s * 0.4), 0, 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function drawBathtub(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.5);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px(x + 0.2), py(y + 0.2), sc(w - 0.4), sc(h - 0.4), 4);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function drawSofa(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  // backrest
  drawRect(ctx, px, py, sc, x + 0.1, y + 0.1, w - 0.2, h * 0.30, null, FURN_COLOR, 1.0);
  // armrests
  drawRect(ctx, px, py, sc, x + 0.1, y + h * 0.35, 0.4, h * 0.6, null, FURN_COLOR, 1.0);
  drawRect(ctx, px, py, sc, x + w - 0.5, y + h * 0.35, 0.4, h * 0.6, null, FURN_COLOR, 1.0);
  // split seats
  const seats = Math.max(2, Math.round(w / 2.0));
  const sw = (w - 1.0) / seats;
  for (let i = 1; i < seats; i++) {
    drawLine(ctx, px, py, sc, x + 0.5 + i * sw, y + h * 0.35, x + 0.5 + i * sw, y + h - 0.1, FURN_COLOR, 1.0);
  }
}

function drawTVUnit(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
}

function drawCoffeeTable(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
}

function drawKitchenCounter(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  // sink
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + 1.0), py(y + h / 2), sc(0.5), sc(h / 2 - 0.3), 0, 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
  ctx.restore();

  // burners (right side)
  const bx = x + w - 1.6;
  const hy = y + h / 2;
  [[bx + 0.3, hy - 0.35], [bx + 0.9, hy - 0.35], [bx + 0.3, hy + 0.35], [bx + 0.9, hy + 0.35]].forEach(([bxx, byy]) => {
    ctx.save();
    ctx.beginPath(); ctx.arc(px(bxx), py(byy), sc(0.2), 0, Math.PI * 2);
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
    ctx.restore();
  });
}

function drawDiningTable(ctx, px, py, sc, x, y, w, h, chairs = 6) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  const cw = 0.6, ch = 0.5;
  // top & bottom chairs
  const hChairs = Math.min(Math.floor(w / 0.85), 4);
  const hGap = w / hChairs;
  for (let i = 0; i < hChairs; i++) {
    const cx = x + hGap * i + (hGap - cw) / 2;
    ctx.beginPath(); ctx.roundRect(px(cx), py(y - ch - 0.1), sc(cw), sc(ch), 4);
    ctx.fillStyle = FURN_FILL; ctx.fill();
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
    
    ctx.beginPath(); ctx.roundRect(px(cx), py(y + h + 0.1), sc(cw), sc(ch), 4);
    ctx.fillStyle = FURN_FILL; ctx.fill();
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
  }
}

function drawDesk(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, FURN_FILL, FURN_COLOR, 1.2);
  // chair (in front)
  ctx.save();
  ctx.beginPath();
  ctx.arc(px(x + w / 2), py(y + h + 0.5), sc(0.4), 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
  ctx.restore();
}

function drawGarageCar(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x + 1.0, y + 1.0, w - 2.0, h - 2.0, FURN_FILL, FURN_COLOR, 1.2);
}

// ─── Dimension ruler ──────────────────────────────────────────────────────────
function drawRuler(ctx, px, py, sc, L, B) {
  ctx.save();
  ctx.strokeStyle = '#888'; ctx.fillStyle = '#555';
  ctx.lineWidth = 0.8;
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // width ruler (top)
  const ry = py(-3.2);
  ctx.beginPath(); ctx.moveTo(px(0), ry); ctx.lineTo(px(L), ry); ctx.stroke();
  [0, L].forEach(xv => { ctx.beginPath(); ctx.moveTo(px(xv), ry - 4); ctx.lineTo(px(xv), ry + 4); ctx.stroke(); });
  ctx.fillText(`${L} ft`, px(L / 2), ry - 8);

  // height ruler (left)
  const rx = px(-3.5);
  ctx.beginPath(); ctx.moveTo(rx, py(0)); ctx.lineTo(rx, py(B)); ctx.stroke();
  [0, B].forEach(yv => { ctx.beginPath(); ctx.moveTo(rx - 4, py(yv)); ctx.lineTo(rx + 4, py(yv)); ctx.stroke(); });
  ctx.save();
  ctx.translate(rx - 9, py(B / 2));
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${B} ft`, 0, 0);
  ctx.restore();

  ctx.restore();
}

// ─── Entry arrow ──────────────────────────────────────────────────────────────
function drawEntryArrow(ctx, px, py, sc, L, B, dir) {
  const map = {
    East: { x: L + 1.5, y: B / 2, dx: -1, dy: 0 },
    West: { x: -1.5, y: B / 2, dx: 1, dy: 0 },
    North: { x: L / 2, y: -1.5, dx: 0, dy: 1 },
    South: { x: L / 2, y: B + 1.5, dx: 0, dy: -1 }
  };
  const { x, y, dx, dy } = map[dir] || map.East;
  ctx.save();
  ctx.strokeStyle = INK_COLOR; ctx.fillStyle = INK_COLOR;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(px(x), py(y));
  ctx.lineTo(px(x + dx * 2.2), py(y + dy * 2.2));
  ctx.stroke();
  // arrowhead
  const ax = px(x + dx * 2.2), ay = py(y + dy * 2.2);
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - sc(0.6) * Math.cos(angle - 0.5), ay - sc(0.6) * Math.sin(angle - 0.5));
  ctx.lineTo(ax - sc(0.6) * Math.cos(angle + 0.5), ay - sc(0.6) * Math.sin(angle + 0.5));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ─── Main canvas draw function ────────────────────────────────────────────────
function drawCADFloorPlan(canvas, cadLayout, entryDirection, length, breadth) {
  if (!canvas || !cadLayout) return;

  const ctx = canvas.getContext('2d');
  const L = length;
  const B = breadth;

  // padding around house (in feet)
  const PAD_FT = 8;
  const isRotated = entryDirection === 'East' || entryDirection === 'West';
  const visualW = isRotated ? B : L;
  const visualH = isRotated ? L : B;

  const scale = Math.min(
    (canvas.width - 2) / (visualW + PAD_FT * 2),
    (canvas.height - 2) / (visualH + PAD_FT * 2)
  );

  const px = x => (x - L / 2) * scale;
  const py = y => (y - B / 2) * scale;
  const sc = v => v * scale;

  // ── Phase 0: Clear & Background ───────────────────────────────────────────
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (entryDirection === 'East') ctx.rotate(-Math.PI / 2);
  else if (entryDirection === 'West') ctx.rotate(Math.PI / 2);
  else if (entryDirection === 'North') ctx.rotate(Math.PI);

  const { rooms } = cadLayout;

  // ── Phase 1: Draw Outdoor Zones, Room Backgrounds & Furniture ─────────────
  rooms.forEach(room => {
    const { x, y, w, h, type, outdoor, bath, label } = room;

    if (outdoor) {
      if (type === 'garage') {
        drawGarageCar(ctx, px, py, sc, x, y, w, h);
      }
      if (type === 'balcony') {
        drawLine(ctx, px, py, sc, x, y + h * 0.85, x + w, y + h * 0.85, OUTDOOR_COLOR, 1.2);
      }
      if (type === 'pool') {
        drawRect(ctx, px, py, sc, x + 0.3, y + 0.3, w - 0.6, h - 0.6, null, OUTDOOR_COLOR, 1.2);
      }
      return;
    }

    if (bath) {
      const { x: bx, y: by, w: bw, h: bh } = bath;
      const fixtureScale = Math.min(bw, bh) / 3.5;
      const ts = Math.max(1.0, fixtureScale);
      drawToilet(ctx, px, py, sc, bx + 0.3, by + 0.3, ts * 1.1, ts * 1.6);
      drawSink(ctx, px, py, sc, bx + ts * 1.3 + 0.4, by + 0.3, ts * 1.0);
      if (bw > 2.5) {
        drawBathtub(ctx, px, py, sc, bx + bw - 2.5, by + bh - 1.6, 2.2, 1.3);
      }
    }

    if (type === 'bathroom') {
      const isRightWing = x > L / 2;
      const fixtureScale = Math.min(w, h) / 3.5;
      const ts = Math.max(1.0, fixtureScale);
      const fixX = isRightWing ? x + w - ts * 1.1 - 0.6 : x + 0.6;

      drawToilet(ctx, px, py, sc, fixX, y + 0.6, ts * 1.1, ts * 1.6);
      drawSink(ctx, px, py, sc, fixX, y + ts * 1.9 + 0.6, ts * 1.0);

      if (w > 3 && h > 3) {
        const tubW = Math.min(w * 0.45, 3.0);
        const tubH = Math.min(h * 0.25, 1.6);
        const tubX = isRightWing ? x + w - tubW - 0.6 : x + 0.6;
        drawBathtub(ctx, px, py, sc, tubX, y + h - tubH - 0.6, tubW, tubH);
      }
    }

    if (type === 'bedroom') {
      const isRightWing = x > L / 2;
      const bw2 = bath ? w - bath.w : w;
      const bedW = Math.min(w * 0.78, 14.0);
      const bedH = Math.min(h * 0.6, 14.0);

      const bedX = x + 0.8;
      const bedY = isRightWing ? y + h - bedH - 0.8 : y + 0.8;
      drawBed(ctx, px, py, sc, bedX, bedY, bedW, bedH);

      const wardW = Math.min(w * 0.6, 10.0);
      const wardY = isRightWing ? y + 0.8 : y + h - 3.0;
      drawWardrobe(ctx, px, py, sc, bedX, wardY, wardW, 2.5);
    }
    if (type === 'living') {
      const sofaW = Math.min(w * 0.82, 18.0);
      const sofaH = Math.min(h * 0.28, 5.0);
      const sofaX = x + (w - sofaW) / 2;
      const sofaY = y + h * 0.15;
      drawSofa(ctx, px, py, sc, sofaX, sofaY, sofaW, sofaH);

      const ctW = Math.min(sofaW * 0.55, 7.0);
      const ctH = Math.min(h * 0.12, 3.5);
      const ctX = sofaX + (sofaW - ctW) / 2;
      drawCoffeeTable(ctx, px, py, sc, ctX, sofaY + sofaH + 2.0, ctW, ctH);
      
      // Removed TV unit to leave the bottom entry wall completely clear for the main gate
    }
    if (type === 'kitchen') {
      const cw2 = Math.min(w * 0.85, 16.0);
      const cxOffset = x + (w - cw2) / 2;
      drawKitchenCounter(ctx, px, py, sc, cxOffset, y + 0.8, cw2, 3.0);
      const islandW = cw2 * 0.65;
      const islandX = cxOffset + (cw2 - islandW) / 2;
      const islandY = y + 5.5;
      drawRect(ctx, px, py, sc, islandX, islandY, islandW, 2.5, FURN_FILL, FURN_COLOR, 1.8);
      const stools = Math.max(3, Math.round(islandW / 2.5));
      const stoolGap = islandW / stools;
      for (let i = 0; i < stools; i++) {
        ctx.beginPath();
        ctx.arc(px(islandX + stoolGap * i + stoolGap / 2), py(islandY + 3.2), sc(0.45), 0, Math.PI * 2);
        ctx.fillStyle = FURN_FILL; ctx.fill();
        ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 1.0; ctx.stroke();
      }
    }
    if (type === 'dining') {
      const tw = Math.min(w * 0.75, 10.0);
      const th = Math.min(h * 0.55, 5.5);
      drawDiningTable(ctx, px, py, sc, x + (w - tw) / 2, y + (h - th) / 2, tw, th, 8);
    }
    if (type === 'kitchen_dining') {
      const cw2 = w - 0.5;
      drawKitchenCounter(ctx, px, py, sc, x + 0.25, y + 0.8, cw2, 3.0);

      const tw = Math.min(w * 0.7, 8.0);
      const th = Math.min(h * 0.45, 4.5);
      drawDiningTable(ctx, px, py, sc, x + (w - tw) / 2, y + h - th - 1.2, tw, th, 6);
    }
    if (type === 'office') {
      const dw = Math.min(w * 0.7, 7.0);
      drawDesk(ctx, px, py, sc, x + 0.5, y + 0.5, dw, Math.min(h * 0.5, 3.5));
    }
  });

  // ── Phase 2: Interior Walls ─────────────────────────────────────────────────
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = WALL_INT_COLOR;
  ctx.lineWidth = WALL_INT_LW;
  rooms.forEach(room => {
    if (!room.outdoor && !room.noWall) {
      ctx.strokeRect(px(room.x), py(room.y), sc(room.w), sc(room.h));
    }
    if (!room.outdoor && room.bath) {
      ctx.strokeRect(px(room.bath.x), py(room.bath.y), sc(room.bath.w), sc(room.bath.h));
    }
  });

  // ── Phase 3: Exterior Boundary ──────────────────────────────────────────────
  ctx.strokeStyle = WALL_EXT_COLOR;
  ctx.lineWidth = WALL_EXT_LW;
  ctx.strokeRect(px(0), py(0), sc(L), sc(B));

  // ── Phase 4: Door Gaps Carving ──────────────────────────────────────────────
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000000';
  rooms.forEach(room => {
    if (!room.outdoor && room.door) {
      const { x, y, wall } = room.door;
      let xMin = x, xMax = x, yMin = y, yMax = y;
      const r = DOOR_RADIUS;

      if (wall === 'left') { yMin = y - r; yMax = y; }
      if (wall === 'right') { yMin = y; yMax = y + r; }
      if (wall === 'top') { xMin = x; xMax = x + r; }
      if (wall === 'bottom') { xMin = x - r; xMax = x; }

      const gpX = px(xMin), gpY = py(yMin);
      const gpW = sc(xMax - xMin), gpH = sc(yMax - yMin);
      const t = WALL_EXT_LW + 2;

      if (wall === 'left' || wall === 'right') {
        ctx.fillRect(gpX - t, gpY - 2, 2 * t, Math.abs(gpH) + 4);
      } else {
        ctx.fillRect(gpX - 2, gpY - t, Math.abs(gpW) + 4, 2 * t);
      }
    }

    if (!room.outdoor && room.bath) {
      const { x: bx, y: by, w: bw, h: bh } = room.bath;
      const r = DOOR_RADIUS;
      const gpX = px(bx), gpY = py(by + bh - r);
      const gpH = sc(r);
      const t = WALL_INT_LW + 2;
      ctx.fillRect(gpX - t, gpY - 2, 2 * t, Math.abs(gpH) + 4);
    }
  });

  // Carve main entry gate gap at South (bottom) wall
  const e_cx = L / 2;
  const e_cy = B;
  const e_r = DOOR_RADIUS * 1.2;
  const e_xMin = e_cx - e_r;
  const e_xMax = e_cx;
  const egpX = px(e_xMin), egpY = py(e_cy);
  const egpW = sc(e_xMax - e_xMin);
  const et = WALL_EXT_LW + 2;
  ctx.fillRect(egpX - 2, egpY - et, Math.abs(egpW) + 4, 2 * et);

  ctx.globalCompositeOperation = 'source-over';

  // ── Phase 5: Door Graphics ──────────────────────────────────────────────────
  // Main Entry Gate Arc (swinging left-up/inwards)
  doorArc(ctx, px, py, sc, L / 2, B, DOOR_RADIUS * 1.2, Math.PI, 3 * Math.PI / 2, -Math.PI / 2);

  rooms.forEach(room => {
    if (!room.outdoor && room.door) {
      const { x, y, startA, endA, leafA } = room.door;
      doorArc(ctx, px, py, sc, x, y, DOOR_RADIUS * 0.9, startA, endA, leafA);
    }
    if (!room.outdoor && room.bath && room.bath.doorMeta) {
      const { x: bx, y: by, wall, startA, endA, leafA } = room.bath.doorMeta;
      doorArc(ctx, px, py, sc, bx, by, DOOR_RADIUS * 0.9, startA, endA, leafA);
    } else if (!room.outdoor && room.bath) {
      const { x: bx, y: by, w: bw, h: bh } = room.bath;
      doorArc(ctx, px, py, sc, bx, by + bh, DOOR_RADIUS * 0.9, -Math.PI / 2, 0, 0);
    }
  });



  // ── Phase 6: Room Labels ────────────────────────────────────────────────────
  // Labels are removed by default to maintain the pristine architectural sketch aesthetic.
  // rooms.forEach(room => { ... });

  // ── Phase 7: Outdoor zone outlines ─────────────────────────────────
  rooms.forEach(room => {
    if (room.outdoor) {
      ctx.setLineDash([sc(0.4), sc(0.25)]);
      ctx.strokeStyle = OUTDOOR_COLOR;
      ctx.lineWidth = 2.0;
      ctx.strokeRect(px(room.x), py(room.y), sc(room.w), sc(room.h));
      ctx.setLineDash([]);
    }
  });

  ctx.restore(); // Restore global canvas translation and rotation

  // ── Phase 8: Main Entry Marker (Upright Text & Arrow) ─────────────────────
  // Drawn after ctx.restore() so text is always upright on screen
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const hw = (visualW / 2) * scale;
  const hh = (visualH / 2) * scale;
  
  let ex, ey, adx, ady, textAlign, textBaseline, textX, textY, arrowAngle;
  
  if (entryDirection === 'East') {
    ex = cx + hw; ey = cy; adx = -1; ady = 0;
    textAlign = 'left'; textBaseline = 'middle';
    textX = ex + sc(4.5); textY = ey;
    arrowAngle = Math.PI; // pointing left
  } else if (entryDirection === 'West') {
    ex = cx - hw; ey = cy; adx = 1; ady = 0;
    textAlign = 'right'; textBaseline = 'middle';
    textX = ex - sc(4.5); textY = ey;
    arrowAngle = 0; // pointing right
  } else if (entryDirection === 'North') {
    ex = cx; ey = cy - hh; adx = 0; ady = 1;
    textAlign = 'center'; textBaseline = 'bottom';
    textX = ex; textY = ey - sc(4.5);
    arrowAngle = Math.PI / 2; // pointing down
  } else { // South
    ex = cx; ey = cy + hh; adx = 0; ady = -1;
    textAlign = 'center'; textBaseline = 'top';
    textX = ex; textY = ey + sc(4.5);
    arrowAngle = -Math.PI / 2; // pointing up
  }

  ctx.strokeStyle = INK_COLOR;
  ctx.fillStyle = INK_COLOR;
  ctx.lineWidth = 3.0;
  ctx.lineCap = 'round';

  // Draw arrow stem (starting outside, ending at boundary)
  ctx.beginPath();
  ctx.moveTo(ex - adx * sc(3.5), ey - ady * sc(3.5)); // Tail
  ctx.lineTo(ex, ey); // Head
  ctx.stroke();

  // Draw arrow head at boundary (ex, ey)
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - sc(1.0) * Math.cos(arrowAngle - 0.5), ey - sc(1.0) * Math.sin(arrowAngle - 0.5));
  ctx.lineTo(ex - sc(1.0) * Math.cos(arrowAngle + 0.5), ey - sc(1.0) * Math.sin(arrowAngle + 0.5));
  ctx.closePath();
  ctx.fill();

  // Draw text
  ctx.font = `600 ${Math.max(14, Math.floor(sc(2.5)))}px "Inter", sans-serif`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = textBaseline;
  ctx.fillText('Gate Entry', textX, textY);
}

// ─── React component ──────────────────────────────────────────────────────────
const CADFloorPlanRenderer = ({ cadLayout, length, breadth, entryDirection, renderStyle }) => {
  const canvasRef = useRef(null);

  // Canvas resolution: higher for crisp professional output
  const CANVAS_W = 1200;
  const CANVAS_H = 1000;

  useEffect(() => {
    if (!cadLayout || !canvasRef.current) return;
    drawCADFloorPlan(canvasRef.current, cadLayout, entryDirection, length, breadth);
  }, [cadLayout, length, breadth, entryDirection]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `floor-plan-${renderStyle?.toLowerCase() || 'sketch'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center w-full gap-4">
      {/* Canvas */}
      <div className="w-full overflow-hidden shadow-sm relative" style={{ backgroundColor: BG_COLOR }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', height: 'auto', background: BG_COLOR }}
        />
        {/* Download */}
        <button
          onClick={handleDownload}
          className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur shadow hover:bg-slate-50 border border-slate-200 rounded text-xs transition-colors text-slate-700"
        >
          <Download size={14} /> Download {renderStyle}
        </button>
      </div>
    </div>
  );
};

export default CADFloorPlanRenderer;
