const modal = document.querySelector('#gameModal');
const stage = document.querySelector('#gameStage');
const title = document.querySelector('#modalTitle');
const instructions = document.querySelector('#modalInstructions');
const scoreEl = document.querySelector('#gameScore');
const bestScoreEl = document.querySelector('#bestScore');
const pongModeButton = document.querySelector('#pongMode');
const creditBalanceEl = document.querySelector('#creditBalance');
const shopNoteEl = document.querySelector('#shopNote');
let currentGame = '';
let cleanup = () => {};
let gameFinished = false;
let pongMode = 'cpu';
let runScore = 0;
let creditedRunScore = 0;

const shopItems = {
  'lime-trail': { price: 250, type: 'cosmetic' },
  'pink-pulse': { price: 350, type: 'cosmetic' },
  'slow-snake': { price: 300, type: 'upgrade' },
  'bot-lag': { price: 400, type: 'upgrade' }
};
function readStorage(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch (error) { return fallback; } }
let credits = Number(readStorage('pixelPartyCredits', 0));
let ownedShopItems = {};
try { ownedShopItems = JSON.parse(readStorage('pixelPartyShopItems', '{}')) || {}; } catch (error) { ownedShopItems = {}; }
let equippedCosmetic = readStorage('pixelPartyCosmetic');

function setScore(points) {
  const earned = points - creditedRunScore;
  if (earned > 0) {
    credits += earned;
    creditedRunScore = points;
    saveShopState();
    if (shopNoteEl) shopNoteEl.textContent = `+${earned} ARCADE CREDIT${earned === 1 ? '' : 'S'} banked from ${currentGame.toUpperCase()}.`;
  }
  runScore = points;
  const bestKey = `pixelPartyBest:${currentGame}`;
  let best = points;
  try {
    best = Math.max(points, Number(localStorage.getItem(bestKey) || 0));
    if (points >= best) localStorage.setItem(bestKey, String(points));
  } catch (error) {
    // Scores still work in restricted/private contexts; persistence is optional.
  }
  scoreEl.textContent = `SCORE ${String(points).padStart(6, '0')}`;
  bestScoreEl.textContent = `BEST ${String(best).padStart(6, '0')}`;
}

function saveShopState() {
  try {
    localStorage.setItem('pixelPartyCredits', String(credits));
    localStorage.setItem('pixelPartyShopItems', JSON.stringify(ownedShopItems));
    localStorage.setItem('pixelPartyCosmetic', equippedCosmetic);
  } catch (error) {
    // The shop remains usable for the current session if storage is restricted.
  }
  renderShop();
}

function hasUpgrade(id) { return Boolean(ownedShopItems[id]); }

function applyCosmetic() {
  document.body.classList.remove('cosmetic-lime-trail', 'cosmetic-pink-pulse');
  if (equippedCosmetic) document.body.classList.add(`cosmetic-${equippedCosmetic}`);
}

function renderShop() {
  if (!creditBalanceEl) return;
  creditBalanceEl.textContent = String(Math.floor(credits)).padStart(6, '0');
  document.querySelectorAll('[data-shop-item]').forEach((card) => {
    const id = card.dataset.shopItem;
    const item = shopItems[id];
    const button = card.querySelector('[data-shop-action]');
    const owned = Boolean(ownedShopItems[id]);
    if (owned && item.type === 'cosmetic') {
      const equipped = equippedCosmetic === id;
      button.textContent = equipped ? 'EQUIPPED' : 'EQUIP';
      button.className = `shop-button ${equipped ? 'equipped' : 'owned'}`;
      button.disabled = false;
    } else if (owned) {
      button.textContent = 'OWNED';
      button.className = 'shop-button owned';
      button.disabled = true;
    } else {
      button.innerHTML = `BUY · <b>${item.price}</b>`;
      button.className = 'shop-button';
      button.disabled = credits < item.price;
    }
  });
}

document.querySelectorAll('[data-shop-item]').forEach((card) => card.querySelector('[data-shop-action]').addEventListener('click', () => {
  const id = card.dataset.shopItem;
  const item = shopItems[id];
  if (ownedShopItems[id] && item.type === 'cosmetic') {
    equippedCosmetic = equippedCosmetic === id ? '' : id;
    applyCosmetic();
    saveShopState();
    shopNoteEl.textContent = equippedCosmetic ? `${id.replace('-', ' ').toUpperCase()} equipped across the arcade.` : 'Cosmetic unequipped.';
    return;
  }
  if (ownedShopItems[id] || credits < item.price) return;
  credits -= item.price;
  ownedShopItems[id] = true;
  if (item.type === 'cosmetic') { equippedCosmetic = id; applyCosmetic(); }
  saveShopState();
  shopNoteEl.textContent = `${id.replace('-', ' ').toUpperCase()} unlocked.`;
}));
applyCosmetic();
renderShop();

