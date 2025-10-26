const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

/* -----------------------------
   Game state & core variables
----------------------------- */
let enemies = [];
let towers = [];
let bullets = []; // bullets either target an enemyRef or a fixed targetPos
let pulses = [];  // visual pulses from slow towers

let speed = 0.002;
let spawnTimer = 0;
const spawnInterval = 200;

const shopHeight = 100;
const shopMargin = 20;
const towerRadius = 15;
const towerRange = 100;

let holdingTower = false;
let selectedTowerType = 'shooter';
let mousePos = { x: 0, y: 0 };

const slotSize = 70;
const gap = 20;
const slotStartX = 200;
const slotStartY = canvas.height - shopHeight / 2 - slotSize / 2;

const cancelBtn = { x: 400, y: canvas.height - shopHeight + 10, width: 80, height: 30 };

let runKills = 0;
let totalKills = 0;
let playerHP = 30;
const maxPlayerHP = 30;
let gameOver = false;

/* -----------------------------
   Slow tower upgrade data
----------------------------- */
const slowTowerSpecs = [
  { cooldown: 5.0, slowPct: 0.30, duration: 2.0, cost: 0 },
  { cooldown: 2.5, slowPct: 0.35, duration: 2.0, cost: 10 },
  { cooldown: 1.0, slowPct: 0.37, duration: 2.0, cost: 30 },
  { cooldown: 0.0, slowPct: 0.325, duration: Infinity, cost: 60 }
];

/* -----------------------------
   Path (cubic Bézier)
----------------------------- */
function getPointOnCurve(t) {
  const p0 = { x: -100, y: 200 };
  const p1 = { x: 200, y: 100 };
  const p2 = { x: 600, y: canvas.height - shopHeight - shopMargin - 50 };
  const p3 = { x: 900, y: 200 };
  const x =
    Math.pow(1 - t, 3) * p0.x +
    3 * Math.pow(1 - t, 2) * t * p1.x +
    3 * (1 - t) * Math.pow(t, 2) * p2.x +
    Math.pow(t, 3) * p3.x;
  const y =
    Math.pow(1 - t, 3) * p0.y +
    3 * Math.pow(1 - t, 2) * t * p1.y +
    3 * (1 - t) * Math.pow(t, 2) * p2.y +
    Math.pow(t, 3) * p3.y;
  return { x, y };
}

