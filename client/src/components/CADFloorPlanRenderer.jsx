import { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

// ─── Drawing constants ────────────────────────────────────────────────────────
const WALL_EXT_COLOR   = '#1c2833';
const WALL_INT_COLOR   = '#34495e';
const FURN_COLOR       = '#7f8c8d';
const LABEL_COLOR      = '#1c2833';
const LABEL_ROOM_COLOR = '#34495e';
const OUTDOOR_COLOR    = '#5d6d7e';
const BG_COLOR         = '#ffffff';
const OUTDOOR_BG       = '#f4f6f6';
const BATH_BG          = '#f8f9f9';

const WALL_EXT_LW = 5.5;
const WALL_INT_LW = 2.5;
const DOOR_RADIUS = 3.0; // feet (width of gap segment)

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
  // arc (dashed)
  ctx.setLineDash([sc(0.2), sc(0.15)]);
  ctx.strokeStyle = '#95a5a6';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(px(cx), py(cy), sc(r), startAngle, endAngle);
  ctx.stroke();
  ctx.setLineDash([]);
  // door leaf (solid thin line)
  ctx.strokeStyle = WALL_INT_COLOR;
  ctx.lineWidth = 2.0;
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
  drawRect(ctx, px, py, sc, x, y, w, h, '#e4e0d8', FURN_COLOR, 0.7);
  // headboard
  drawRect(ctx, px, py, sc, x + 0.15, y + 0.12, w - 0.3, h * 0.25, '#d0cbc0', FURN_COLOR, 0.5);
  // pillow divider
  drawLine(ctx, px, py, sc, x + w / 2, y + 0.12, x + w / 2, y + h * 0.37, FURN_COLOR, 0.4);
  // mattress
  drawRect(ctx, px, py, sc, x + 0.15, y + h * 0.3, w - 0.3, h * 0.65, '#ede9e0', FURN_COLOR, 0.4);
}

function drawWardrobe(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#dedad2', FURN_COLOR, 0.7);
  drawLine(ctx, px, py, sc, x + w / 2, y, x + w / 2, y + h, FURN_COLOR, 0.5);
  // handles
  [0.28, 0.72].forEach(f => {
    ctx.save();
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(px(x + w * f), py(y + h / 2), sc(0.18), Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();
    ctx.restore();
  });
}

function drawToilet(ctx, px, py, sc, x, y, w, h) {
  // tank
  drawRect(ctx, px, py, sc, x, y, w, h * 0.32, '#ddddd5', FURN_COLOR, 0.6);
  // bowl
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + w / 2), py(y + h * 0.68), sc(w * 0.44), sc(h * 0.36), 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ddddd5'; ctx.fill();
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
}

function drawSink(ctx, px, py, sc, x, y, s) {
  drawRect(ctx, px, py, sc, x, y, s, s, '#ddddd5', FURN_COLOR, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + s / 2), py(y + s / 2), sc(s * 0.3), sc(s * 0.32), 0, 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.5; ctx.stroke();
  // tap
  ctx.beginPath(); ctx.arc(px(x + s / 2), py(y + s * 0.22), sc(0.1), 0, Math.PI * 2);
  ctx.fillStyle = FURN_COLOR; ctx.fill();
  ctx.restore();
}