const games = {
  snake: { label: 'SNAKE//RUN', instruction: "Use arrow keys to move. Eat the nodes. Don't collide." },
  tetris: { label: 'TETRIS//STACK', instruction: 'Move, drop, and clear complete rows or columns.' },
  '2048': { label: '2048//MERGE', instruction: 'Combine matching tiles to reach 2048.' },
  pong: { label: 'PONG//DUEL', instruction: 'Move with W/S or ↑/↓. Keep the signal alive.' }
};

function openGame(name) {
  cleanup();
  currentGame = name;
  gameFinished = false;
  pongModeButton.hidden = name !== 'pong';
  pongModeButton.textContent = pongMode === 'cpu' ? '2P LOCAL' : '1P BOT';
  title.textContent = name.toUpperCase();
  document.querySelector('#modalLabel').textContent = games[name].label;
  instructions.textContent = games[name].instruction;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  runScore = 0;
  creditedRunScore = 0;
  setScore(0);
  cleanup = renderGame(name);
}

function closeGame() {
  cleanup();
  cleanup = () => {};
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.querySelectorAll('.game-card').forEach((card) => card.addEventListener('click', () => openGame(card.dataset.game)));
document.querySelector('#closeModal').addEventListener('click', closeGame);
modal.addEventListener('click', (event) => { if (event.target === modal) closeGame(); });
document.querySelector('#restartGame').addEventListener('click', () => openGame(currentGame));
 pongModeButton.addEventListener('click', () => { pongMode = pongMode === 'cpu' ? 'local' : 'cpu'; openGame('pong'); });
document.addEventListener('keydown', (event) => {
  if (!modal.classList.contains('open')) return;
  if (event.key === 'Escape') closeGame();
  if (event.key.toLowerCase() === 'r' && gameFinished) openGame(currentGame);
});

function renderGame(name) {
  if (name === 'snake') return snake();
  if (name === 'pong') return pong();
  if (name === '2048') return game2048();
  return tetris();
}

function snake() {
  const width = 13, height = 11;
  let body = [{ x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 }];
  let direction = { x: 1, y: 0 }, queuedDirection = { x: 1, y: 0 };
  let food = { x: 10, y: 3 }, points = 0, over = false, lastStep = 0, raf = 0;
  stage.innerHTML = '<div class="snake-stage" id="snakeStage"></div>';
  const board = document.querySelector('#snakeStage');
  for (let x = 0; x < width; x += 1) for (let y = 0; y < height; y += 1) {
    const cell = document.createElement('i'); cell.className = 'stage-cell'; cell.style.left = `${x * 25}px`; cell.style.top = `${y * 25}px`; board.append(cell);
  }
  function draw() {
    board.querySelectorAll('.stage-segment, .stage-food').forEach((node) => node.remove());
    body.forEach((part, index) => { const segment = document.createElement('i'); segment.className = `stage-segment ${index ? 'body' : ''}`; segment.style.left = `${part.x * 25}px`; segment.style.top = `${part.y * 25}px`; board.append(segment); });
    const pellet = document.createElement('i'); pellet.className = 'stage-food'; pellet.style.left = `${food.x * 25 + 4}px`; pellet.style.top = `${food.y * 25 + 4}px`; board.append(pellet);
    setScore(points);
  }
  function step(time) {
    if (over) return;
    if (time - lastStep >= (hasUpgrade('slow-snake') ? 150 : 125)) {
      lastStep = time; direction = queuedDirection;
      const head = { x: body[0].x + direction.x, y: body[0].y + direction.y };
      const hitSelf = body.some((part, index) => index > 0 && part.x === head.x && part.y === head.y);
      if (head.x < 0 || head.x >= width || head.y < 0 || head.y >= height || hitSelf) { over = true; gameFinished = true; instructions.textContent = 'Signal lost. Press RESTART or press R to reconnect.'; return; }
      body.unshift(head);
      if (head.x === food.x && head.y === food.y) { points += 100; do { food = { x: Math.floor(Math.random() * width), y: Math.floor(Math.random() * height) }; } while (body.some((part) => part.x === food.x && part.y === food.y)); } else body.pop();
      draw();
    }
    raf = requestAnimationFrame(step);
  }
  function key(event) { event.preventDefault(); const dirs = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } }; const next = dirs[event.key]; if (next && (next.x !== -direction.x || next.y !== -direction.y)) queuedDirection = next; }
  document.addEventListener('keydown', key); draw(); raf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', key); };
}