function drawPath() {
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let i = 0; i <= 1; i += 0.01) {
    const p = getPointOnCurve(i);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/* -----------------------------
   Shop UI & tower placement
----------------------------- */
function drawShopArea() {
  ctx.fillStyle = '#333';
  ctx.fillRect(0, canvas.height - shopHeight, canvas.width, shopHeight);
  ctx.fillStyle = 'white';
  ctx.font = '18px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Tower Shop — Press 1: Shooter | 2: Slow (upgrade with run kills)', 12, canvas.height - shopHeight / 2 + 8);

  for (let i = 0; i < 4; i++) {
    const x = slotStartX + i * (slotSize + gap);
    const y = slotStartY;
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, slotSize, slotSize);
  }

  // Shooter icon
  const shooterX = slotStartX + slotSize / 2;
  const shooterY = slotStartY + slotSize / 2;
  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(shooterX, shooterY, towerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('1', shooterX, shooterY + 30);

  // Slow tower icon
  const slowX = slotStartX + (slotSize + gap) + slotSize / 2;
  const slowY = slotStartY + slotSize / 2;
  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(slowX, slowY, towerRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText('2', slowX, slowY + 30);

  // cancel button
  if (holdingTower) {
    ctx.fillStyle = '#800';
    ctx.fillRect(cancelBtn.x, cancelBtn.y, cancelBtn.width, cancelBtn.height);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel (Esc/C)', cancelBtn.x + cancelBtn.width / 2, cancelBtn.y + 20);
  }
}

/* -----------------------------
   Collision helpers
----------------------------- */
function isOnPath(x, y) {
  for (let i = 0; i <= 1; i += 0.01) {
    const p = getPointOnCurve(i);
    if (Math.hypot(p.x - x, p.y - y) < 20) return true;
  }
  return false;
}
function isOnTower(x, y) {
  return towers.some(t => Math.hypot(t.x - x, t.y - y) < towerRadius * 2);
}

/* -----------------------------
   Towers
----------------------------- */
function drawTowers() {
  for (const t of towers) {
    if (t.type === 'shooter') {
      ctx.fillStyle = 'green';
      ctx.beginPath();
      ctx.arc(t.x, t.y, towerRadius, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.type === 'slow') {
      ctx.fillStyle = 'blue';
      ctx.beginPath();
      ctx.arc(t.x, t.y, towerRadius, 0, Math.PI * 2);
      ctx.fill();

      // level text
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('L' + t.level, t.x, t.y + 4);
    }
  }

  // show range if mouse is over tower
  let closest = null;
  let distClosest = Infinity;
  for (const t of towers) {
    const d = Math.hypot(mousePos.x - t.x, mousePos.y - t.y);
    if (d < distClosest) {
      distClosest = d;
      closest = t;
    }
  }
  if (closest && distClosest < towerRadius) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,255,0,0.1)';
    ctx.beginPath();
    ctx.arc(closest.x, closest.y, towerRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHoldingTower() {
  if (!holdingTower) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,255,0,0.08)';
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, towerRange, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = (selectedTowerType === 'shooter') ? 'green' : 'blue';
  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, towerRadius, 0, Math.PI * 2);
  ctx.fill();
}

/* -----------------------------
   Enemy spawning & drawing
----------------------------- */
function spawnEnemies() {
  spawnTimer++;
  if (spawnTimer < spawnInterval) return;
  spawnTimer = 0;

  // Boss every 25 total kills
  if (totalKills > 0 && totalKills % 25 === 0 && !enemies.some(e => e.isBoss)) {
    const hp = 50;
    enemies.push({ t: 0, hp, maxHp: hp, isBoss: true, slowMultiplier: 1, slowExpires: 0 });
    return;
  }

  let hp;
  if (totalKills >= 10) hp = Math.floor(Math.random() * 11) + 10;
  else hp = Math.floor(Math.random() * 5) + 3;

  enemies.push({ t: 0, hp, maxHp: hp, slowMultiplier: 1, slowExpires: 0 });
}

function drawEnemies() {
  const now = Date.now();
  for (const e of enemies) {
    const pos = getPointOnCurve(e.t);
    e.x = pos.x + (e.xOffset || 0);
    e.y = pos.y + (e.yOffset || 0);

    if (e.isBoss) {
      const ratio = 1 - e.hp / e.maxHp;
      const red = Math.min(255, Math.floor(255 * ratio));
      ctx.fillStyle = `rgb(${red},0,0)`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.maxHp >= 10) {
      const blueTone = Math.max(50, 255 - (e.hp - 10) * 20);
      ctx.fillStyle = `rgb(0,0,${blueTone})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const redTone = Math.max(50, 255 - (e.hp - 3) * 30);
      ctx.fillStyle = `rgb(${redTone},0,0)`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // hover HP and green bar
    const dist = Math.hypot(mousePos.x - e.x, mousePos.y - e.y);
    const hoverRadius = e.isBoss ? 30 : 15;
    if (dist < hoverRadius) {
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`HP: ${e.hp}`, e.x, e.y - (e.isBoss ? 40 : 25));

      const barWidth = e.isBoss ? 60 : 30;
      const barHeight = 6;
      const barX = e.x - barWidth / 2;
      const barY = e.y + (e.isBoss ? 35 : 20);
      ctx.fillStyle = 'black';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = 'lime';
      ctx.fillRect(barX, barY, barWidth * (Math.max(0, e.hp) / e.maxHp), barHeight);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // slow expiry
    if (e.slowExpires && e.slowExpires !== Infinity && now > e.slowExpires) {
      e.slowMultiplier = 1;
      e.slowExpires = 0;
    }

    // move
    e.t += speed * (e.slowMultiplier || 1);

    if (e.t > 1) {
      playerHP -= Math.ceil(e.hp / 2);
      enemies.splice(enemies.indexOf(e), 1);
      if (playerHP <= 0) gameOver = true;
    }
  }
}

/* -----------------------------
   Shooter towers
----------------------------- */
function towerShoot() {
  const now = Date.now();
  for (const t of towers) {
    if (t.type !== 'shooter') continue;
    if (!t.lastShot) t.lastShot = 0;
    if (now - t.lastShot < 500) continue;

    const target = enemies.find(e => e.x !== undefined && Math.hypot(e.x - t.x, e.y - t.y) <= towerRange);
    if (target) {
      bullets.push({ x: t.x, y: t.y, enemyRef: target, speed: 3, targetPos: null });
      t.lastShot = now;
    }
  }
}

/* -----------------------------
   Slow tower pulses
----------------------------- */
function updateSlowTowersAndPulses() {
  const now = Date.now();
  for (const t of towers) {
    if (t.type !== 'slow') continue;
    if (typeof t.level === 'undefined') t.level = 0;
    if (typeof t.lastPulse === 'undefined') t.lastPulse = 0;
    const spec = slowTowerSpecs[t.level];

    if (spec.duration === Infinity) {
      for (const e of enemies) {
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= towerRange) {
          e.slowMultiplier = 1 - spec.slowPct;
          e.slowExpires = Infinity;
        } else if (e.slowExpires === Infinity) {
          e.slowMultiplier = 1;
          e.slowExpires = 0;
        }
      }
      continue;
    }

    if (now - t.lastPulse >= spec.cooldown * 1000) {
      t.lastPulse = now;
      for (const e of enemies) {
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= towerRange) {
          e.slowMultiplier = 1 - spec.slowPct;
          e.slowExpires = now + spec.duration * 1000;
        }
      }
      pulses.push({ x: t.x, y: t.y, start: now, duration: 800, maxRadius: towerRange });
    }
  }

  // remove expired pulses
  const now2 = Date.now();
  for (let i = pulses.length - 1; i >= 0; i--) {
    if (now2 - pulses[i].start > pulses[i].duration) pulses.splice(i, 1);
  }
}

/* -----------------------------
   Bullets
----------------------------- */
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let targetX, targetY;
    if (b.enemyRef && enemies.includes(b.enemyRef)) {
      targetX = b.enemyRef.x;
      targetY = b.enemyRef.y;
    } else if (b.targetPos) {
      targetX = b.targetPos.x;
      targetY = b.targetPos.y;
    } else {
      bullets.splice(i, 1);
      continue;
    }
    const dx = targetX - b.x;
    const dy = targetY - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (b.speed || 3)) {
      if (b.enemyRef && enemies.includes(b.enemyRef)) {
        b.enemyRef.hp -= 1;
      }
      bullets.splice(i, 1);
    } else {
      b.x += (dx / dist) * (b.speed || 3);
      b.y += (dy / dist) * (b.speed || 3);
    }
  }
}

function drawBullets() {
  ctx.fillStyle = 'yellow';
  for (const b of bullets) ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
}

function drawPulses() {
  const now = Date.now();
  for (const p of pulses) {
    const t = Math.min(1, (now - p.start) / p.duration);
    const r = p.maxRadius * t;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0,150,255,${1 - t})`;
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* -----------------------------
   Enemy deaths & splits
----------------------------- */
function handleEnemyDeaths() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp > 0) continue;
    const deathPos = { x: e.x, y: e.y };

    // reassign bullets
    for (const b of bullets) {
      if (b.enemyRef === e) {
        b.targetPos = { x: deathPos.x + (Math.random() - 0.5) * 10, y: deathPos.y + (Math.random() - 0.5) * 10 };
        b.enemyRef = null;
      }
    }

    enemies.splice(i, 1);
    runKills++;
    totalKills++;

    if (e.isBoss) {
      for (let j = 0; j < 3; j++) {
        enemies.push({
          t: e.t,
          hp: 5,
          maxHp: 5,
          xOffset: (j - 1) * 40,
          yOffset: (Math.random() - 0.5) * 30,
          slowMultiplier: 1,
          slowExpires: 0
        });
      }
    } else if (e.maxHp >= 10) {
      const newHP = Math.ceil(e.maxHp / 4);
      for (let j = 0; j < 2; j++) {
        enemies.push({
          t: e.t,
          hp: newHP,
          maxHp: newHP,
          xOffset: j === 0 ? -20 : 20,
          yOffset: (Math.random() - 0.5) * 20,
          slowMultiplier: 1,
          slowExpires: 0
        });
      }
    }
  }
}

/* -----------------------------
   HUD
----------------------------- */
function drawHUD() {
  const barWidth = 120, barHeight = 30;
  ctx.fillStyle = 'black';
  ctx.fillRect(10, 10, barWidth, barHeight);
  ctx.fillStyle = 'green';
  ctx.fillRect(10, 10, barWidth * (playerHP / maxPlayerHP), barHeight);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, barWidth, barHeight);
  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`HP: ${playerHP}`, 10 + barWidth / 2, 10 + 20);

  ctx.fillStyle = 'white';
  ctx.font = '16px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Run kills: ${runKills}`, 10, 60);
  ctx.fillText(`Total kills: ${totalKills}`, 10, 80);
}