function drawBathtub(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#ddddd5', FURN_COLOR, 0.6);
  drawRect(ctx, px, py, sc, x + 0.18, y + 0.18, w - 0.36, h - 0.36, null, FURN_COLOR, 0.4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px(x + w - 0.55), py(y + h / 2), sc(0.26), 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
}

function drawSofa(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#d8d4cc', FURN_COLOR, 0.7);
  // backrest
  drawRect(ctx, px, py, sc, x, y, w, h * 0.30, '#c4c0b8', FURN_COLOR, 0.5);
  // seats
  const seats = Math.max(2, Math.round(w / 1.4));
  const sw = (w - 0.2) / seats;
  for (let i = 0; i < seats; i++) {
    drawRect(ctx, px, py, sc, x + 0.1 + i * sw, y + h * 0.33, sw - 0.1, h * 0.6, '#ccc8c0', FURN_COLOR, 0.4);
  }
  // armrests
  drawRect(ctx, px, py, sc, x, y + h * 0.3, 0.18, h * 0.65, '#bbb8b0', FURN_COLOR, 0.4);
  drawRect(ctx, px, py, sc, x + w - 0.18, y + h * 0.3, 0.18, h * 0.65, '#bbb8b0', FURN_COLOR, 0.4);
}

function drawTVUnit(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#ccc8c0', FURN_COLOR, 0.6);
  drawRect(ctx, px, py, sc, x + 0.25, y + 0.12, w - 0.5, h * 0.65, '#a8a49c', FURN_COLOR, 0.4);
}

function drawCoffeeTable(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#d8d4cc', FURN_COLOR, 0.5);
  // centre detail
  drawRect(ctx, px, py, sc, x + 0.2, y + 0.2, w - 0.4, h - 0.4, null, FURN_COLOR, 0.3);
}

function drawKitchenCounter(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#d4d0c8', FURN_COLOR, 0.7);
  // sink
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(px(x + 0.75), py(y + h / 2), sc(0.42), sc(h / 2 - 0.22), 0, 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.5; ctx.stroke();
  ctx.restore();
  // tap
  ctx.save();
  ctx.beginPath(); ctx.arc(px(x + 0.75), py(y + 0.25), sc(0.09), 0, Math.PI * 2);
  ctx.fillStyle = FURN_COLOR; ctx.fill();
  ctx.restore();
  // burners (right side)
  const bx = x + w - 1.6;
  [[bx + 0.3, y + 0.28], [bx + 1.1, y + 0.28], [bx + 0.3, y + h - 0.28], [bx + 1.1, y + h - 0.28]].forEach(([bxx, byy]) => {
    ctx.save();
    ctx.beginPath(); ctx.arc(px(bxx), py(byy), sc(0.22), 0, Math.PI * 2);
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.55; ctx.stroke();
    ctx.beginPath(); ctx.arc(px(bxx), py(byy), sc(0.10), 0, Math.PI * 2);
    ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  });
}

function drawDiningTable(ctx, px, py, sc, x, y, w, h, chairs = 6) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#d8d4cc', FURN_COLOR, 0.7);
  const cw = 0.65, ch = 0.55;
  // top & bottom chairs
  const hChairs = Math.min(Math.floor(w / 0.85), 4);
  const hGap = w / hChairs;
  for (let i = 0; i < hChairs; i++) {
    const cx = x + hGap * i + (hGap - cw) / 2;
    drawRect(ctx, px, py, sc, cx, y - ch - 0.08, cw, ch, '#c8c4bc', FURN_COLOR, 0.45);
    drawRect(ctx, px, py, sc, cx, y + h + 0.08, cw, ch, '#c8c4bc', FURN_COLOR, 0.45);
  }
  // side chairs
  const vChairs = Math.min(Math.floor(h / 0.85), 2);
  const vGap = h / vChairs;
  for (let i = 0; i < vChairs; i++) {
    const cy = y + vGap * i + (vGap - cw) / 2;
    drawRect(ctx, px, py, sc, x - ch - 0.08, cy, ch, cw, '#c8c4bc', FURN_COLOR, 0.45);
    drawRect(ctx, px, py, sc, x + w + 0.08, cy, ch, cw, '#c8c4bc', FURN_COLOR, 0.45);
  }
}

function drawDesk(ctx, px, py, sc, x, y, w, h) {
  drawRect(ctx, px, py, sc, x, y, w, h, '#d4d0c8', FURN_COLOR, 0.7);
  // monitor
  drawRect(ctx, px, py, sc, x + w * 0.3, y + 0.15, w * 0.4, h * 0.45, '#a8a49c', FURN_COLOR, 0.5);
  // chair (in front)
  ctx.save();
  ctx.beginPath();
  ctx.arc(px(x + w / 2), py(y + h + 0.65), sc(0.55), 0, Math.PI * 2);
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
}

function drawGarageCar(ctx, px, py, sc, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  const cw = w * 0.55, ch = h * 0.65;
  const ox = cx - cw / 2, oy = cy - ch / 2;
  // body
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px(ox), py(oy), sc(cw), sc(ch), 6);
  ctx.fillStyle = '#c8cfd8'; ctx.fill();
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.7; ctx.stroke();
  // cabin
  ctx.beginPath();
  ctx.roundRect(px(ox + cw * 0.18), py(oy + ch * 0.15), sc(cw * 0.64), sc(ch * 0.45), 4);
  ctx.fillStyle = '#b0bac4'; ctx.fill();
  ctx.strokeStyle = FURN_COLOR; ctx.lineWidth = 0.5; ctx.stroke();
  // wheels
  [[ox + 0.05, oy + 0.1], [ox + cw - 0.3, oy + 0.1], [ox + 0.05, oy + ch - 0.4], [ox + cw - 0.3, oy + ch - 0.4]].forEach(([wx, wy]) => {
    ctx.beginPath(); ctx.ellipse(px(wx + 0.12), py(wy + 0.15), sc(0.22), sc(0.15), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#666'; ctx.fill();
  });
  ctx.restore();
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
    East:  { x: L + 1.5, y: B / 2, dx: -1, dy: 0 },
    West:  { x: -1.5,    y: B / 2, dx:  1, dy: 0 },
    North: { x: L / 2,   y: -1.5,  dx:  0, dy:  1 },
    South: { x: L / 2,   y: B + 1.5, dx: 0, dy: -1 }
  };
  const { x, y, dx, dy } = map[dir] || map.East;
  ctx.save();
  ctx.strokeStyle = '#2563eb'; ctx.fillStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([sc(0.18), sc(0.1)]);
  ctx.beginPath();
  ctx.moveTo(px(x), py(y));
  ctx.lineTo(px(x + dx * 2.2), py(y + dy * 2.2));
  ctx.stroke();
  ctx.setLineDash([]);
  // arrowhead
  const ax = px(x + dx * 2.2), ay = py(y + dy * 2.2);
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - sc(0.5) * Math.cos(angle - 0.4), ay - sc(0.5) * Math.sin(angle - 0.4));
  ctx.lineTo(ax - sc(0.5) * Math.cos(angle + 0.4), ay - sc(0.5) * Math.sin(angle + 0.4));
  ctx.closePath(); ctx.fill();
  // label
  ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${dir} Entry`, px(x + dx * 3.6), py(y + dy * 3.6));
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
  const scale = Math.min(
    (canvas.width  - 2) / (L + PAD_FT * 2),
    (canvas.height - 2) / (B + PAD_FT * 2)
  );

  const ox = (canvas.width  - L * scale) / 2;
  const oy = (canvas.height - B * scale) / 2;

  const px = x => ox + x * scale;
  const py = y => oy + y * scale;
  const sc = v => v * scale;

  // ── Phase 0: Clear & Background ───────────────────────────────────────────
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { rooms } = cadLayout;

  // ── Phase 1: Draw Outdoor Zones, Room Backgrounds & Furniture ─────────────
  rooms.forEach(room => {
    const { x, y, w, h, type, outdoor, bath, label } = room;

    if (outdoor) {
      drawRect(ctx, px, py, sc, x, y, w, h, OUTDOOR_BG, OUTDOOR_COLOR, 1.4);
      ctx.save();
      ctx.setLineDash([sc(0.3), sc(0.2)]);
      ctx.strokeStyle = OUTDOOR_COLOR; ctx.lineWidth = 1.2;
      ctx.strokeRect(px(x), py(y), sc(w), sc(h));
      ctx.restore();

      if (type === 'garage') {
        drawGarageCar(ctx, px, py, sc, x, y, w, h);
      }
      if (type === 'balcony') {
        const count = Math.round(w / 0.9);
        for (let i = 0; i <= count; i++) {
          drawLine(ctx, px, py, sc, x + (w / count) * i, y, x + (w / count) * i, y + h * 0.85, OUTDOOR_COLOR, 0.7);
        }
        drawLine(ctx, px, py, sc, x, y + h * 0.85, x + w, y + h * 0.85, OUTDOOR_COLOR, 1.0);
      }
      if (type === 'garden') {
        const trees = [[x + w * 0.2, y + h * 0.3], [x + w * 0.6, y + h * 0.25], [x + w * 0.8, y + h * 0.65], [x + w * 0.35, y + h * 0.7]];
        trees.forEach(([tx, ty]) => {
          ctx.save();
          ctx.beginPath(); ctx.arc(px(tx), py(ty), sc(0.8), 0, Math.PI * 2);
          ctx.fillStyle = '#e8f0e8'; ctx.fill();
          ctx.strokeStyle = OUTDOOR_COLOR; ctx.lineWidth = 0.6; ctx.stroke();
          ctx.beginPath(); ctx.arc(px(tx), py(ty), sc(0.35), 0, Math.PI * 2);
          ctx.strokeStyle = OUTDOOR_COLOR; ctx.lineWidth = 0.4; ctx.stroke();
          ctx.restore();
        });
      }
      if (type === 'pool') {
        drawRect(ctx, px, py, sc, x + 0.3, y + 0.3, w - 0.6, h - 0.6, '#ebf5fb', OUTDOOR_COLOR, 0.8);
      }
      drawLabel(ctx, px, py, label, x + w / 2, y + h / 2, 8.5, OUTDOOR_COLOR, true);
      return;
    }

    // Indoor Rooms Backgrounds
    const roomBg = type === 'bathroom' ? BATH_BG : BG_COLOR;
    drawRect(ctx, px, py, sc, x, y, w, h, roomBg, null, 0);

    if (bath) {
      const { x: bx, y: by, w: bw, h: bh, label: blabel } = bath;
      drawRect(ctx, px, py, sc, bx, by, bw, bh, BATH_BG, null, 0);
      const fixtureScale = Math.min(bw, bh) / 4;
      const ts = Math.max(0.8, fixtureScale);
      drawToilet(ctx, px, py, sc, bx + 0.18, by + 0.18, ts * 0.9, ts * 1.35);
      drawSink(ctx, px, py, sc, bx + ts + 0.3, by + 0.2, ts * 0.82);
      if (bw > 2.5) {
        drawBathtub(ctx, px, py, sc, bx + bw - 1.9, by + bh - 1.2, 1.6, 0.95);
      }
      drawLabel(ctx, px, py, blabel, bx + bw / 2, by + bh / 2, 6.5, '#4a6090');
    }

    if (type === 'bedroom') {
      const bw2 = bath ? w - bath.w : w;
      const bScale = Math.min(w, h) / 6;
      const bs = Math.max(0.9, bScale);
      drawBed(ctx, px, py, sc, x + 0.4, y + 0.4, bs * 1.15, bs * 1.9);
      drawWardrobe(ctx, px, py, sc, x + 0.4, y + h - 1.25, bw2 * 0.42, 1.1);
      drawLabel(ctx, px, py, label, x + (bath ? (w - bath.w) / 2 : w / 2), y + h / 2, 8.5, LABEL_ROOM_COLOR, true);
    }
    if (type === 'living') {
      const sofaW = Math.min(w - 1.5, 4.8);
      const sofaH = Math.min(h * 0.38, 2.2);
      drawSofa(ctx, px, py, sc, x + 0.4, y + 0.4, sofaW, sofaH);
      drawTVUnit(ctx, px, py, sc, x + w - 3.2, y + 0.3, 2.8, 0.85);
      drawCoffeeTable(ctx, px, py, sc, x + w - 4.8, y + sofaH + 0.65, 2.4, 1.3);
      drawLabel(ctx, px, py, label, x + w / 2, y + h * 0.82, 8.5, LABEL_ROOM_COLOR, true);
    }
    if (type === 'kitchen') {
      const cw2 = Math.min(w - 0.5, 5.2);
      drawKitchenCounter(ctx, px, py, sc, x + 0.25, y + 0.25, cw2, Math.min(h - 0.5, 1.5));
      drawLine(ctx, px, py, sc, x + 0.25, y + 1.9, x + 0.25 + cw2, y + 1.9, FURN_COLOR, 0.4, [sc(0.2), sc(0.12)]);
      drawLabel(ctx, px, py, label, x + w / 2, y + h * 0.72, 8.5, LABEL_ROOM_COLOR, true);
    }
    if (type === 'dining') {
      const tw = Math.min(w - 1.5, 3.5);
      const th = Math.min(h - 1.8, 2.0);
      drawDiningTable(ctx, px, py, sc, x + (w - tw) / 2, y + (h - th) / 2, tw, th, 6);
      drawLabel(ctx, px, py, label, x + w / 2, y + h * 0.9, 8.5, LABEL_ROOM_COLOR, true);
    }
    if (type === 'office') {
      const dw = Math.min(w - 0.6, 2.8);
      drawDesk(ctx, px, py, sc, x + 0.3, y + 0.3, dw, Math.min(h * 0.45, 1.4));
      drawLabel(ctx, px, py, label, x + w / 2, y + h * 0.82, 8.5, LABEL_ROOM_COLOR, true);
    }
    if (type === 'hall') {
      drawLabel(ctx, px, py, label, x + w / 2, y + h / 2, 8.5, LABEL_ROOM_COLOR, true);
    }
  });

  // ── Phase 2: Interior Walls ─────────────────────────────────────────────────
  ctx.strokeStyle = WALL_INT_COLOR;
  ctx.lineWidth = WALL_INT_LW;
  rooms.forEach(room => {
    if (!room.outdoor) {
      ctx.strokeRect(px(room.x), py(room.y), sc(room.w), sc(room.h));
      if (room.bath) {
         ctx.strokeRect(px(room.bath.x), py(room.bath.y), sc(room.bath.w), sc(room.bath.h));
      }
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
  ctx.globalCompositeOperation = 'source-over';

  // ── Phase 5: Door Graphics ──────────────────────────────────────────────────
  rooms.forEach(room => {
    if (!room.outdoor && room.door) {
      const { x, y, startA, endA, leafA } = room.door;
      doorArc(ctx, px, py, sc, x, y, DOOR_RADIUS * 0.9, startA, endA, leafA);
    }
    if (!room.outdoor && room.bath) {
      const { x: bx, y: by, w: bw, h: bh } = room.bath;
      doorArc(ctx, px, py, sc, bx, by + bh, DOOR_RADIUS * 0.9, -Math.PI / 2, 0, 0);
    }
  });

  // ── Entry arrow & Dimension rulers ──────────────────────────────────────────
  drawEntryArrow(ctx, px, py, sc, L, B, entryDirection);
  drawRuler(ctx, px, py, sc, L, B);
}

// ─── React component ──────────────────────────────────────────────────────────
const CADFloorPlanRenderer = ({ cadLayout, length, breadth, entryDirection, renderStyle }) => {
  const canvasRef = useRef(null);

  // Canvas resolution: 900×820 logical pixels
  const CANVAS_W = 900;
  const CANVAS_H = 820;

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
      {/* Title badge */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
        2D CAD Floor Plan — {length} ft × {breadth} ft = {length * breadth} sq ft
      </div>

      {/* Canvas */}
      <div className="w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm bg-[#f8f7f2]">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', height: 'auto', background: '#f8f7f2' }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 dark:text-slate-400 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#1a2744]" style={{ borderWidth: 2 }}></span> Exterior wall
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#1a2744]" style={{ borderWidth: 1 }}></span> Interior wall
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-[#3a5a3a]" style={{ borderStyle: 'dashed', borderWidth: 1 }}></span> Outdoor zone
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 h-0.5 bg-blue-500"></span> Entry
        </span>
      </div>

      {/* Download */}
      <div className="w-full flex justify-end">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-sm transition-colors text-slate-800 dark:text-slate-200"
        >
          <Download size={15} /> Download {renderStyle} PNG
        </button>
      </div>
    </div>
  );
};

export default CADFloorPlanRenderer;