function game2048() {
  let grid = Array(16).fill(0), points = 0, locked = false;
  const board = document.createElement('div'); board.style.cssText = 'display:grid;grid-template-columns:repeat(4,65px);gap:7px;padding:12px;background:#11152a'; stage.innerHTML = ''; stage.append(board);
  function addTile() { const empty = grid.map((value, index) => value ? null : index).filter((index) => index !== null); if (empty.length) grid[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4; }
  function draw(moved = false, merged = []) {
    board.innerHTML = '';
    grid.forEach((value, index) => { const element = document.createElement('i'); element.className = `game-tile ${value ? 'tile-pop' : ''} ${merged.includes(index) ? 'tile-merge' : ''}`; element.style.cssText = 'width:65px;height:65px;display:grid;place-items:center;background:#20233b;color:#fff;font:bold 20px var(--mono);font-style:normal;transition:transform .16s ease,background .16s ease'; if (value) { element.textContent = value; element.style.background = value >= 16 ? '#53224e' : '#413150'; element.style.color = value >= 64 ? 'var(--lime)' : value >= 16 ? 'var(--pink)' : 'var(--cyan)'; } if (moved) { element.style.transform = 'scale(.86)'; requestAnimationFrame(() => { element.style.transform = 'scale(1)'; }); } board.append(element); });
    setScore(points);
  }
  function move(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || locked) return;
    event.preventDefault(); locked = true; const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'; let rows = [];
    for (let i = 0; i < 4; i += 1) rows.push(horizontal ? grid.slice(i * 4, i * 4 + 4) : [grid[i], grid[i + 4], grid[i + 8], grid[i + 12]]);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') rows.forEach((row) => row.reverse());
    const merged = [];
    rows = rows.map((row, rowIndex) => { row = row.filter(Boolean); for (let i = 0; i < row.length - 1; i += 1) if (row[i] === row[i + 1]) { row[i] *= 2; points += row[i]; merged.push(horizontal ? rowIndex * 4 + i : rowIndex + i * 4); row.splice(i + 1, 1); } while (row.length < 4) row.push(0); return row; });
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') rows.forEach((row) => row.reverse());
    const next = Array(16).fill(0); for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) next[horizontal ? i * 4 + j : i + j * 4] = rows[i][j];
    if (next.some((value, index) => value !== grid[index])) { grid = next; addTile(); draw(true, merged); if (!grid.includes(0) && !hasMoves()) { gameFinished = true; instructions.textContent = 'No moves left. Press RESTART or press R to reconnect.'; } } else draw();
    window.setTimeout(() => { locked = false; }, 160);
  }
  function hasMoves() { return grid.some((value, index) => (index % 4 < 3 && value === grid[index + 1]) || (index < 12 && value === grid[index + 4])); }
  grid[0] = 2; grid[5] = 2; addTile(); draw(); instructions.textContent = 'Arrow keys to merge. Tiles pulse when they move or combine.'; document.addEventListener('keydown', move);
  return () => document.removeEventListener('keydown', move);
}