/* -----------------------------
   Game loop
----------------------------- */
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!gameOver) {
    spawnEnemies();
    drawPath();
    drawTowers();
    drawEnemies();
    drawShopArea();
    drawHoldingTower();
    towerShoot();
    updateBullets();
    drawBullets();
    updateSlowTowersAndPulses();
    drawPulses();
    handleEnemyDeaths();
    drawHUD();
  } else {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'red';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);
  }
  requestAnimationFrame(gameLoop);
}

/* -----------------------------
   Events
----------------------------- */
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Shop slots
  if (mx >= slotStartX && mx <= slotStartX + slotSize && my >= slotStartY && my <= slotStartY + slotSize) {
    selectedTowerType = 'shooter';
    holdingTower = true;
    return;
  }
  if (mx >= slotStartX + (slotSize + gap) && mx <= slotStartX + (slotSize + gap) + slotSize &&
    my >= slotStartY && my <= slotStartY + slotSize) {
    selectedTowerType = 'slow';
    holdingTower = true;
    return;
  }

  // cancel
  if (holdingTower && mx >= cancelBtn.x && mx <= cancelBtn.x + cancelBtn.width &&
    my >= cancelBtn.y && my <= cancelBtn.y + cancelBtn.height) {
    holdingTower = false;
    return;
  }

  // upgrade slow tower manually
  if (!holdingTower) {
    for (const t of towers) {
      if (t.type === 'slow') {
        const d = Math.hypot(mx - t.x, my - t.y);
        if (d <= towerRadius + 4) {
          const curLevel = t.level || 0;
          if (curLevel < slowTowerSpecs.length - 1 && runKills >= slowTowerSpecs[curLevel + 1].cost) {
            runKills -= slowTowerSpecs[curLevel + 1].cost;
            t.level = curLevel + 1;
          }
          return;
        }
      }
    }
  }

  // place tower
  if (holdingTower && !isOnPath(mx, my) && !isOnTower(mx, my) && my < canvas.height - shopHeight) {
    if (selectedTowerType === 'shooter') towers.push({ x: mx, y: my, type: 'shooter', lastShot: 0 });
    else if (selectedTowerType === 'slow') towers.push({ x: mx, y: my, type: 'slow', level: 0, lastPulse: 0 });
    holdingTower = false;
  }
});

/* Quick placement keys */
document.addEventListener('keydown', e => {
  if (e.key === '1') { selectedTowerType = 'shooter'; holdingTower = true; }
  if (e.key === '2') { selectedTowerType = 'slow'; holdingTower = true; }
  if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { holdingTower = false; }
});

gameLoop();
