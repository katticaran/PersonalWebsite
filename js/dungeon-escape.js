(function() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const TILE = 32;
  const ROWS_ON_SCREEN = Math.ceil(HEIGHT / TILE);
  const LANE_TYPES = ['road', 'river'];
  const LANE_SPEEDS = { road: [2.0, 4.0], river: [1.2, 2.5] };
  const EPS = 0.05;

  let lanes = [];
  let cameraPos = 0;
  let hasStarted = false;
  let player = { col: 7, row: 0, size: 0.8, alive: true };
  let resetBtn = document.getElementById('resetBtn');
  let scoreEl = document.getElementById('score');
  let bestEl = document.getElementById('best');

  function drawSpider(x, y, widthPx, tileSizePx, dir) {
    const cx = x + widthPx / 2;
    const cy = y + tileSizePx / 2;
    const bodyR = Math.max(8, Math.min(widthPx * 0.25, tileSizePx * 0.28));
    const headR = Math.max(5, bodyR * 0.6);
    ctx.fillStyle = '#0f1014';
    ctx.beginPath(); ctx.arc(cx, cy, bodyR, 0, Math.PI * 2); ctx.fill();
    // head slightly above the body center
    ctx.beginPath(); ctx.arc(cx, cy - bodyR * 0.6, headR, 0, Math.PI * 2); ctx.fill();
    // legs (thicker and longer for clearer hitbox)
    ctx.strokeStyle = '#1b1d24';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 2) {
      for (let k = -1; k <= 1; k += 1) {
        const ly = cy + k * (bodyR * 0.9);
        ctx.beginPath();
        ctx.moveTo(cx + i * bodyR * 0.8, ly);
        ctx.lineTo(cx + i * (bodyR * 1.9), ly - 6);
        ctx.lineTo(cx + i * (bodyR * 2.6), ly + 4);
        ctx.stroke();
      }
    }
    // eyes at the top of the head
    ctx.fillStyle = '#d946ef';
    const eyeYTop = cy - bodyR * 0.6 - headR * 0.4;
    ctx.beginPath(); ctx.arc(cx - 3, eyeYTop, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 3, eyeYTop, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  // New enemy: Bear (longer, black bear)
  function drawBear(x, y, widthPx, tileSizePx, dir) {
    const h = Math.min(tileSizePx * 0.72, 22);
    const bw = Math.max(widthPx * 0.85, tileSizePx * 1.4);
    const bx = x + (widthPx - bw) / 2;
    const by = y + tileSizePx * 0.50;

    // Body
    ctx.fillStyle = '#0b0c10';
    drawRoundedRect(bx, by - h / 2, bw, h, 6);
    ctx.fill();

    // Back highlight
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(bx + 4, by - h / 2 + 2, bw - 8, 2);

    // Head
    const hx = dir > 0 ? bx + bw - h * 0.6 : bx + h * 0.6;
    const hy = by - h * 0.35;
    ctx.fillStyle = '#111319';
    ctx.beginPath();
    ctx.ellipse(hx, hy, h * 0.35, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#0b0c10';
    ctx.beginPath(); ctx.arc(hx - (dir > 0 ? 4 : -4), hy - h * 0.22, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + (dir > 0 ? 4 : -4), hy - h * 0.22, 3, 0, Math.PI * 2); ctx.fill();

    // Muzzle + nose
    ctx.fillStyle = '#2a2d36';
    ctx.beginPath(); ctx.ellipse(hx, hy + 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d4d7de';
    ctx.beginPath(); ctx.arc(hx, hy + 2, 1.4, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#b7c0ff';
    ctx.beginPath(); ctx.arc(hx - 4, hy - 2, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 4, hy - 2, 1.3, 0, Math.PI * 2); ctx.fill();

    // Feet shadows (suggest legs)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const footY = by + h * 0.38;
    for (let i = 0; i < 4; i++) {
      const fx = bx + (i + 0.5) * (bw / 4);
      ctx.fillRect(fx - 3, footY, 6, 2);
    }
  }

  // Utility: draw rounded rectangle
  function drawRoundedRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  // Stylized player head: brown skin, black hair, glasses
  function drawPlayerHead(cx, cy, radius, alive) {
    ctx.save();

    // Skin tone
    const skin = alive ? '#c69b7b' : '#7d818c';
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Messy hair (black) with extra spikes
    const hairR = radius * 1.1;
    ctx.fillStyle = '#0b0c10';
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.18, hairR, Math.PI, 0);
    const fringeY = cy + radius * 0.02;
    ctx.lineTo(cx + hairR * 0.95, fringeY);
    ctx.quadraticCurveTo(cx + hairR * 0.30, cy - radius * 0.20, cx + hairR * 0.06, fringeY - 2);
    ctx.quadraticCurveTo(cx - hairR * 0.10, cy - radius * 0.18, cx - hairR * 0.45, fringeY - 1);
    ctx.quadraticCurveTo(cx - hairR * 0.70, cy - radius * 0.22, cx - hairR * 0.95, fringeY);
    ctx.closePath();
    ctx.fill();

    // Ears
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(cx - radius * 0.95, cy - radius * 0.05, radius * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + radius * 0.95, cy - radius * 0.05, radius * 0.22, 0, Math.PI * 2); ctx.fill();

    // Lightning scar (gold) on forehead
    if (alive) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = Math.max(1.2, radius * 0.10);
      const sx = cx - radius * 0.25;
      const sy = cy - radius * 0.35;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + radius * 0.12, sy + radius * 0.10);
      ctx.lineTo(sx - radius * 0.02, sy + radius * 0.22);
      ctx.lineTo(sx + radius * 0.14, sy + radius * 0.34);
      ctx.stroke();
    }

    // Round glasses
    const eyeR = radius * 0.36;
    ctx.strokeStyle = alive ? '#1f2937' : '#444b57';
    ctx.lineWidth = Math.max(1.6, radius * 0.12);
    ctx.beginPath(); ctx.arc(cx - radius * 0.55, cy - radius * 0.1, eyeR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + radius * 0.55, cy - radius * 0.1, eyeR, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - radius * 0.20, cy - radius * 0.1); ctx.lineTo(cx + radius * 0.20, cy - radius * 0.1); ctx.stroke();

    // Eyes
    ctx.fillStyle = alive ? '#0b0c10' : '#353a46';
    ctx.beginPath(); ctx.arc(cx - radius * 0.55, cy - radius * 0.1, Math.max(1.4, radius * 0.10), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + radius * 0.55, cy - radius * 0.1, Math.max(1.4, radius * 0.10), 0, Math.PI * 2); ctx.fill();

    // Mouth (neutral)
    ctx.strokeStyle = alive ? 'rgba(20,20,22,0.75)' : 'rgba(70,72,80,0.6)';
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - radius * 0.25, cy + radius * 0.38);
    ctx.quadraticCurveTo(cx, cy + radius * 0.45, cx + radius * 0.25, cy + radius * 0.38);
    ctx.stroke();

    // no scarf

    ctx.restore();
  }

  function randomBetween(min, max) { return Math.random() * (max - min) + min; }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Controls how many consecutive river lanes to generate (0 means none/start new decision)
  let pendingRiverRun = 0;

  function createLane(rowIndex) {
    // Enforce: always have 3+ land lanes before any river
    const MIN_LAND_BEFORE_RIVER = 3;
    let type;
    let isMultiRiver = false;
    if (rowIndex < 3) {
      type = 'grass';
    } else if (pendingRiverRun > 0) {
      // Continue an active river run
      type = 'river';
      isMultiRiver = true; // any continuation implies multi-lane segment
      pendingRiverRun -= 1;
    } else {
      // Count consecutive land lanes at the end of current lanes
      let landStreak = 0;
      for (let i = lanes.length - 1; i >= 0; i--) {
        if (!lanes[i] || lanes[i].type === 'river') break;
        landStreak++;
      }
      const canPlaceRiver = landStreak >= MIN_LAND_BEFORE_RIVER;
      if (canPlaceRiver && Math.random() < 0.25) {
        // Start a new river run with length 1..10; longer more likely as score increases
        const score = Math.max(0, Math.floor(player.row));
        // Cap max consecutive water by score: starts very low, grows gradually
        const maxLen = Math.min(10, 2 + Math.floor(score / 25)); // 2..10
        // Bias exponent: high score -> smaller exponent -> more long runs; early bias favors shorter
        const bias = Math.max(0.8, 1.15 - score / 300);
        const r = Math.random() ** bias; // [0,1), skewed
        const runLen = Math.max(1, Math.min(maxLen, Math.floor(r * maxLen) + 1));
        pendingRiverRun = runLen - 1; // current lane counts as first
        isMultiRiver = runLen >= 2;
        type = 'river';
      } else {
        // Force land; randomly pick grass or road
        type = Math.random() < 0.25 ? 'grass' : 'road';
      }
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    const speed = type === 'grass' ? 0 : randomBetween(...LANE_SPEEDS[type] || [0, 0]);
    const density = type === 'road' ? randomBetween(0.12, 0.22) : type === 'river' ? randomBetween(0.10, 0.18) : 0;
    const objects = [];
    if (type !== 'grass') {
      let count = Math.max(1, Math.floor((WIDTH / TILE) * density));
      // If this river lane is part of a multi-lane river segment, add a few extra couches
      if (type === 'river' && isMultiRiver) {
        count = Math.max(count + 1, Math.ceil(count * 1.4));
      }
      for (let i = 0; i < count; i++) {
        const base = speed;
        const factor = randomBetween(0.7, 1.3); // per-object variance
        const objSpeed = base * factor;
        if (type === 'road') {
          const kind = Math.random() < 0.35 ? 'bear' : 'spider';
          const w = kind === 'bear' ? Math.floor(randomBetween(2, 4)) : Math.floor(randomBetween(1, 2));
          objects.push({ x: Math.floor(Math.random() * (WIDTH / TILE)), w, speed: objSpeed, kind });
        } else {
          objects.push({ x: Math.floor(Math.random() * (WIDTH / TILE)), w: Math.floor(randomBetween(1, 3)), speed: objSpeed });
        }
      }
    }
    return { type, dir, speed, density, objects };
  }

  function ensureLanes() {
    while (lanes.length < Math.floor(cameraPos) + ROWS_ON_SCREEN + 5) {
      lanes.push(createLane(lanes.length));
    }
  }

  function resetGame() {
    player = { col: 7, row: 0, size: 0.8, alive: true };
    cameraPos = 0;
    hasStarted = false;
    lanes = [];
    ensureLanes();
    updateScore();
  }

  function updateScore() {
    const score = Math.floor(player.row);
    scoreEl.textContent = score;
    const best = Math.max(score, parseInt(localStorage.getItem('dollus_dungeon_escape_best') || '0'));
    localStorage.setItem('dollus_dungeon_escape_best', best.toString());
    bestEl.textContent = best;
  }

  function update(dt) {
    if (!player.alive) return;

    // Update camera position
    if (hasStarted) {
      const BASE_SCROLL_SPEED = 0.1; // tiles per second
      const MAX_SCROLL_SPEED = 0.95; // tiles per second
      const playerHeight = Math.max(0, player.row - cameraPos);
      const t = Math.min(1, playerHeight / (ROWS_ON_SCREEN - 1));
      const targetSpeed = BASE_SCROLL_SPEED + (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED) * t;
      cameraPos += targetSpeed * dt;
    }

    // Update objects
    const baseRow = Math.floor(cameraPos);
    for (let i = Math.max(0, baseRow - 2); i <= baseRow + ROWS_ON_SCREEN + 2; i++) {
      const lane = lanes[i];
      if (!lane || lane.type === 'grass') continue;
      
      for (const obj of lane.objects) {
        obj.x += (obj.speed ?? lane.speed) * lane.dir * dt;
        if (lane.dir > 0 && obj.x > WIDTH / TILE + 2) {
          obj.x = -obj.w - 1;
        } else if (lane.dir < 0 && obj.x < -obj.w - 1) {
          obj.x = WIDTH / TILE + 2;
        }
      }
    }

    // Check collisions
    const playerLane = lanes[player.row];
    if (playerLane && playerLane.type !== 'grass') {
      let onPlatform = false;
      const overlapAtLeast = (a0, a1, b0, b1, minOverlap) => (Math.min(a1, b1) - Math.max(a0, b0)) >= minOverlap;
      for (const obj of playerLane.objects) {
        if (playerLane.type === 'road') {
          // Align hitbox to enemy body (bear wider than spider)
          const cxObj = obj.x + obj.w / 2;
          const lethalHalf = obj.kind === 'bear' ? Math.min(obj.w * 0.5, 0.8) : Math.min(obj.w * 0.45, 0.6);
          const left = cxObj - lethalHalf;
          const right = cxObj + lethalHalf;
          if (overlapAtLeast(player.col, player.col + player.size, left, right, 0.02)) {
            player.alive = false;
            break;
          }
        } else {
          // Consider any contact with couch as standing on it (more forgiving)
          if (overlapAtLeast(player.col, player.col + player.size, obj.x, obj.x + obj.w, 0.0)) {
            onPlatform = true;
            // Carry player with this specific couch's speed
            const carrySpeed = (obj.speed ?? playerLane.speed) * playerLane.dir;
            player.col += carrySpeed * dt;
            break;
          }
        }
      }
      if (player.alive && playerLane.type === 'river' && !onPlatform) {
        player.alive = false;
      }
    }

    // Check if player fell behind camera
    if (player.row < cameraPos) {
      player.alive = false;
    }

    updateScore();
    ensureLanes();
  }

  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const baseRow = Math.floor(cameraPos);
    const camFrac = cameraPos - baseRow;
    for (let screenRow = 0; screenRow < ROWS_ON_SCREEN; screenRow++) {
      const worldRow = baseRow + (ROWS_ON_SCREEN - 1 - screenRow);
      const lane = lanes[worldRow] || { type: 'grass' };
      const y = screenRow * TILE + camFrac * TILE;
      if (lane.type === 'grass') {
        // Vibrant layered grass with a gothic tone
        const grad = ctx.createLinearGradient(0, y, 0, y + TILE);
        grad.addColorStop(0, '#2a7c35'); // slightly less vibrant
        grad.addColorStop(1, '#174f25'); // deep green
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, WIDTH, TILE);

        // Soft top highlight and bottom shadow for depth
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fillRect(0, y, WIDTH, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(0, y + TILE - 2, WIDTH, 2);

        // Mild mottled noise (deterministic)
        for (let sx = 0; sx < WIDTH; sx += 20) {
          const n = Math.sin((sx + worldRow * 31.7) * 12.9898) * 43758.5453;
          const r = n - Math.floor(n);
          const ny = y + 4 + Math.floor(r * (TILE - 8));
          ctx.fillStyle = r > 0.5 ? 'rgba(22,38,26,0.18)' : 'rgba(210,255,210,0.08)';
          ctx.fillRect(sx + 6, ny, 3, 3);
        }

        // Curved blade clusters (shadow pass)
        const base = y + TILE - 1;
        ctx.strokeStyle = 'rgba(10, 26, 18, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let sx = 12; sx < WIDTH; sx += 28) {
          const n1 = Math.sin((sx * 9.17) + worldRow * 7.13) * 1234.567;
          const r1 = n1 - Math.floor(n1);
          const offset = (r1 - 0.5) * 10;
          const height = 8 + Math.floor(r1 * 10); // 8..18 px
          const bx = sx + offset;
          // 3 shadow blades per cluster
          ctx.moveTo(bx, base);
          ctx.quadraticCurveTo(bx - 3, base - height * 0.6, bx - 1, base - height);
          ctx.moveTo(bx + 6, base);
          ctx.quadraticCurveTo(bx + 2, base - (height - 3) * 0.6, bx + 4, base - (height - 3));
          ctx.moveTo(bx - 6, base);
          ctx.quadraticCurveTo(bx - 8, base - (height - 2) * 0.55, bx - 5, base - (height - 2));
        }
        ctx.stroke();

        // Highlight pass for blades
        ctx.strokeStyle = 'rgba(190, 255, 190, 0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let sx = 8; sx < WIDTH; sx += 28) {
          const n2 = Math.sin((sx * 7.77) + worldRow * 5.31) * 5678.123;
          const r2 = n2 - Math.floor(n2);
          const offset = (r2 - 0.5) * 8;
          const height = 7 + Math.floor(r2 * 9); // 7..16 px
          const bx = sx + offset;
          ctx.moveTo(bx, base);
          ctx.quadraticCurveTo(bx + 2, base - height * 0.6, bx + 1, base - height);
          ctx.moveTo(bx + 4, base);
          ctx.quadraticCurveTo(bx + 6, base - (height - 2) * 0.6, bx + 5, base - (height - 2));
        }
        ctx.stroke();

        // Fine micro-grass
        ctx.strokeStyle = 'rgba(210,255,210,0.18)';
        ctx.beginPath();
        for (let sx = 4; sx < WIDTH; sx += 10) {
          const n3 = Math.sin((sx * 3.33) + worldRow * 9.99) * 3333.3;
          const r3 = n3 - Math.floor(n3);
          const h = 2 + Math.floor(r3 * 3);
          ctx.moveTo(sx, base - 1);
          ctx.lineTo(sx + (r3 - 0.5) * 2, base - 1 - h);
        }
        ctx.stroke();

        // Child-like flowers (deterministic per row)
        const kidPalette = [
          'rgba(196, 112, 137, 0.8)',  // muted pink
          'rgba(205, 178, 104, 0.8)',  // muted yellow
          'rgba(108, 144, 178, 0.8)',  // muted blue
          'rgba(124, 158, 134, 0.8)',  // muted green
          'rgba(176, 150, 196, 0.8)'   // muted purple
        ];
        const kidCenter = 'rgba(232, 211, 106, 0.9)';
        const flowerCount = 1 + (Math.abs(Math.floor(Math.sin(worldRow * 9.13) * 3)) % 2); // 1..2
        for (let f = 0; f < flowerCount; f++) {
          const seed = Math.sin((worldRow * 77.7) + f * 31.1) * 10000;
          const r = seed - Math.floor(seed);
          const r2 = (Math.sin(seed * 1.19) - Math.floor(Math.sin(seed * 1.19)));
          const fx = 12 + Math.floor(r * (WIDTH - 24));
          const stemH = 8 + Math.floor(Math.abs(r2) * 9); // 8..17
          const topY = base - stemH;

          // stem (straight)
          ctx.strokeStyle = 'rgba(40,100,50,0.75)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, base);
          ctx.lineTo(fx, topY);
          ctx.stroke();

          // leaves (simple circles)
          ctx.fillStyle = 'rgba(50,120,60,0.75)';
          const ly = base - Math.floor(stemH * 0.45);
          ctx.beginPath(); ctx.arc(fx - 4, ly, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(fx + 4, ly + 1, 2.2, 0, Math.PI * 2); ctx.fill();

          // petals: five round blobs with dark outline (slightly smaller)
          const petalColor = kidPalette[(Math.abs(Math.floor(seed)) % kidPalette.length)];
          const petalR = 3.6;
          const offset = 5.8;
          ctx.strokeStyle = '#0e0f11';
          ctx.lineWidth = 1.3;
          for (let k = 0; k < 5; k++) {
            const ang = (Math.PI * 2 * k) / 5;
            const px = fx + Math.cos(ang) * offset;
            const py = topY + Math.sin(ang) * offset;
            ctx.fillStyle = petalColor;
            ctx.beginPath(); ctx.arc(px, py, petalR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }

          // center: slightly dimmed yellow circle with outline
          ctx.fillStyle = kidCenter;
          ctx.beginPath(); ctx.arc(fx, topY, 2.6, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#0e0f11'; ctx.lineWidth = 1.3; ctx.stroke();
        }
      } else if (lane.type === 'road') {
        // Dirt road: brownish gradient + speckles
        const grad = ctx.createLinearGradient(0, y, 0, y + TILE);
        grad.addColorStop(0, '#3a2a1f');
        grad.addColorStop(1, '#2a1d15');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.fillStyle = 'rgba(20,14,10,0.35)';
        for (let sx = 0; sx < WIDTH; sx += 24) {
          const ry = y + (sx % 48 === 0 ? TILE * 0.25 : TILE * 0.65);
          ctx.fillRect(sx + 6, ry, 10, 2);
        }
      } else {
        // Water: animated waves and highlights
        const waveY = y + Math.sin((baseRow + screenRow) * 0.8 + animTime * 3) * 2;
        const gradient = ctx.createLinearGradient(0, y, 0, y + TILE);
        gradient.addColorStop(0, '#2a2440');
        gradient.addColorStop(1, '#3a2a6b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y, WIDTH, TILE);
        ctx.strokeStyle = 'rgba(180,160,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= WIDTH; x += 16) {
          const wy = waveY + Math.sin((x / 24) + animTime * 2) * 3 + TILE * 0.3;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.stroke();
      }
      if (lane.type === 'road') {
        // Ruts on dirt road instead of center divider
        ctx.strokeStyle = 'rgba(12,9,7,0.45)';
        ctx.setLineDash([6, 10]);
        ctx.beginPath();
        ctx.moveTo(0, y + TILE * 0.35);
        ctx.lineTo(WIDTH, y + TILE * 0.35);
        ctx.moveTo(0, y + TILE * 0.65);
        ctx.lineTo(WIDTH, y + TILE * 0.65);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (lane.type !== 'grass') {
        ctx.globalAlpha = 1.0;
        for (const obj of lane.objects) {
          const x = obj.x * TILE;
          const w = obj.w * TILE;
          if (lane.type === 'road') {
            if (obj.kind === 'bear') {
              drawBear(x, y, w, TILE, lanes[worldRow].dir);
            } else {
              drawSpider(x, y, w, TILE, lanes[worldRow].dir);
            }
          } else {
            // Floating couch (original simple design) with reddish-orange colors
            const seatHeight = Math.floor(TILE * 0.36);
            const seatY = Math.floor(y + TILE * 0.5 - seatHeight / 2);
            const seatX = Math.floor(x);
            const seatW = Math.floor(w);

            // Seat gradient (reddish orange)
            const seatGrad = ctx.createLinearGradient(seatX, seatY, seatX, seatY + seatHeight);
            seatGrad.addColorStop(0, '#b34a1a');
            seatGrad.addColorStop(1, '#7f250b');
            ctx.fillStyle = seatGrad;
            ctx.fillRect(seatX, seatY, seatW, seatHeight);

            // Backrest
            const backH = Math.max(6, Math.floor(TILE * 0.18));
            const backY = seatY - backH + 2;
            ctx.fillStyle = '#872f12';
            ctx.fillRect(seatX, backY, seatW, backH);

            // Armrests (rectangular, more explicit)
            const armW = Math.max(8, Math.min(16, Math.floor(TILE * 0.3)));
            const armH = seatHeight - 4;
            ctx.fillStyle = '#993312';
            // base blocks
            ctx.fillRect(seatX, seatY + 2, armW, armH);
            ctx.fillRect(seatX + seatW - armW, seatY + 2, armW, armH);
            // subtle cap protruding above seat
            const capH = Math.max(3, Math.floor(TILE * 0.1));
            ctx.fillStyle = '#a43a14';
            ctx.fillRect(seatX, seatY - capH + 2, armW, capH);
            ctx.fillRect(seatX + seatW - armW, seatY - capH + 2, armW, capH);
            // inner edge outlines to separate from cushions
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(seatX + armW + 0.5, seatY + 2);
            ctx.lineTo(seatX + armW + 0.5, seatY + 2 + armH);
            ctx.moveTo(seatX + seatW - armW - 0.5, seatY + 2);
            ctx.lineTo(seatX + seatW - armW - 0.5, seatY + 2 + armH);
            ctx.stroke();
            // top highlights on armrests
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.moveTo(seatX + 2, seatY + 3);
            ctx.lineTo(seatX + armW - 2, seatY + 3);
            ctx.moveTo(seatX + seatW - armW + 2, seatY + 3);
            ctx.lineTo(seatX + seatW - 2, seatY + 3);
            ctx.stroke();

            // Cushion seams (vertical lines)
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let sx = seatX + armW + Math.floor(TILE * 0.9); sx < seatX + seatW - armW; sx += Math.floor(TILE)) {
              ctx.moveTo(sx, seatY + 3);
              ctx.lineTo(sx, seatY + seatHeight - 3);
            }
            ctx.stroke();

            // Top highlight on backrest
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.moveTo(seatX + 2, backY + 1);
            ctx.lineTo(seatX + seatW - 2, backY + 1);
            ctx.stroke();

            // Couch legs
            const legW = Math.max(3, Math.floor(TILE * 0.08));
            const legH = Math.max(4, Math.floor(TILE * 0.12));
            const legSpacing = Math.floor(TILE * 0.15);
            const legY = seatY + seatHeight;
            
            ctx.fillStyle = '#5d2a0a'; // Dark brown legs
            // Front legs
            ctx.fillRect(seatX + legSpacing, legY, legW, legH);
            ctx.fillRect(seatX + seatW - legSpacing - legW, legY, legW, legH);
            // Back legs (slightly shorter)
            const backLegH = Math.max(3, Math.floor(legH * 0.75));
            ctx.fillRect(seatX + legSpacing, legY, legW, backLegH);
            ctx.fillRect(seatX + seatW - legSpacing - legW, legY, legW, backLegH);
            
            // Leg shadows
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(seatX + legSpacing + 1, legY + legH, legW - 2, 2);
            ctx.fillRect(seatX + seatW - legSpacing - legW + 1, legY + legH, legW - 2, 2);
            
            // Soft shadow on water under couch
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(seatX + 4, legY + legH, seatW - 8, 3);
          }
        }
      }
    }
    const cx = player.col * TILE + TILE * 0.5;
    const cy = (ROWS_ON_SCREEN - (player.row - cameraPos) - 1) * TILE + TILE * 0.5;
    const radius = TILE * player.size * 0.4;
    drawPlayerHead(cx, cy, radius, player.alive);
    if (!player.alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#e8edf2'; ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 10);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText('Press Restart or Space to play again', WIDTH / 2, HEIGHT / 2 + 18);
    }
  }

  let last = 0; let animTime = 0; function loop(ts){ const dt = Math.min(0.05, (ts - last) / 1000); last = ts; animTime += dt; if (player.alive) update(dt); render(); requestAnimationFrame(loop);} 
  function move(dx, dy){ if (!player.alive) return; hasStarted = true; player.col += dx; player.row += dy; player.row = Math.max(0, player.row);} 
  window.addEventListener('keydown', (e) => { if (e.repeat) return; const key = e.key.toLowerCase(); const isMoveKey = ['arrowup','w','arrowdown','s','arrowleft','a','arrowright','d',' '].includes(key); if (isMoveKey) e.preventDefault(); if (key === 'arrowup' || key === 'w') move(0, +1); else if (key === 'arrowdown' || key === 's') move(0, -1); else if (key === 'arrowleft' || key === 'a') move(-1, 0); else if (key === 'arrowright' || key === 'd') move(+1, 0); else if (key === ' ') { if (!player.alive) resetGame(); } }, { passive: false });
  document.querySelectorAll('.ctrl').forEach(btn => { btn.addEventListener('click', () => { const d = btn.getAttribute('data-dir'); if (d === 'up') move(0, +1); if (d === 'down') move(0, -1); if (d === 'left') move(-1, 0); if (d === 'right') move(+1, 0); }); });
  resetBtn.addEventListener('click', resetGame);
  ensureLanes(); requestAnimationFrame(loop);
})();