function tetris() {
  const cols = 10, rows = 12;
  const types = [
    { name: 'I', color: 'var(--cyan)', shape: [[1, 1, 1, 1]] },
    { name: 'J', color: 'var(--purple)', shape: [[1, 0, 0], [1, 1, 1]] },
    { name: 'L', color: '#ff9a4a', shape: [[0, 0, 1], [1, 1, 1]] },
    { name: 'O', color: '#ffe14b', shape: [[1, 1], [1, 1]] },
    { name: 'S', color: 'var(--lime)', shape: [[0, 1, 1], [1, 1, 0]] },
    { name: 'T', color: 'var(--pink)', shape: [[0, 1, 0], [1, 1, 1]] },
    { name: 'Z', color: '#ff6b78', shape: [[1, 1, 0], [0, 1, 1]] }
  ];
  let boardState = Array.from({ length: rows }, () => Array(cols).fill(''));
  let piece = makePiece(randomType()), nextPiece = makePiece(randomType());
  let points = 0, gameOver = false, timer;
  stage.innerHTML = '<div class="tetris-layout"><div id="tetStage"></div><aside class="tetris-preview"><span>NEXT</span><div id="tetNext"></div><small>↑ ROTATE<br />SPACE DROP</small></aside></div>';
  const board = document.querySelector('#tetStage');
  const preview = document.querySelector('#tetNext');
  board.style.cssText = `position:relative;width:${cols * 25}px;height:${rows * 25}px;background-image:linear-gradient(rgba(100,228,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(100,228,255,.08) 1px,transparent 1px);background-size:25px 25px`;
  function randomType() { return types[Math.floor(Math.random() * types.length)]; }
  function makePiece(type) { return { name: type.name, x: 3, y: 0, color: type.color, shape: type.shape.map((row) => [...row]) }; }
  function cellsFor(current = piece) { return current.shape.flatMap((line, y) => line.map((filled, x) => filled ? { x: current.x + x, y: current.y + y } : null).filter(Boolean)); }
  function canMove(test) { return cellsFor(test).every(({ x, y }) => x >= 0 && x < cols && y < rows && y >= 0 && !boardState[y][x]); }
  function rotateShape(shape) {
    const rotated = shape[0].map((_, x) => shape.map((row) => row[x]).reverse());
    const filled = rotated.flatMap((row, y) => row.map((cell, x) => cell ? { x, y } : null).filter(Boolean));
    const minX = Math.min(...filled.map((cell) => cell.x)), maxX = Math.max(...filled.map((cell) => cell.x));
    const minY = Math.min(...filled.map((cell) => cell.y)), maxY = Math.max(...filled.map((cell) => cell.y));
    return rotated.slice(minY, maxY + 1).map((row) => row.slice(minX, maxX + 1));
  }
  function draw() {
    board.innerHTML = '';
    boardState.flatMap((line, y) => line.map((color, x) => color ? { color, x, y } : null).filter(Boolean)).forEach((cell) => { const el = document.createElement('i'); el.className = 'stage-segment'; el.style.cssText = `left:${cell.x * 25}px;top:${cell.y * 25}px;background:${cell.color}`; board.append(el); });
    cellsFor().forEach(({ x, y }) => { const el = document.createElement('i'); el.className = 'stage-segment'; el.style.cssText = `left:${x * 25}px;top:${y * 25}px;background:${piece.color}`; board.append(el); });
    preview.innerHTML = '';
    nextPiece.shape.forEach((row, y) => row.forEach((filled, x) => { if (filled) { const el = document.createElement('i'); el.style.cssText = `left:${x * 21}px;top:${y * 21}px;background:${nextPiece.color}`; preview.append(el); } }));
    setScore(points);
  }
  function clearLines() {
    const fullRows = boardState.map((line, y) => line.every(Boolean) ? y : -1).filter((y) => y >= 0);
    const fullColumns = Array.from({ length: cols }, (_, x) => boardState.every((line) => line[x]) ? x : -1).filter((x) => x >= 0);
    if (fullRows.length || fullColumns.length) { board.classList.add('line-flash'); if (fullRows.length) { boardState = boardState.filter((_, y) => !fullRows.includes(y)); while (boardState.length < rows) boardState.unshift(Array(cols).fill('')); } fullColumns.forEach((x) => boardState.forEach((line) => { line[x] = ''; })); points += (fullRows.length + fullColumns.length) * 250; window.setTimeout(() => board.classList.remove('line-flash'), 220); }
  }
  function spawn() { piece = { ...nextPiece, x: 3, y: 0, shape: nextPiece.shape.map((row) => [...row]) }; nextPiece = makePiece(randomType()); if (!canMove(piece)) { gameOver = true; gameFinished = true; instructions.textContent = 'Stack overflow. Press RESTART or press R to reconnect.'; clearInterval(timer); } }
  function lock() { cellsFor().forEach(({ x, y }) => { boardState[y][x] = piece.color; }); points += 40; clearLines(); spawn(); draw(); }
  function drop() { if (gameOver) return; const next = { ...piece, y: piece.y + 1 }; if (canMove(next)) piece = next; else lock(); draw(); }
  function rotate() { const rotated = { ...piece, shape: rotateShape(piece.shape) }; for (const offset of [0, -1, 1, -2, 2]) { const candidate = { ...rotated, x: piece.x + offset }; if (canMove(candidate)) { piece = candidate; draw(); return; } } }
  function hardDrop() { if (gameOver) return; let distance = 0; while (canMove({ ...piece, y: piece.y + 1 })) { piece.y += 1; distance += 1; } points += distance * 2; lock(); }
  function key(event) { if (gameOver) return; if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'x', 'X', ' '].includes(event.key)) event.preventDefault(); if (event.key === 'ArrowUp' || event.key === 'x' || event.key === 'X') rotate(); else if (event.key === ' ') hardDrop(); else if (event.key === 'ArrowDown') { points += 1; drop(); } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { const next = { ...piece, x: piece.x + (event.key === 'ArrowLeft' ? -1 : 1) }; if (canMove(next)) piece = next; draw(); } }
  instructions.textContent = '← → move · ↑ rotate · ↓ soft drop · SPACE hard drop'; document.addEventListener('keydown', key); draw(); timer = setInterval(drop, 520);
  return () => { clearInterval(timer); document.removeEventListener('keydown', key); };
}

