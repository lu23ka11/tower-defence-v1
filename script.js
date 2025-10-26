const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Enemy array
let enemies = [];
let speed = 0.002;

// Enemy spawn timer
let spawnTimer = 0;
const spawnInterval = 200;

// Shop and tower variables
const shopHeight = 100;
const shopMargin = 20;
const towerRadius = 15;
const towerRange = 100;
let towers = [];
let holdingTower = false;
let mousePos = { x: 0, y: 0 };

// Bullets
let bullets = [];
const bulletSpeed = 3;
const bulletSize = 5;

// Tower shop slots
const slotSize = 70;
const gap = 20;
const slotStartX = 200;
const slotStartY = canvas.height - shopHeight / 2 - slotSize / 2;

// Cancel button
const cancelBtn = { x: 400, y: canvas.height - shopHeight + 10, width: 80, height: 30 };

// Waves
let defeatedEnemies = 0;
let strongWaveActive = false;

// Player HP
let playerHP = 30;
const maxPlayerHP = 30;

// Game over flag
let gameOver = false;

// Curve function
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

// Draw path
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

// Draw shop area
function drawShopArea() {
  ctx.fillStyle = '#333';
  ctx.fillRect(0, canvas.height - shopHeight, canvas.width, shopHeight);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Tower Shop', 20, canvas.height - shopHeight / 2 + 8);

  for (let i = 0; i < 4; i++) {
    const x = slotStartX + i * (slotSize + gap);
    const y = slotStartY;
    ctx.fillStyle = '#555';
    ctx.fillRect(x, y, slotSize, slotSize);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, slotSize, slotSize);
  }

  const iconX = slotStartX + slotSize / 2;
  const iconY = slotStartY + slotSize / 2;
  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(iconX, iconY, towerRadius, 0, Math.PI * 2);
  ctx.fill();

  if (holdingTower) {
    ctx.fillStyle = '#800';
    ctx.fillRect(cancelBtn.x, cancelBtn.y, cancelBtn.width, cancelBtn.height);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel', cancelBtn.x + cancelBtn.width / 2, cancelBtn.y + 20);
  }
}

// Collision checks
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

// Draw towers
function drawTowers() {
  for (const t of towers) {
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(t.x, t.y, towerRadius, 0, Math.PI * 2);
    ctx.fill();
  }

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

// Draw holding tower
function drawHoldingTower() {
  if (holdingTower) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,255,0,0.1)';
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, towerRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, towerRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw enemies
function drawEnemies() {
  for (const e of enemies) {
    const pos = getPointOnCurve(e.t);
    const red = Math.max(50, 255 - (e.hp - 3) * 30);
    ctx.fillStyle = `rgb(${red},0,0)`;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
    ctx.fill();

    if (Math.hypot(mousePos.x - pos.x, mousePos.y - pos.y) < 15) {
      ctx.save();
      ctx.fillStyle = 'black';
      ctx.fillRect(pos.x - 15, pos.y - 25, 30, 5);
      ctx.fillStyle = 'lime';
      ctx.fillRect(pos.x - 15, pos.y - 25, 30 * (e.hp / e.maxHp), 5);
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`HP: ${e.hp}`, pos.x, pos.y - 30);
      ctx.restore();
    }

    e.t += speed;

    if (e.t > 1) {
      // DAMAGE PLAYER
      const prevHP = playerHP;
      playerHP -= Math.ceil(e.hp / 2);
      const damage = prevHP - playerHP;

      // Damage all enemies same amount
      enemies.forEach(enemy => {
        enemy.hp -= damage;
        if (enemy.hp < 0) enemy.hp = 0;
      });

      enemies.splice(enemies.indexOf(e), 1);
      if (playerHP <= 0) gameOver = true;
    }
  }
}

// Tower shooting
function towerShoot() {
  const now = Date.now();
  for (const t of towers) {
    if (!t.lastShot) t.lastShot = 0;
    if (now - t.lastShot < 500) continue;

    const target = enemies.find(e => {
      const pos = getPointOnCurve(e.t);
      return Math.hypot(pos.x - t.x, pos.y - t.y) <= towerRange;
    });

    if (target) {
      bullets.push({ x: t.x, y: t.y, enemyRef: target });
      t.lastShot = now;
    }
  }
}

