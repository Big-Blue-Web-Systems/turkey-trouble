(() => {
  const PRIZE_VALUES = [
    500, 1000, 1500, 2000,
    2500, 3000, 3500, 4000,
    4500, 5000, 750, 1250,
  ];

  const LAYOUT = [
    { row: 1, col: 1 },
    { row: 1, col: 2 },
    { row: 1, col: 3 },
    { row: 1, col: 4 },
    { row: 2, col: 4 },
    { row: 3, col: 4 },
    { row: 4, col: 4 },
    { row: 4, col: 3 },
    { row: 4, col: 2 },
    { row: 4, col: 1 },
    { row: 3, col: 1 },
    { row: 2, col: 1 },
  ];

  const SPIN_MIN_MS = 70;
  const SPIN_MAX_MS = 140;
  const REACTION_DELAY_MS = 750;
  const TURKEY_ANIM_MS = 2200;
  const FAVORITES_KEY = "turkeyTroubleFavorites";

  const LEAF_SVG = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="#c45c26" d="M32 4c8 10 22 14 26 28-10 2-18 10-22 22-4-12-14-20-26-22C14 18 24 14 32 4z"/>
      <path fill="#8a3d12" d="M32 10c0 18-2 30-4 46" stroke="#6b2e0a" stroke-width="2" fill="none"/>
      <path fill="#e87a1e" d="M20 22c6 4 10 10 12 18-8-2-14-8-18-14 2-2 4-3 6-4z"/>
      <path fill="#6b8f3c" d="M44 20c-4 6-6 12-6 20 8-4 12-10 14-16-2-2-5-3-8-4z"/>
    </svg>
  `);

  const LEAF2_SVG = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <path fill="#6b8f3c" d="M32 6c10 8 20 20 18 34-12-2-20 6-26 18C18 44 8 34 10 20 18 14 26 10 32 6z"/>
      <path d="M30 12c2 14 2 28 0 42" stroke="#3d5c24" stroke-width="2.5" fill="none"/>
      <path fill="#c6a832" d="M18 28c6 2 10 8 12 14-6 0-12-4-16-10 1-2 2-3 4-4z"/>
    </svg>
  `);

  const CORNUCOPIA_SVG = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
      <path fill="#b87333" d="M8 48c8-22 28-36 52-38 10 18 8 34-2 48-18 4-34 2-50-10z"/>
      <path fill="#8a5a2b" d="M58 12c16 4 30 16 36 32-12 8-24 10-38 6 4-12 4-26 2-38z"/>
      <circle cx="78" cy="22" r="7" fill="#e85a45"/>
      <circle cx="92" cy="30" r="6" fill="#f0b429"/>
      <circle cx="84" cy="36" r="5" fill="#6b8f3c"/>
      <circle cx="70" cy="28" r="5" fill="#c45c26"/>
      <ellipse cx="98" cy="40" rx="5" ry="7" fill="#8bc34a"/>
      <path fill="#f5d76e" d="M88 18l3 8 8 2-6 5 2 8-7-4-7 4 2-8-6-5 8-2z"/>
    </svg>
  `);

  const DECORATIONS = [
    { src: LEAF_SVG, x: 2, y: 2, w: 22, rot: -28 },
    { src: LEAF2_SVG, x: 78, y: 0, w: 20, rot: 18 },
    { src: LEAF_SVG, x: 70, y: 78, w: 18, rot: 140 },
    { src: LEAF2_SVG, x: 8, y: 72, w: 16, rot: -150 },
    { src: CORNUCOPIA_SVG, x: 0, y: 55, w: 34, rot: -8 },
    { src: CORNUCOPIA_SVG, x: 68, y: 52, w: 32, rot: 8, flip: true },
  ];

  const board = document.getElementById("board");
  const camera = document.getElementById("camera");
  const captureCanvas = document.getElementById("capture");
  const cameraStatus = document.getElementById("camera-status");
  const cameraWell = board.querySelector(".camera-well");
  const resultBanner = document.getElementById("result-banner");
  const festiveOverlay = document.getElementById("festive-overlay");
  const turkeyBlast = document.getElementById("turkey-blast");
  const scoreEl = document.getElementById("score");
  const scoreLabel = document.getElementById("score-label");
  const reactionStrip = document.getElementById("reaction-strip");
  const btnAction = document.getElementById("btn-action");
  const btnBank = document.getElementById("btn-bank");
  const controls = document.getElementById("controls");
  const setupPanel = document.getElementById("setup-panel");
  const btnAddPlayers = document.getElementById("btn-add-players");
  const playersEditor = document.getElementById("players-editor");
  const addPlayerForm = document.getElementById("add-player-form");
  const playerNameInput = document.getElementById("player-name-input");
  const playerList = document.getElementById("player-list");
  const btnStartGame = document.getElementById("btn-start-game");
  const leaderboard = document.getElementById("leaderboard");
  const leaderboardList = document.getElementById("leaderboard-list");
  const modalRoot = document.getElementById("modal-root");
  const modalTitle = document.getElementById("modal-title");
  const modalSubtitle = document.getElementById("modal-subtitle");
  const modalBody = document.getElementById("modal-body");
  const modalActions = document.getElementById("modal-actions");

  /** @type {{ value: number, isTurkey: boolean, el: HTMLButtonElement }[]} */
  let tiles = [];
  /** @type {{ name: string, banked: number, reactions: {dataUrl:string,label:string,bust:boolean}[], favorite: string|null, done: boolean }[]} */
  let players = [];
  let currentPlayer = 0;
  let turnScore = 0;
  let spinsThisTurn = 0;
  let gameStarted = false;
  let canAct = false;
  let turnOver = false;
  let spinning = false;
  let awaitingChoice = false;
  let litIndex = -1;
  let spinTimer = null;
  let reactionTimer = null;
  /** @type {Promise<void>|null} */
  let reactionCapturePromise = null;
  let audioCtx = null;
  let musicNodes = null;
  let dragFromIndex = null;
  let selectedFavoriteIndex = -1;
  let endTurnPlayerIndex = -1;

  const decoImages = DECORATIONS.map((d) => {
    const img = new Image();
    img.src = `data:image/svg+xml,${d.src}`;
    return img;
  });

  function buildFestiveOverlay() {
    festiveOverlay.innerHTML = "";
    DECORATIONS.forEach((d) => {
      const el = document.createElement("img");
      el.className = "deco";
      el.src = `data:image/svg+xml,${d.src}`;
      el.alt = "";
      el.style.left = `${d.x}%`;
      el.style.top = `${d.y}%`;
      el.style.width = `${d.w}%`;
      el.style.transform = `${d.flip ? "scaleX(-1) " : ""}rotate(${d.rot}deg)`;
      festiveOverlay.appendChild(el);
    });
  }

  function buildBoard() {
    board.querySelectorAll(".tile").forEach((el) => el.remove());

    tiles = PRIZE_VALUES.map((value, i) => {
      const slot = LAYOUT[i];
      const el = document.createElement("button");
      el.type = "button";
      el.className = "tile";
      el.style.gridRow = String(slot.row);
      el.style.gridColumn = String(slot.col);
      el.dataset.index = String(i);
      el.innerHTML = `<span class="label">${formatValue(value)}</span>`;
      el.setAttribute("aria-label", `${value} points`);
      board.insertBefore(el, cameraWell);
      return { value, isTurkey: false, el };
    });
  }

  function formatValue(n) {
    return n.toLocaleString();
  }

  function activeRunningTotal() {
    const p = players[currentPlayer];
    if (!p) return turnScore;
    return p.banked + turnScore;
  }

  function setTurnScore(n) {
    turnScore = n;
    scoreEl.textContent = activeRunningTotal().toLocaleString();
    if (gameStarted) renderLeaderboard();
  }

  function setLit(index) {
    if (litIndex >= 0 && tiles[litIndex]) {
      tiles[litIndex].el.classList.remove("is-lit");
    }
    litIndex = index;
    if (litIndex >= 0 && tiles[litIndex]) {
      tiles[litIndex].el.classList.add("is-lit");
    }
  }

  function setBankVisible(visible) {
    btnBank.hidden = false;
    btnBank.classList.toggle("is-slot-hidden", !visible);
    btnBank.disabled = !visible;
  }

  function updateActionButton() {
    btnAction.classList.remove("is-start", "is-stop", "is-keep");

    if (spinning) {
      btnAction.textContent = "Stop";
      btnAction.classList.add("is-stop");
      btnAction.disabled = false;
      setBankVisible(false);
      return;
    }

    if (!gameStarted || !canAct || turnOver) {
      btnAction.textContent = spinsThisTurn === 0 ? "Start" : "Keep Going";
      btnAction.classList.add(spinsThisTurn === 0 ? "is-start" : "is-keep");
      btnAction.disabled = true;
      setBankVisible(false);
      return;
    }

    if (awaitingChoice) {
      btnAction.textContent = "Keep Going";
      btnAction.classList.add("is-keep");
      btnAction.disabled = false;
      setBankVisible(true);
      return;
    }

    if (spinsThisTurn === 0) {
      btnAction.textContent = "Start";
      btnAction.classList.add("is-start");
    } else {
      btnAction.textContent = "Keep Going";
      btnAction.classList.add("is-keep");
    }
    btnAction.disabled = false;
    setBankVisible(false);
  }

  function showBanner(text, isTurkey = false) {
    resultBanner.hidden = false;
    resultBanner.textContent = text;
    resultBanner.classList.toggle("is-turkey", isTurkey);
  }

  function hideBanner() {
    resultBanner.hidden = true;
    resultBanner.textContent = "";
    resultBanner.classList.remove("is-turkey");
  }

  function clearReactionStrip() {
    reactionStrip.innerHTML = "";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPlayerList() {
    playerList.innerHTML = "";
    players.forEach((p, index) => {
      const li = document.createElement("li");
      li.className = "player-chip";
      li.draggable = true;
      li.dataset.index = String(index);
      li.innerHTML = `
        <span class="handle" aria-hidden="true">⠿</span>
        <span class="order" aria-label="Turn ${index + 1}">${index + 1}</span>
        <span class="name">${escapeHtml(p.name)}</span>
        <button type="button" class="remove" aria-label="Remove ${escapeHtml(p.name)}">×</button>
      `;
      li.querySelector(".remove").addEventListener("click", () => {
        players.splice(index, 1);
        renderPlayerList();
        syncSetupButtons();
        if (gameStarted) renderLeaderboard();
      });

      li.addEventListener("dragstart", () => {
        dragFromIndex = index;
        li.classList.add("is-dragging");
      });
      li.addEventListener("dragend", () => {
        dragFromIndex = null;
        li.classList.remove("is-dragging");
        playerList.querySelectorAll(".is-drag-over").forEach((el) => el.classList.remove("is-drag-over"));
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        li.classList.add("is-drag-over");
      });
      li.addEventListener("dragleave", () => li.classList.remove("is-drag-over"));
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("is-drag-over");
        if (dragFromIndex === null || dragFromIndex === index) return;
        const [moved] = players.splice(dragFromIndex, 1);
        players.splice(index, 0, moved);
        renderPlayerList();
      });

      playerList.appendChild(li);
    });
  }

  function syncSetupButtons() {
    if (gameStarted) {
      btnStartGame.textContent = "Done";
      btnStartGame.disabled = false;
    } else {
      btnStartGame.textContent = "Start Game";
      btnStartGame.disabled = players.length === 0;
    }
  }

  function playerDisplayTotal(p, index) {
    if (index === currentPlayer && !p.done) return p.banked + turnScore;
    return p.banked;
  }

  function renderLeaderboard() {
    leaderboard.hidden = !gameStarted;
    if (!gameStarted) return;

    const ranked = players
      .map((p, index) => ({ p, index, total: playerDisplayTotal(p, index) }))
      .sort((a, b) => b.total - a.total || a.index - b.index);

    leaderboardList.innerHTML = ranked
      .map(
        ({ p, index, total }, rank) => `
      <li class="leaderboard-row${index === currentPlayer && !p.done ? " is-active" : ""}${p.done ? " is-done" : ""}">
        <span class="lb-rank">${rank + 1}</span>
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-score">${formatValue(total)}</span>
      </li>`
      )
      .join("");
  }

  function loadFavoritesMap() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveFavorite(playerName, dataUrl) {
    const map = loadFavoritesMap();
    map[playerName] = dataUrl;
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(map));
  }

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function startMusic() {
    ensureAudio();
    stopMusic();

    const master = audioCtx.createGain();
    master.gain.value = 0.08;
    master.connect(audioCtx.destination);

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();

    osc1.type = "square";
    osc2.type = "triangle";
    osc1.frequency.value = 220;
    osc2.frequency.value = 330;

    lfo.frequency.value = 8;
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    const pulse = audioCtx.createGain();
    pulse.gain.value = 0;
    osc1.connect(pulse);
    osc2.connect(pulse);
    pulse.connect(master);

    const now = audioCtx.currentTime;
    for (let i = 0; i < 120; i++) {
      const t = now + i * 0.08;
      pulse.gain.setValueAtTime(0.9, t);
      pulse.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    }

    osc1.start();
    osc2.start();
    lfo.start();

    musicNodes = { osc1, osc2, lfo, master };
  }

  function stopMusic() {
    if (!musicNodes) return;
    try {
      musicNodes.osc1.stop();
      musicNodes.osc2.stop();
      musicNodes.lfo.stop();
      musicNodes.master.disconnect();
    } catch (_) {
      /* already stopped */
    }
    musicNodes = null;
  }

  function playSting(kind) {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (kind === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (kind === "bank") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.setValueAtTime(659, now + 0.1);
      osc.frequency.setValueAtTime(784, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (kind === "shot") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.45);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.55);
    }
  }

  function restartAnim(el) {
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  }

  function playTurkeyAnimation() {
    return new Promise((resolve) => {
      turkeyBlast.hidden = false;
      cameraWell.classList.add("is-blasting");

      restartAnim(turkeyBlast.querySelector(".turkey-blast-dim"));
      restartAnim(turkeyBlast.querySelector(".turkey-actor"));
      restartAnim(turkeyBlast.querySelector(".shotgun"));
      restartAnim(turkeyBlast.querySelector(".muzzle-flash"));
      restartAnim(turkeyBlast.querySelector(".bang"));

      setTimeout(() => playSting("shot"), 1050);
      setTimeout(() => {
        turkeyBlast.hidden = true;
        cameraWell.classList.remove("is-blasting");
        resolve();
      }, TURKEY_ANIM_MS);
    });
  }

  function pickNextIndex() {
    if (tiles.length === 0) return 0;
    if (litIndex < 0) return Math.floor(Math.random() * tiles.length);

    let next = litIndex;
    let tries = 0;
    while (next === litIndex && tries < 12) {
      const jump = 1 + Math.floor(Math.random() * Math.max(2, Math.floor(tiles.length / 2)));
      const dir = Math.random() < 0.5 ? 1 : -1;
      next = (litIndex + dir * jump + tiles.length * 10) % tiles.length;
      tries += 1;
    }
    return next;
  }

  function tickSpin() {
    if (!spinning) return;
    setLit(pickNextIndex());
    const delay = SPIN_MIN_MS + Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS);
    spinTimer = setTimeout(tickSpin, delay);
  }

  function startSpin() {
    if (!gameStarted || spinning || turnOver || !canAct) return;
    hideBanner();
    awaitingChoice = false;
    tiles.forEach((t) => t.el.classList.remove("is-awarded"));
    spinning = true;
    updateActionButton();
    startMusic();
    tickSpin();
  }

  function clearSpinTimers() {
    if (spinTimer) {
      clearTimeout(spinTimer);
      spinTimer = null;
    }
  }

  function stopSpin() {
    if (!spinning) return;
    spinning = false;
    clearSpinTimers();
    stopMusic();

    const landed = tiles[litIndex];
    if (!landed) {
      updateActionButton();
      return;
    }

    landed.el.classList.add("is-awarded");
    spinsThisTurn += 1;

    const awardedValue = landed.value;
    const wasTurkey = landed.isTurkey;
    const playerName = players[currentPlayer]?.name || "Player";

    reactionCapturePromise = new Promise((resolve) => {
      if (reactionTimer) clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        captureReaction({
          bust: wasTurkey,
          label: wasTurkey ? "Bust!" : `+${formatValue(awardedValue)}`,
          name: playerName,
        });
        reactionTimer = null;
        reactionCapturePromise = null;
        resolve();
      }, REACTION_DELAY_MS);
    });

    if (wasTurkey) {
      setTurnScore(0);
      turnOver = true;
      canAct = false;
      awaitingChoice = false;
      showBanner("TURKEY! Turn over", true);
      playSting("bust");
      updateActionButton();
      finishTurnAfterTurkey();
      return;
    }

    setTurnScore(turnScore + awardedValue);
    showBanner(`+${formatValue(awardedValue)}!`);
    playSting("win");

    landed.isTurkey = true;
    landed.el.classList.add("is-turkey");
    landed.el.querySelector(".label").textContent = "TURKEY";
    landed.el.setAttribute("aria-label", "Turkey");

    awaitingChoice = true;
    updateActionButton();
  }

  async function finishTurnAfterTurkey() {
    await playTurkeyAnimation();
    await (reactionCapturePromise || Promise.resolve());
    openEndTurnGallery("turkey");
  }

  function drawDecorations(ctx, w, h) {
    DECORATIONS.forEach((d, i) => {
      const img = decoImages[i];
      if (!img.complete || !img.naturalWidth) return;
      const dw = (d.w / 100) * w;
      const dh = (img.naturalHeight / img.naturalWidth) * dw;
      const x = (d.x / 100) * w;
      const y = (d.y / 100) * h;
      ctx.save();
      ctx.translate(x + dw / 2, y + dh / 2);
      if (d.flip) ctx.scale(-1, 1);
      ctx.rotate((d.rot * Math.PI) / 180);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    });
  }

  function captureReaction({ bust, label, name }) {
    if (!camera.srcObject) return;

    const w = camera.videoWidth || 640;
    const h = camera.videoHeight || 480;
    captureCanvas.width = w;
    captureCanvas.height = h;
    const ctx = captureCanvas.getContext("2d");

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, 0, 0, w, h);
    ctx.restore();
    drawDecorations(ctx, w, h);

    const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.85);
    const player = players[currentPlayer];
    if (player) {
      player.reactions.push({ dataUrl, label, bust });
    }

    const card = document.createElement("article");
    card.className = "reaction-card" + (bust ? " is-bust" : "");
    card.innerHTML = `
      <img src="${dataUrl}" alt="Reaction from ${escapeHtml(name)}" />
      <div class="meta"><strong>${label}</strong>${escapeHtml(name)}</div>
    `;
    reactionStrip.prepend(card);
  }

  async function bankPoints() {
    if (!awaitingChoice || spinning || turnOver) return;
    const bankedAmount = turnScore;
    players[currentPlayer].banked += bankedAmount;
    setTurnScore(0);
    showBanner(`Banked ${formatValue(bankedAmount)}!`);
    playSting("bank");
    awaitingChoice = false;
    canAct = false;
    turnOver = true;
    updateActionButton();
    await (reactionCapturePromise || Promise.resolve());
    openEndTurnGallery("bank");
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  function closeModal() {
    modalRoot.hidden = true;
    modalBody.innerHTML = "";
    modalActions.innerHTML = "";
    modalBody.classList.remove("is-winner");
  }

  function openEndTurnGallery(reason) {
    endTurnPlayerIndex = currentPlayer;
    const player = players[endTurnPlayerIndex];
    selectedFavoriteIndex = player.reactions.length ? 0 : -1;

    modalTitle.textContent = `${player.name}'s Reactions`;
    modalSubtitle.textContent =
      reason === "turkey"
        ? "Turkey got you! Pick your favorite reaction before the next player."
        : "Nice bank! Pick your favorite reaction before the next player.";

    renderGalleryBody(player);
    renderGalleryActions(player);
    modalRoot.hidden = false;
  }

  function renderGalleryBody(player) {
    modalBody.classList.remove("is-winner");
    if (!player.reactions.length) {
      modalBody.innerHTML = `<p class="modal-subtitle">No reaction photos this turn.</p>`;
      return;
    }

    modalBody.innerHTML = "";
    player.reactions.forEach((r, i) => {
      const item = document.createElement("div");
      item.className = "gallery-item" + (i === selectedFavoriteIndex ? " is-selected" : "");
      item.innerHTML = `
        <img src="${r.dataUrl}" alt="Reaction ${i + 1}" />
        <div class="g-meta"><strong>${escapeHtml(r.label)}</strong>${r.bust ? "Bust" : "Hit"}</div>
        <button type="button" class="btn-pick">${i === selectedFavoriteIndex ? "★ Favorite" : "Pick favorite"}</button>
        <button type="button" class="btn-dl">Download</button>
      `;
      item.querySelector("img").addEventListener("click", () => {
        selectedFavoriteIndex = i;
        renderGalleryBody(player);
        renderGalleryActions(player);
      });
      item.querySelector(".btn-pick").addEventListener("click", () => {
        selectedFavoriteIndex = i;
        renderGalleryBody(player);
        renderGalleryActions(player);
      });
      item.querySelector(".btn-dl").addEventListener("click", () => {
        downloadDataUrl(r.dataUrl, `${player.name}-reaction-${i + 1}.jpg`);
      });
      modalBody.appendChild(item);
    });
  }

  function renderGalleryActions(player) {
    modalActions.innerHTML = "";

    const dlAll = document.createElement("button");
    dlAll.type = "button";
    dlAll.className = "btn btn-download-all";
    dlAll.textContent = "Download All";
    dlAll.disabled = player.reactions.length === 0;
    dlAll.addEventListener("click", () => {
      player.reactions.forEach((r, i) => {
        downloadDataUrl(r.dataUrl, `${player.name}-reaction-${i + 1}.jpg`);
      });
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "btn btn-confirm-fav";
    confirm.textContent = "Continue";
    confirm.disabled = player.reactions.length > 0 && selectedFavoriteIndex < 0;
    confirm.addEventListener("click", () => {
      if (player.reactions.length && selectedFavoriteIndex >= 0) {
        const fav = player.reactions[selectedFavoriteIndex].dataUrl;
        player.favorite = fav;
        saveFavorite(player.name, fav);
      }
      closeModal();
      completePlayerTurn();
    });

    modalActions.appendChild(dlAll);
    modalActions.appendChild(confirm);
  }

  function completePlayerTurn() {
    players[endTurnPlayerIndex].done = true;
    clearReactionStrip();
    hideBanner();
    turnOver = false;
    awaitingChoice = false;
    spinsThisTurn = 0;
    turnScore = 0;
    setLit(-1);
    buildBoard();

    const next = players.findIndex((p) => !p.done);
    if (next === -1) {
      canAct = false;
      scoreEl.textContent = "0";
      renderLeaderboard();
      updateActionButton();
      showWinner();
      return;
    }

    currentPlayer = next;
    scoreLabel.textContent = players[currentPlayer].name;
    canAct = true;
    setTurnScore(0);
    updateActionButton();
  }

  function showWinner() {
    const topScore = Math.max(...players.map((p) => p.banked));
    const winners = players.filter((p) => p.banked === topScore);
    const winner = winners[0];
    const favMap = loadFavoritesMap();
    const photo = winner.favorite || favMap[winner.name] || winner.reactions.at(-1)?.dataUrl || null;

    modalTitle.textContent = winners.length > 1 ? "It's a tie!" : `${winner.name} wins!`;
    modalSubtitle.textContent =
      winners.length > 1
        ? `${winners.map((w) => w.name).join(" & ")} — ${formatValue(topScore)} points`
        : `${formatValue(topScore)} points banked`;

    modalBody.classList.add("is-winner");
    if (photo) {
      modalBody.innerHTML = `<img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(winner.name)}" />`;
    } else {
      modalBody.innerHTML = `<p class="modal-subtitle">No favorite photo saved.</p>`;
    }

    modalActions.innerHTML = "";
    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn btn-play-again";
    again.textContent = "Play Again";
    again.addEventListener("click", () => {
      closeModal();
      resetForNewGame();
    });
    modalActions.appendChild(again);
    modalRoot.hidden = false;
  }

  function resetForNewGame() {
    players.forEach((p) => {
      p.banked = 0;
      p.reactions = [];
      p.favorite = null;
      p.done = false;
    });
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = true;
    scoreLabel.textContent = players[0].name;
    clearReactionStrip();
    hideBanner();
    buildBoard();
    setTurnScore(0);
    updateActionButton();
    controls.hidden = false;
  }

  function collapsePlayersEditor() {
    playersEditor.hidden = true;
    btnAddPlayers.hidden = false;
    setupPanel.hidden = false;
    setupPanel.style.display = "";
    setupPanel.removeAttribute("aria-hidden");
  }

  function openPlayersEditor() {
    playersEditor.hidden = false;
    btnAddPlayers.hidden = true;
    syncSetupButtons();
    playerNameInput.focus();
  }

  function beginGame() {
    if (players.length === 0) return;
    gameStarted = true;
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = true;
    scoreLabel.textContent = players[currentPlayer].name;
    collapsePlayersEditor();
    controls.hidden = false;
    clearReactionStrip();
    buildBoard();
    setTurnScore(0);
    updateActionButton();
  }

  function onSetupPrimaryClick() {
    if (gameStarted) {
      collapsePlayersEditor();
      return;
    }
    beginGame();
  }

  function onActionClick() {
    if (spinning) stopSpin();
    else startSpin();
  }

  btnAddPlayers.addEventListener("click", openPlayersEditor);

  addPlayerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;
    players.push({ name, banked: 0, reactions: [], favorite: null, done: false });
    playerNameInput.value = "";
    renderPlayerList();
    syncSetupButtons();
    if (gameStarted) renderLeaderboard();
    playerNameInput.focus();
  });

  btnStartGame.addEventListener("click", onSetupPrimaryClick);
  btnAction.addEventListener("click", onActionClick);
  btnBank.addEventListener("click", () => {
    bankPoints();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && gameStarted && modalRoot.hidden) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (spinning) stopSpin();
      else if (canAct && !turnOver) startSpin();
    }
  });

  buildFestiveOverlay();
  buildBoard();
  updateActionButton();
  startCamera();

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = "Camera not supported in this browser.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      camera.srcObject = stream;
      cameraStatus.classList.add("is-hidden");
    } catch (err) {
      console.error(err);
      cameraStatus.textContent = "Camera permission needed — allow access and reload.";
    }
  }
})();