function pong() {
  let playerY = 110, cpuY = 110, ballX = 190, ballY = 130, vx = 3.5, vy = 2.2, points = 0, over = false, intermission = false, raf = 0, last = 0, serveTimer = 0; const held = new Set();
  stage.innerHTML = '<div id="pongStage"></div>'; const board = document.querySelector('#pongStage'); board.style.cssText = 'position:relative;width:400px;height:275px;border:1px dashed rgba(100,228,255,.3);max-width:100%;overflow:hidden';
  function draw() { board.innerHTML = `<i style="position:absolute;left:12px;top:${playerY}px;width:8px;height:55px;background:var(--cyan);box-shadow:0 0 12px var(--cyan)"></i><i style="position:absolute;right:12px;top:${cpuY}px;width:8px;height:55px;background:var(--pink)"></i><i style="position:absolute;left:${ballX}px;top:${ballY}px;width:12px;height:12px;background:var(--lime);box-shadow:0 0 12px var(--lime)"></i>`; setScore(points); }
  function keydown(event) { const key = event.key.toLowerCase(); if (['arrowup', 'arrowdown', 'w', 's'].includes(key)) { event.preventDefault(); held.add(key); } }
  function keyup(event) { held.delete(event.key.toLowerCase()); }
  function serve() { ballX = 194; ballY = 130; const speed = 3.5 + Math.random() * 1.25; vx = (Math.random() < 0.5 ? -1 : 1) * speed; vy = (Math.random() * 2 - 1) * 2.8; intermission = false; instructions.textContent = pongMode === 'cpu' ? 'Hold W/S or ↑/↓ to move your paddle.' : '2P LOCAL · P1 W/S · P2 ↑/↓'; }
  function finishRound(playerWon) { if (intermission) return; intermission = true; if (playerWon) points += 100; instructions.textContent = playerWon ? 'ROUND WON · NEXT SERVE IN 2 SECONDS' : 'ROUND LOST · NEXT SERVE IN 2 SECONDS'; serveTimer = window.setTimeout(serve, 2000); }
  function loop(time) { if (over) return; const delta = Math.min((time - last) / 16.67 || 1, 2); last = time; if (held.has('w')) playerY -= 5 * delta; if (held.has('s')) playerY += 5 * delta; if (pongMode === 'local') { if (held.has('arrowup')) cpuY -= 5 * delta; if (held.has('arrowdown')) cpuY += 5 * delta; } else { const botSpeed = hasUpgrade('bot-lag') ? 2.35 : 3.25, botCenter = cpuY + 27.5, reactionError = Math.sin(time / 420) * (hasUpgrade('bot-lag') ? 22 : 12), botTarget = ballY + 6 + reactionError; if (vx > 0 && botTarget > botCenter + 5) cpuY += Math.min(botSpeed * delta, botTarget - botCenter); if (vx > 0 && botTarget < botCenter - 5) cpuY -= Math.min(botSpeed * delta, botCenter - botTarget); } playerY = Math.max(0, Math.min(220, playerY)); cpuY = Math.max(0, Math.min(220, cpuY)); if (!intermission) { ballX += vx * delta; ballY += vy * delta; if (ballY <= 0 || ballY >= 263) vy *= -1; if (ballX <= 28 && ballY + 12 >= playerY && ballY <= playerY + 55) { vx = Math.abs(vx) + .15; points += 10; } if (ballX >= 355 && ballY + 12 >= cpuY && ballY <= cpuY + 55) vx = -Math.abs(vx); if (ballX < -15) finishRound(false); if (ballX > 420) finishRound(true); } draw(); raf = requestAnimationFrame(loop); }
  instructions.textContent = pongMode === 'cpu' ? 'Hold W/S or ↑/↓ to move your paddle.' : '2P LOCAL · P1 W/S · P2 ↑/↓'; document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup); draw(); raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); window.clearTimeout(serveTimer); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); };
}

document.querySelector('#randomScore').addEventListener('click', (event) => { const names = ['starbyte', 'ctrl_alt_win', 'moonbyte', 'studybreak.exe', 'limewire']; event.currentTarget.textContent = `ALIAS: ${names[Math.floor(Math.random() * names.length)]}`; });