// Update bullets
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const pos = getPointOnCurve(b.enemyRef.t);
    const dx = pos.x - b.x;
    const dy = pos.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bulletSpeed) {
      b.enemyRef.hp -= 1;
      bullets.splice(i, 1);
    } else {
      b.x += (dx / dist) * bulletSpeed;
      b.y += (dy / dist) * bulletSpeed;
    }
  }
}

// Draw bullets
function drawBullets() {
  ctx.fillStyle = 'yellow';
  for (const b of bullets) {
    ctx.fillRect(b.x - bulletSize / 2, b.y - bulletSize / 2, bulletSize, bulletSize);
  }
}

// Spawn enemies
function spawnEnemies() {
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    let hp = strongWaveActive && Math.random() < 0.5 ? Math.floor(Math.random()*6)+5 : Math.floor(Math.random()*5)+3;
    enemies.push({ t:0, hp, maxHp: hp });
  }
}

// Mouse events
canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (mx >= slotStartX && mx <= slotStartX+slotSize && my >= slotStartY && my <= slotStartY+slotSize) {
    holdingTower = true;
    return;
  }

  if (holdingTower && mx >= cancelBtn.x && mx <= cancelBtn.x+cancelBtn.width &&
      my >= cancelBtn.y && my <= cancelBtn.y+cancelBtn.height) holdingTower=false;
});
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
});
canvas.addEventListener('mouseup', e => {
  if (holdingTower) {
    const x = mousePos.x;
    const y = mousePos.y;
    if (!isOnPath(x,y) && !isOnTower(x,y) && y < canvas.height - shopHeight) {
      towers.push({x,y});
      holdingTower = false;
    }
  }
});

// Game loop
function gameLoop() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(!gameOver){
    spawnEnemies();
    drawPath();
    drawTowers();
    drawEnemies();
    drawShopArea();
    drawHoldingTower();
    towerShoot();
    updateBullets();
    drawBullets();

    // Remove dead enemies
    for(let i=enemies.length-1;i>=0;i--){
      if(enemies[i].hp<=0){
        defeatedEnemies++;
        enemies.splice(i,1);
      }
    }

    if(!strongWaveActive && defeatedEnemies>=10) strongWaveActive=true;

    // Player HP bar
    const barWidth = 120, barHeight=30;
    ctx.fillStyle='black';
    ctx.fillRect(10,10,barWidth,barHeight);
    ctx.fillStyle='green';
    ctx.fillRect(10,10,barWidth*(playerHP/maxPlayerHP),barHeight);
    ctx.strokeStyle='black';
    ctx.lineWidth=2;
    ctx.strokeRect(10,10,barWidth,barHeight);
    ctx.fillStyle='white';
    ctx.font='16px Arial';
    ctx.textAlign='center';
    ctx.fillText(`HP: ${playerHP}`,10+barWidth/2,10+20);

  } else {
    // Game over screen
    ctx.fillStyle='black';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='red';
    ctx.font='50px Arial';
    ctx.textAlign='center';
    ctx.fillText('GAME OVER',canvas.width/2,canvas.height/2-50);

    // Restart button
    const btnW=200, btnH=50;
    const btnX=canvas.width/2-btnW/2, btnY=canvas.height/2+20;
    ctx.fillStyle='#0a0';
    ctx.fillRect(btnX,btnY,btnW,btnH);
    ctx.strokeStyle='black';
    ctx.lineWidth=3;
    ctx.strokeRect(btnX,btnY,btnW,btnH);
    ctx.fillStyle='white';
    ctx.font='24px Arial';
    ctx.fillText('Restart',canvas.width/2,btnY+32);

    canvas.addEventListener('mousedown', function restartListener(e){
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if(mx>=btnX && mx<=btnX+btnW && my>=btnY && my<=btnY+btnH){
        playerHP=maxPlayerHP;
        enemies=[];
        towers=[];
        bullets=[];
        holdingTower=false;
        defeatedEnemies=0;
        strongWaveActive=false;
        spawnTimer=0;
        gameOver=false;
        canvas.removeEventListener('mousedown',restartListener);
      }
    });
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();