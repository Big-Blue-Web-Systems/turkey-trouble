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
  const REACTION_DELAY_MS = 1000;
  /** Gunshot / feather-burst peak in turkey-trouble-fire.mp4 */
  const FIRE_GUNSHOT_MS = 150;
  const TILE_PULSE_MS = 550;
  const TILE_FLIP_MS = 450;
  const REACTION_FLASH_MS = 1000;
  const REACTION_CLIP_MS = 3000;
  const REACTION_CLIP_FPS = 10;
  const FAVORITES_KEY = "turkeyTroubleFavorites";

  const board = document.getElementById("board");
  const boardLights = document.getElementById("board-lights");
  const camera = document.getElementById("camera");
  const captureCanvas = document.getElementById("capture");
  const cameraStatus = document.getElementById("camera-status");
  const cameraWell = board.querySelector(".camera-well");
  const cameraBorder = document.querySelector(".camera-border");
  const bannerImage = new Image();
  bannerImage.decoding = "async";
  bannerImage.src = cameraBorder?.src || "assets/camera-border.png";
  const resultBanner = document.getElementById("result-banner");
  const turkeyBlast = document.getElementById("turkey-blast");
  const fireVideo = document.getElementById("fire-video");
  const bustVideo = document.getElementById("bust-video");
  const fireHit = document.getElementById("fire-hit");
  const reactionFlash = document.getElementById("reaction-flash");
  const reactionFlashImage = document.getElementById("reaction-flash-image");
  const turnHud = document.getElementById("turn-hud");
  const scoreEl = document.getElementById("score");
  const scoreLabel = document.getElementById("score-label");
  const reactionStrip = document.getElementById("reaction-strip");
  const reactionsStackWrap = document.querySelector(".reactions-stack-wrap");
  const reactionsPrevBtn = document.getElementById("reactions-prev");
  const reactionsNextBtn = document.getElementById("reactions-next");
  let reactionFocusIndex = 0;
  const REACTION_STACK_PEEK = 24;
  const REACTION_STACK_SCALE = 0.04;
  const REACTION_STACK_VISIBLE = 6;
  let reactionWheelLockUntil = 0;
  const btnAction = document.getElementById("btn-action");
  const btnBank = document.getElementById("btn-bank");
  const controls = document.getElementById("controls");
  const setupPanel = document.getElementById("setup-panel");
  const btnAddPlayers = document.getElementById("btn-add-players");
  const playersEditor = document.getElementById("players-editor");
  const addPlayerForm = document.getElementById("add-player-form");
  const playerNameInput = document.getElementById("player-name-input");
  const playerList = document.getElementById("player-list");
  const btnDonePlayers = document.getElementById("btn-done-players");
  const btnStartFromSetup = document.getElementById("btn-start-from-setup");
  const roundsPicker = document.getElementById("rounds-picker");
  const roundsTrigger = document.getElementById("rounds-trigger");
  const roundsTriggerValue = document.getElementById("rounds-trigger-value");
  const roundsMenu = document.getElementById("rounds-menu");
  const scoreboard = document.getElementById("scoreboard");
  const roundLabel = document.getElementById("round-label");
  const captureVideoToggle = document.getElementById("capture-video-toggle");
  let selectedRounds = 1;
  const soloWarning = document.getElementById("solo-warning");
  const leaderboard = document.getElementById("leaderboard");
  const leaderboardList = document.getElementById("leaderboard-list");
  const modalRoot = document.getElementById("modal-root");
  const modalTitle = document.getElementById("modal-title");
  const modalSubtitle = document.getElementById("modal-subtitle");
  const modalBody = document.getElementById("modal-body");
  const modalActions = document.getElementById("modal-actions");
  const previewModal = document.getElementById("preview-modal");
  const previewBackdrop = document.getElementById("preview-backdrop");
  const previewImage = document.getElementById("preview-image");
  const previewDownload = document.getElementById("preview-download");
  const previewClose = document.getElementById("preview-close");
  let previewDataUrl = "";
  let previewFilename = "reaction.jpg";

  /** @type {{ value: number, isTurkey: boolean, el: HTMLButtonElement }[]} */
  let tiles = [];
  /** @type {{ name: string, banked: number, reactions: {dataUrl:string,frames?:string[],frameIndex?:number,isClip?:boolean,label:string,bust:boolean}[], favorite: string|null, done: boolean, roundsPlayed: number }[]} */
  let players = [];
  let currentPlayer = 0;
  let totalRounds = 1;
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
  let gobbleGain = null;
  /** @type {Promise<void>|null} */
  let fireVideoPromise = null;
  let fireHitTimer = null;
  let tileRevealInProgress = false;
  let dragFromIndex = null;
  let selectedFavoriteIndex = -1;
  let endTurnPlayerIndex = -1;
  let soloStartArmed = false;

  /** @type {HTMLSpanElement[]} */
  let boardBulbs = [];
  /** @type {ReturnType<typeof setTimeout>[]} */
  let bulbTimers = [];
  const LIT_BULB_COUNT = 5;
  const BULB_SIDES = ["top", "right", "bottom", "left"];

  function bulbSideList(bulb) {
    return (bulb.dataset.sides || "").split(",").filter(Boolean);
  }

  function litBulbIndices() {
    return boardBulbs
      .map((b, i) => (b.classList.contains("is-on") ? i : -1))
      .filter((i) => i >= 0);
  }

  function sidesCoveredBy(indices) {
    const covered = new Set();
    indices.forEach((i) => {
      bulbSideList(boardBulbs[i]).forEach((s) => covered.add(s));
    });
    return covered;
  }

  function pickInitialLitBulbs() {
    const chosen = new Set();

    // One bulb per side first (prefer exclusive edge bulbs over corners)
    BULB_SIDES.forEach((side) => {
      const exclusive = [];
      const any = [];
      boardBulbs.forEach((b, i) => {
        const sides = bulbSideList(b);
        if (!sides.includes(side)) return;
        any.push(i);
        if (sides.length === 1) exclusive.push(i);
      });
      const pool = exclusive.length ? exclusive : any;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      chosen.add(pick);
    });

    while (chosen.size < Math.min(LIT_BULB_COUNT, boardBulbs.length)) {
      chosen.add(Math.floor(Math.random() * boardBulbs.length));
    }

    chosen.forEach((i) => boardBulbs[i].classList.add("is-on"));
  }

  function buildBoardLights() {
    if (!boardLights) return;
    boardLights.innerHTML = "";
    boardBulbs = [];

    // 7 per long side, 5 per short side (corners shared)
    const top = 7;
    const side = 5;
    const positions = [];

    for (let i = 0; i < top; i++) {
      const sides = ["top"];
      if (i === 0) sides.push("left");
      if (i === top - 1) sides.push("right");
      positions.push({ x: (i / (top - 1)) * 100, y: 0, sides });
    }
    for (let i = 1; i < side - 1; i++) {
      positions.push({ x: 100, y: (i / (side - 1)) * 100, sides: ["right"] });
    }
    for (let i = top - 1; i >= 0; i--) {
      const sides = ["bottom"];
      if (i === 0) sides.push("left");
      if (i === top - 1) sides.push("right");
      positions.push({ x: (i / (top - 1)) * 100, y: 100, sides });
    }
    for (let i = side - 2; i >= 1; i--) {
      positions.push({ x: 0, y: (i / (side - 1)) * 100, sides: ["left"] });
    }

    positions.forEach((pos) => {
      const bulb = document.createElement("span");
      bulb.className = "board-bulb";
      bulb.style.left = `${pos.x}%`;
      bulb.style.top = `${pos.y}%`;
      bulb.dataset.sides = pos.sides.join(",");
      boardLights.appendChild(bulb);
      boardBulbs.push(bulb);
    });

    pickInitialLitBulbs();
    startBulbTwinkle();
  }

  function startBulbTwinkle() {
    bulbTimers.forEach((t) => clearTimeout(t));
    bulbTimers = [];
    if (!boardBulbs.length) return;

    const scheduleMove = (fromIndex) => {
      const delay = 700 + Math.random() * 1600;
      const timer = setTimeout(() => {
        if (!boardBulbs.length) return;
        if (!boardBulbs[fromIndex].classList.contains("is-on")) {
          // Chain lost sync — restart from a random lit bulb
          const lit = litBulbIndices();
          if (lit.length) scheduleMove(lit[Math.floor(Math.random() * lit.length)]);
          return;
        }

        boardBulbs[fromIndex].classList.remove("is-on");
        const remaining = litBulbIndices();
        const covered = sidesCoveredBy(remaining);
        const uncovered = BULB_SIDES.filter((s) => !covered.has(s));

        const candidates = boardBulbs
          .map((b, i) => i)
          .filter((i) => {
            if (i === fromIndex) return false;
            if (boardBulbs[i].classList.contains("is-on")) return false;
            if (!uncovered.length) return true;
            const sides = bulbSideList(boardBulbs[i]);
            return uncovered.every((s) => sides.includes(s));
          });

        let next;
        if (candidates.length) {
          next = candidates[Math.floor(Math.random() * candidates.length)];
        } else {
          // Can't move without breaking side coverage — stay put
          boardBulbs[fromIndex].classList.add("is-on");
          next = fromIndex;
        }

        boardBulbs[next].classList.add("is-on");
        scheduleMove(next);
      }, delay);
      bulbTimers.push(timer);
    };

    litBulbIndices().forEach((i) => scheduleMove(i));
  }

  const TILE_TONES = [
    "tone-brown",
    "tone-amber",
    "tone-orange",
    "tone-gold",
    "tone-rust",
    "tone-maple",
    "tone-wheat",
    "tone-cider",
  ];

  function buildBoard() {
    board.querySelectorAll(".tile").forEach((el) => el.remove());

    tiles = PRIZE_VALUES.map((value, i) => {
      const slot = LAYOUT[i];
      const el = document.createElement("button");
      el.type = "button";
      el.className = `tile ${TILE_TONES[i % TILE_TONES.length]}`;
      el.style.gridRow = String(slot.row);
      el.style.gridColumn = String(slot.col);
      el.dataset.index = String(i);
      el.innerHTML = `
        <span class="tile-flipper">
          <span class="tile-face tile-face-front">
            <span class="label">${formatValue(value)}</span>
          </span>
          <span class="tile-face tile-face-back">
            <img class="turkey-pic" src="assets/turkey-tile.png" alt="" />
          </span>
        </span>
      `;
      el.setAttribute("aria-label", formatValue(value));
      board.insertBefore(el, cameraWell);
      return { value, isTurkey: false, el };
    });
  }

  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function clearTileRevealClasses() {
    board.classList.remove("is-revealing");
    tiles.forEach((t) => {
      t.el.classList.remove("is-dimmed", "is-reveal-target", "is-pulse");
    });
  }

  async function playPrizeReveal(tile) {
    tileRevealInProgress = true;
    board.classList.add("is-revealing");
    tiles.forEach((t) => {
      if (t === tile) {
        t.el.classList.add("is-reveal-target");
        t.el.classList.remove("is-dimmed");
      } else {
        t.el.classList.add("is-dimmed");
      }
    });

    tile.el.classList.remove("is-pulse");
    void tile.el.offsetWidth;
    tile.el.classList.add("is-pulse");
    await waitMs(TILE_PULSE_MS);
    tile.el.classList.remove("is-pulse");

    tile.isTurkey = true;
    tile.el.classList.add("is-turkey", "is-flipped");
    tile.el.setAttribute("aria-label", "Turkey");
    const label = tile.el.querySelector(".label");
    if (label) label.remove();
    await waitMs(TILE_FLIP_MS);

    clearTileRevealClasses();
    tileRevealInProgress = false;
  }

  function formatValue(n) {
    return `$${Number(n).toLocaleString()}`;
  }

  function activeRunningTotal() {
    const p = players[currentPlayer];
    if (!p) return turnScore;
    return p.banked + turnScore;
  }

  function setTurnScore(n) {
    turnScore = n;
    scoreEl.textContent = formatValue(activeRunningTotal());
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

    if (!gameStarted) {
      btnAction.textContent = "Pull!";
      btnAction.classList.add("is-start");
      btnAction.disabled = false;
      setBankVisible(false);
      return;
    }

    if (spinning) {
      btnAction.textContent = "Fire!";
      btnAction.classList.add("is-stop");
      btnAction.disabled = false;
      setBankVisible(false);
      return;
    }

    if (!canAct || turnOver) {
      btnAction.textContent = "Pull!";
      btnAction.classList.add("is-start");
      btnAction.disabled = true;
      setBankVisible(false);
      return;
    }

    if (awaitingChoice) {
      btnAction.textContent = "Pull!";
      btnAction.classList.add("is-start");
      btnAction.disabled = false;
      setBankVisible(true);
      return;
    }

    btnAction.textContent = "Pull!";
    btnAction.classList.add("is-start");
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
    reactionFocusIndex = 0;
    updateReactionsNav();
  }

  const reactionsLayoutQuery = window.matchMedia("(max-width: 760px)");

  function isReactionsHorizontal() {
    return reactionsLayoutQuery.matches;
  }

  function syncReactionsNavLabels() {
    const horizontal = isReactionsHorizontal();
    if (reactionsPrevBtn) {
      reactionsPrevBtn.textContent = horizontal ? "◀" : "▲";
      reactionsPrevBtn.setAttribute(
        "aria-label",
        horizontal ? "Scroll reactions left" : "Previous reaction"
      );
    }
    if (reactionsNextBtn) {
      reactionsNextBtn.textContent = horizontal ? "▶" : "▼";
      reactionsNextBtn.setAttribute(
        "aria-label",
        horizontal ? "Scroll reactions right" : "Next reaction"
      );
    }
  }

  function getReactionCards() {
    return Array.from(reactionStrip.querySelectorAll(".reaction-card"));
  }

  function updateReactionsNav() {
    const cards = getReactionCards();
    const count = cards.length;
    if (isReactionsHorizontal()) {
      const wrap = reactionsStackWrap;
      if (!wrap || !count) {
        if (reactionsPrevBtn) reactionsPrevBtn.disabled = true;
        if (reactionsNextBtn) reactionsNextBtn.disabled = true;
        return;
      }
      const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      if (reactionsPrevBtn) reactionsPrevBtn.disabled = wrap.scrollLeft <= 2;
      if (reactionsNextBtn) reactionsNextBtn.disabled = wrap.scrollLeft >= maxScroll - 2;
      return;
    }
    if (reactionsPrevBtn) {
      reactionsPrevBtn.disabled = count === 0 || reactionFocusIndex <= 0;
    }
    if (reactionsNextBtn) {
      reactionsNextBtn.disabled = count === 0 || reactionFocusIndex >= count - 1;
    }
  }

  function clearReactionCardLayout(card) {
    card.classList.remove("is-front");
    card.style.zIndex = "";
    card.style.opacity = "";
    card.style.pointerEvents = "";
    card.style.transform = "";
    card.removeAttribute("aria-hidden");
  }

  function layoutReactionsStack() {
    const cards = getReactionCards();
    syncReactionsNavLabels();

    if (isReactionsHorizontal()) {
      cards.forEach(clearReactionCardLayout);
      updateReactionsNav();
      return;
    }

    const count = cards.length;
    if (!count) {
      updateReactionsNav();
      return;
    }

    reactionFocusIndex = Math.max(0, Math.min(count - 1, reactionFocusIndex));

    cards.forEach((card, index) => {
      const offset = index - reactionFocusIndex;
      const abs = Math.abs(offset);
      const behind = offset >= 0;
      const hidden = abs > REACTION_STACK_VISIBLE;
      const y = behind ? offset * REACTION_STACK_PEEK : offset * (REACTION_STACK_PEEK + 10);
      const scale = Math.max(0.72, 1 - abs * REACTION_STACK_SCALE);
      const opacity = hidden ? 0 : Math.max(0.25, 1 - abs * 0.16);
      // Front on top; older cards stack downward behind it.
      const z = offset === 0 ? 1000 : behind ? 900 - offset : 800 - abs;

      card.classList.toggle("is-front", offset === 0);
      card.style.zIndex = String(z);
      card.style.opacity = String(opacity);
      card.style.pointerEvents = abs <= 2 ? "auto" : "none";
      card.style.transform = `translateX(-50%) translateY(${y}px) scale(${scale})`;
      card.setAttribute("aria-hidden", hidden ? "true" : "false");
    });

    updateReactionsNav();
  }

  function shiftReactionFocus(delta) {
    if (isReactionsHorizontal()) {
      if (!reactionsStackWrap) return;
      const step = Math.max(120, Math.round(reactionsStackWrap.clientWidth * 0.6));
      reactionsStackWrap.scrollBy({ left: delta * step, behavior: "smooth" });
      return;
    }
    const count = getReactionCards().length;
    if (!count) return;
    const next = Math.max(0, Math.min(count - 1, reactionFocusIndex + delta));
    if (next === reactionFocusIndex) return;
    reactionFocusIndex = next;
    layoutReactionsStack();
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

  function isReactionVideoMode() {
    return !!captureVideoToggle?.checked;
  }

  function syncSetupButtons() {
    const editorOpen = !playersEditor.hidden;
    btnDonePlayers.hidden = !(gameStarted && editorOpen);
    btnAddPlayers.hidden = editorOpen;
    btnStartFromSetup.hidden = gameStarted || !editorOpen;
    roundsTrigger.disabled = gameStarted;
    if (captureVideoToggle) {
      captureVideoToggle.disabled = gameStarted;
      captureVideoToggle.setAttribute("aria-checked", captureVideoToggle.checked ? "true" : "false");
    }
    if (gameStarted) closeRoundsMenu();
    if (roundsPicker) roundsPicker.hidden = false;
  }

  function readTotalRounds() {
    return selectedRounds === 3 || selectedRounds === 5 ? selectedRounds : 1;
  }

  function setSelectedRounds(n) {
    selectedRounds = n === 3 || n === 5 ? n : 1;
    roundsTriggerValue.textContent = String(selectedRounds);
    roundsMenu.querySelectorAll('[role="option"]').forEach((opt) => {
      const on = Number(opt.dataset.value) === selectedRounds;
      opt.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function closeRoundsMenu() {
    roundsMenu.hidden = true;
    roundsTrigger.setAttribute("aria-expanded", "false");
  }

  function openRoundsMenu() {
    if (gameStarted || roundsTrigger.disabled) return;
    roundsMenu.hidden = false;
    roundsTrigger.setAttribute("aria-expanded", "true");
  }

  function toggleRoundsMenu() {
    if (roundsMenu.hidden) openRoundsMenu();
    else closeRoundsMenu();
  }

  function currentRoundNumber(player) {
    if (!player) return 1;
    return Math.min((player.roundsPlayed || 0) + 1, totalRounds);
  }

  function syncTurnHud() {
    turnHud.hidden = !gameStarted;
    const player = players[currentPlayer];
    if (!gameStarted || !player) return;
    scoreLabel.textContent = player.name;
    const multiRound = totalRounds > 1;
    scoreboard.classList.toggle("is-multi-round", multiRound);
    roundLabel.hidden = !multiRound;
    if (multiRound) {
      roundLabel.textContent = `Round #${currentRoundNumber(player)}`;
    }
  }

  function playerDisplayTotal(p, index) {
    if (index === currentPlayer && !p.done) return p.banked + turnScore;
    return p.banked;
  }

  function syncLeaderboardSpace() {
    document.body.classList.toggle("has-leaderboard", gameStarted && !leaderboard.hidden);
  }

  function renderLeaderboard() {
    leaderboard.hidden = !gameStarted;
    syncLeaderboardSpace();
    if (!gameStarted) {
      leaderboardList.innerHTML = "";
      return;
    }

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

  function playGobble() {
    if (!spinning) return;
    ensureAudio();

    // Cut any overlapping tick so spins don't become a noise bed
    if (gobbleGain) {
      try {
        gobbleGain.gain.cancelScheduledValues(audioCtx.currentTime);
        gobbleGain.gain.setValueAtTime(0, audioCtx.currentTime);
        gobbleGain.disconnect();
      } catch (_) {
        /* already gone */
      }
      gobbleGain = null;
    }

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.24;
    master.connect(audioCtx.destination);
    gobbleGain = master;

    // Bright game-show "boop" with a tiny cartoon bounce
    const boop = audioCtx.createOscillator();
    const boopGain = audioCtx.createGain();
    const boopFilter = audioCtx.createBiquadFilter();
    boop.type = "square";
    boopFilter.type = "lowpass";
    boopFilter.frequency.value = 2400;
    boopFilter.Q.value = 0.7;
    const base = 520 + Math.random() * 90;
    boop.frequency.setValueAtTime(base, now);
    boop.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.018);
    boop.frequency.exponentialRampToValueAtTime(base * 0.55, now + 0.09);
    boopGain.gain.setValueAtTime(0.0001, now);
    boopGain.gain.exponentialRampToValueAtTime(1, now + 0.006);
    boopGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    boop.connect(boopFilter);
    boopFilter.connect(boopGain);
    boopGain.connect(master);
    boop.start(now);
    boop.stop(now + 0.12);

    // Soft click transient on top
    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = "triangle";
    click.frequency.setValueAtTime(1400, now);
    click.frequency.exponentialRampToValueAtTime(700, now + 0.03);
    clickGain.gain.setValueAtTime(0.45, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    click.connect(clickGain);
    clickGain.connect(master);
    click.start(now);
    click.stop(now + 0.04);
  }

  function playSting(_kind) {
    // Intentionally silent — spin gobbles + Fire!/bust videos handle SFX
  }

  function clearFireHit() {
    if (fireHitTimer) {
      clearTimeout(fireHitTimer);
      fireHitTimer = null;
    }
    fireHit.hidden = true;
    fireHit.textContent = "";
    fireHit.classList.remove("is-pop");
    fireHit.setAttribute("aria-hidden", "true");
  }

  function scheduleFireHitAmount(text) {
    clearFireHit();
    fireHitTimer = setTimeout(() => {
      fireHit.textContent = text;
      fireHit.hidden = false;
      fireHit.setAttribute("aria-hidden", "false");
      fireHit.classList.remove("is-pop");
      void fireHit.offsetWidth;
      fireHit.classList.add("is-pop");
      fireHitTimer = null;
    }, FIRE_GUNSHOT_MS);
  }

  function hideOverlayVideos() {
    clearFireHit();
    [fireVideo, bustVideo].forEach((video) => {
      if (!video) return;
      video.pause();
      video.classList.remove("is-showing");
      video.onended = null;
      video.onerror = null;
    });
    turkeyBlast.hidden = true;
    turkeyBlast.setAttribute("aria-hidden", "true");
    cameraWell.classList.remove("is-blasting");
  }

  function playOverlayVideo(video) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.onended = null;
        video.onerror = null;
        video.pause();
        video.classList.remove("is-showing");
        const otherShowing = [fireVideo, bustVideo].some(
          (v) => v && v !== video && v.classList.contains("is-showing")
        );
        if (!otherShowing) {
          turkeyBlast.hidden = true;
          turkeyBlast.setAttribute("aria-hidden", "true");
          cameraWell.classList.remove("is-blasting");
        }
        resolve();
      };

      [fireVideo, bustVideo].forEach((other) => {
        if (!other || other === video) return;
        other.pause();
        other.classList.remove("is-showing");
        other.onended = null;
        other.onerror = null;
      });

      turkeyBlast.hidden = false;
      turkeyBlast.setAttribute("aria-hidden", "false");
      cameraWell.classList.add("is-blasting");
      video.classList.add("is-showing");
      video.muted = false;
      video.playsInline = true;
      video.onended = finish;
      video.onerror = finish;

      const startPlayback = async () => {
        try {
          if (video.readyState > 0) video.currentTime = 0;
        } catch (_) {
          /* ignore seek issues */
        }
        try {
          await video.play();
        } catch (_) {
          try {
            video.muted = true;
            await video.play();
          } catch (__) {
            finish();
          }
        }
      };

      startPlayback();
      // Failsafe so a stuck clip can't block the turn forever
      setTimeout(() => {
        if (!settled) finish();
      }, 20000);
    });
  }

  function playFireVideo() {
    fireVideoPromise = playOverlayVideo(fireVideo).finally(() => {
      clearFireHit();
      if (fireVideoPromise) fireVideoPromise = null;
    });
    return fireVideoPromise;
  }

  function playTurkeyAnimation() {
    return playOverlayVideo(bustVideo);
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
    playGobble();
    const delay = SPIN_MIN_MS + Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS);
    spinTimer = setTimeout(tickSpin, delay);
  }

  function startSpin() {
    if (!gameStarted || spinning || turnOver || !canAct || tileRevealInProgress) return;
    hideOverlayVideos();
    hideBanner();
    clearTileRevealClasses();
    awaitingChoice = false;
    tiles.forEach((t) => t.el.classList.remove("is-awarded"));
    spinning = true;
    updateActionButton();
    ensureAudio();
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
    if (gobbleGain) {
      try {
        gobbleGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0);
        gobbleGain.disconnect();
      } catch (_) {
        /* ignore */
      }
      gobbleGain = null;
    }

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

    const reactionLabel = wasTurkey ? "Bust!" : `+${formatValue(awardedValue)}`;

    if (wasTurkey) {
      // Still mode: snap at 1s. Video mode: wait and record after bust ends.
      if (isReactionVideoMode()) {
        reactionCapturePromise = Promise.resolve();
      } else {
        reactionCapturePromise = scheduleStillReaction({
          bust: true,
          label: reactionLabel,
          name: playerName,
        });
      }
      setTurnScore(0);
      turnOver = true;
      canAct = false;
      awaitingChoice = false;
      showBanner("TURKEY! Turn over", true);
      playSting("bust");
      updateActionButton();
      // Start bust playback in the same click turn so audio/video unlock reliably
      const bustPromise = playTurkeyAnimation();
      finishTurnAfterTurkey(bustPromise);
      return;
    }

    if (isReactionVideoMode()) {
      reactionCapturePromise = captureReactionClip({
        bust: false,
        label: reactionLabel,
        name: playerName,
      });
    } else {
      reactionCapturePromise = scheduleStillReaction({
        bust: false,
        label: reactionLabel,
        name: playerName,
      });
    }

    const firePromise = playFireVideo();
    scheduleFireHitAmount(formatValue(awardedValue));
    setTurnScore(turnScore + awardedValue);
    hideBanner();
    playSting("win");

    canAct = false;
    awaitingChoice = false;
    updateActionButton();
    finishPrizeAfterFire(firePromise, landed);
  }

  async function flashReactionPhoto(dataUrl) {
    if (!dataUrl || !reactionFlash || !reactionFlashImage) return;

    reactionFlashImage.src = dataUrl;
    try {
      if (typeof reactionFlashImage.decode === "function") {
        await reactionFlashImage.decode();
      } else {
        await new Promise((resolve) => {
          if (reactionFlashImage.complete) resolve();
          else {
            reactionFlashImage.onload = () => resolve();
            reactionFlashImage.onerror = () => resolve();
          }
        });
      }
    } catch (_) {
      /* still show whatever we have */
    }

    // Cover the live camera with the stored snapshot, then enlarge that composite
    reactionFlash.hidden = false;
    reactionFlash.classList.add("is-on");
    reactionFlash.setAttribute("aria-hidden", "false");
    cameraWell.classList.add("is-reaction-flash");

    await waitMs(REACTION_FLASH_MS);

    cameraWell.classList.remove("is-reaction-flash");
    reactionFlash.classList.remove("is-on");
    reactionFlash.hidden = true;
    reactionFlash.setAttribute("aria-hidden", "true");
    reactionFlashImage.removeAttribute("src");
  }

  async function finishPrizeAfterFire(firePromise, landed) {
    await (firePromise || fireVideoPromise || Promise.resolve());
    if (turnOver) return;
    // Wait for the normal in-turn snap (taken during Fire!), then flip — no new capture later
    await (reactionCapturePromise || Promise.resolve());
    const reactionToShow = reactionDisplayUrl(players[currentPlayer]?.reactions?.at(-1));
    if (turnOver) return;
    await playPrizeReveal(landed);
    if (turnOver) return;
    await flashReactionPhoto(reactionToShow);
    if (turnOver) return;
    canAct = true;
    awaitingChoice = true;
    updateActionButton();
  }

  async function finishTurnAfterTurkey(bustPromise) {
    await (bustPromise || playTurkeyAnimation());
    const playerName = players[currentPlayer]?.name || "Player";
    if (isReactionVideoMode()) {
      await captureReactionClip({
        bust: true,
        label: "Bust!",
        name: playerName,
      });
    } else {
      captureReaction({
        bust: true,
        label: "Bust!",
        name: playerName,
      });
      await (reactionCapturePromise || Promise.resolve());
    }
    const latest = players[currentPlayer]?.reactions?.at(-1);
    const reactionToShow = latest?.dataUrl || null;
    await flashReactionPhoto(reactionToShow);
    openEndTurnGallery("turkey");
  }

  function drawReactionFrame(ctx, w, h) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(camera, 0, 0, w, h);
    ctx.restore();

    const banner = bannerImage.complete && bannerImage.naturalWidth ? bannerImage : cameraBorder;
    if (banner && banner.naturalWidth) {
      ctx.drawImage(banner, 0, 0, w, h);
    }
  }

  function grabReactionFrameDataUrl() {
    if (!camera.srcObject) return null;
    const w = camera.videoWidth || 640;
    const h = camera.videoHeight || 480;
    captureCanvas.width = w;
    captureCanvas.height = h;
    const ctx = captureCanvas.getContext("2d");
    drawReactionFrame(ctx, w, h);
    return captureCanvas.toDataURL("image/jpeg", 0.8);
  }

  function prependReactionCard(dataUrl, label, bust, name) {
    const card = document.createElement("article");
    card.className = "reaction-card" + (bust ? " is-bust" : "");
    card.innerHTML = `
      <img src="${dataUrl}" alt="Reaction from ${escapeHtml(name)}" />
      <div class="meta"><strong>${label}</strong>${escapeHtml(name)}</div>
    `;
    card.addEventListener("click", () => {
      openReactionPreview(dataUrl, `${name}-reaction.jpg`);
    });
    reactionStrip.prepend(card);
    reactionFocusIndex = 0;
    layoutReactionsStack();
  }

  function scheduleStillReaction({ bust, label, name }) {
    return new Promise((resolve) => {
      if (reactionTimer) clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        captureReaction({ bust, label, name });
        reactionTimer = null;
        reactionCapturePromise = null;
        resolve();
      }, REACTION_DELAY_MS);
    });
  }

  async function captureReactionClip({ bust, label, name }) {
    if (!camera.srcObject) return;
    const frames = [];
    const interval = Math.round(1000 / REACTION_CLIP_FPS);
    const frameCount = Math.max(1, Math.round(REACTION_CLIP_MS / interval));

    for (let i = 0; i < frameCount; i++) {
      const frame = grabReactionFrameDataUrl();
      if (frame) frames.push(frame);
      if (i < frameCount - 1) await waitMs(interval);
    }

    if (!frames.length) return;

    const frameIndex = Math.min(frames.length - 1, Math.floor(frames.length / 2));
    const dataUrl = frames[frameIndex];
    const player = players[currentPlayer];
    if (player) {
      player.reactions.push({
        dataUrl,
        frames,
        frameIndex,
        isClip: true,
        label,
        bust,
      });
    }
    prependReactionCard(dataUrl, label, bust, name);
  }

  function captureReaction({ bust, label, name }) {
    const dataUrl = grabReactionFrameDataUrl();
    if (!dataUrl) return;

    const player = players[currentPlayer];
    if (player) {
      player.reactions.push({ dataUrl, label, bust });
    }
    prependReactionCard(dataUrl, label, bust, name);
  }

  function reactionDisplayUrl(reaction) {
    if (!reaction) return "";
    if (reaction.frames?.length) {
      const idx = Math.min(
        reaction.frames.length - 1,
        Math.max(0, reaction.frameIndex ?? Math.floor(reaction.frames.length / 2))
      );
      return reaction.frames[idx] || reaction.dataUrl;
    }
    return reaction.dataUrl;
  }

  function setReactionFrame(reaction, index) {
    if (!reaction?.frames?.length) return reaction?.dataUrl || "";
    const idx = Math.min(reaction.frames.length - 1, Math.max(0, index));
    reaction.frameIndex = idx;
    reaction.dataUrl = reaction.frames[idx];
    return reaction.dataUrl;
  }

  function downloadReactionWithBanner(dataUrl, filename) {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // If this snapshot was captured before banner compositing, stamp the frame on download.
      // Fresh captures already include the banner; drawing it again is a no-op visually on opaque art.
      const banner = bannerImage.complete && bannerImage.naturalWidth ? bannerImage : cameraBorder;
      if (banner && banner.naturalWidth) {
        ctx.drawImage(banner, 0, 0, canvas.width, canvas.height);
      }

      downloadDataUrl(canvas.toDataURL("image/jpeg", 0.92), filename);
    };
    img.onerror = () => downloadDataUrl(dataUrl, filename);
    img.src = dataUrl;
  }

  function openReactionPreview(dataUrl, filename) {
    // Available anytime except mid-spin (stacks over end-turn gallery)
    if (spinning) return;
    previewDataUrl = dataUrl;
    previewFilename = filename || "reaction.jpg";
    previewImage.src = dataUrl;
    previewModal.hidden = false;
  }

  const DOWNLOAD_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 3a1 1 0 0 1 1 1v9.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42L11 13.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
      />
    </svg>
  `;

  function closeReactionPreview() {
    previewModal.hidden = true;
    previewImage.removeAttribute("src");
    previewDataUrl = "";
  }

  async function bankPoints() {
    if (!awaitingChoice || spinning || turnOver || tileRevealInProgress) return;
    const bankedAmount = turnScore;
    players[currentPlayer].banked += bankedAmount;
    setTurnScore(0);
    showBanner(`Bagged ${formatValue(bankedAmount)}!`);
    playSting("bank");
    awaitingChoice = false;
    canAct = false;
    turnOver = true;
    updateActionButton();
    await (reactionCapturePromise || Promise.resolve());
    // Flash already happened after Fire!; bagging ends the turn
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

  function isMultiplayer() {
    return players.length > 1;
  }

  function isLastPlayerTurn() {
    // After the current player finishes this turn, will the whole match be over?
    return players.every((p, i) => {
      const played = p.roundsPlayed || 0;
      if (i === endTurnPlayerIndex) return played + 1 >= totalRounds;
      return played >= totalRounds;
    });
  }

  function prepareNextTurnBoard() {
    clearReactionStrip();
    hideBanner();
    turnOver = false;
    awaitingChoice = false;
    spinsThisTurn = 0;
    turnScore = 0;
    setLit(-1);
    buildBoard();
  }

  /** Round-robin: everyone finishes Round N before anyone starts Round N+1. */
  function findNextPlayerIndex() {
    const remaining = players
      .map((p, i) => ({ i, played: p.roundsPlayed || 0 }))
      .filter(({ played }) => played < totalRounds);
    if (!remaining.length) return -1;

    const minPlayed = Math.min(...remaining.map(({ played }) => played));
    const sameRound = remaining.filter(({ played }) => played === minPlayed);
    const nextInOrder = sameRound.find(({ i }) => i > endTurnPlayerIndex);
    return (nextInOrder || sameRound[0]).i;
  }

  function advanceAfterTurn() {
    const player = players[endTurnPlayerIndex];
    if (!player) {
      returnToLobby();
      return;
    }

    player.roundsPlayed = (player.roundsPlayed || 0) + 1;
    player.reactions = [];
    player.done = player.roundsPlayed >= totalRounds;

    prepareNextTurnBoard();

    const next = findNextPlayerIndex();
    if (next === -1) {
      canAct = false;
      scoreEl.textContent = formatValue(0);
      renderLeaderboard();
      updateActionButton();
      if (isMultiplayer()) {
        showWinner();
      } else {
        returnToLobby();
      }
      return;
    }

    currentPlayer = next;
    canAct = true;
    setTurnScore(0);
    syncTurnHud();
    renderLeaderboard();
    updateActionButton();
  }

  function isFavoriteRecheck(player) {
    return isMultiplayer() && totalRounds > 1 && (player.roundsPlayed || 0) >= 1 && !!player.favorite;
  }

  function getGalleryEntries(player) {
    const entries = player.reactions.map((r) => ({ ...r, isPriorFavorite: false }));
    if (isFavoriteRecheck(player)) {
      const alreadyIn = entries.some((r) => r.dataUrl === player.favorite);
      if (!alreadyIn) {
        entries.unshift({
          dataUrl: player.favorite,
          label: "Favorite",
          bust: false,
          isPriorFavorite: true,
        });
      }
    }
    return entries;
  }

  function openEndTurnGallery(reason) {
    endTurnPlayerIndex = currentPlayer;
    const player = players[endTurnPlayerIndex];
    const multi = isMultiplayer();
    const recheck = isFavoriteRecheck(player);
    const entries = getGalleryEntries(player);

    selectedFavoriteIndex = -1;
    if (recheck && player.favorite) {
      const favIndex = entries.findIndex((r) => r.dataUrl === player.favorite);
      selectedFavoriteIndex = favIndex >= 0 ? favIndex : 0;
    }

    modalTitle.classList.toggle("is-fav-prompt", recheck);
    if (multi && recheck) {
      modalTitle.textContent = "Would you like to select a new favorite photo?";
      modalSubtitle.innerHTML = `
        <span class="fav-change-hint">Selecting a new favorite will clear your current one</span>
        <span class="end-turn-cash">${formatValue(player.banked)}</span>
      `;
    } else if (multi) {
      modalTitle.textContent = "Pick your favorite photo to continue";
      modalSubtitle.innerHTML = `<span class="end-turn-cash">${formatValue(player.banked)}</span>`;
    } else {
      modalTitle.textContent = `${player.name}'s results`;
      modalSubtitle.innerHTML = `<span class="end-turn-cash">${formatValue(player.banked)}</span>`;
    }

    renderGalleryBody(player);
    renderGalleryActions(player);
    modalRoot.hidden = false;
  }

  function renderGalleryBody(player) {
    modalBody.classList.remove("is-winner");
    const multi = isMultiplayer();
    const entries = getGalleryEntries(player);
    if (!entries.length) {
      modalBody.innerHTML = `<p class="modal-subtitle">No reaction photos this turn.</p>`;
      return;
    }

    modalBody.innerHTML = "";
    entries.forEach((r, i) => {
      const filename = `${player.name}-reaction-${i + 1}.jpg`;
      const hasClip = Array.isArray(r.frames) && r.frames.length > 1;
      const currentUrl = reactionDisplayUrl(r);
      const item = document.createElement("div");
      item.className = "gallery-item" + (multi && i === selectedFavoriteIndex ? " is-selected" : "");
      item.innerHTML = `
        <div class="g-media">
          ${
            multi
              ? `<button type="button" class="fav-pick${i === selectedFavoriteIndex ? " is-on" : ""}" aria-label="Pick as favorite">★</button>`
              : ""
          }
          <img src="${currentUrl}" alt="Reaction ${i + 1}" />
          <button type="button" class="dl-circle" aria-label="Download">${DOWNLOAD_ICON_SVG}</button>
        </div>
        ${
          hasClip
            ? `<input type="range" class="g-scrub" min="0" max="${r.frames.length - 1}" value="${r.frameIndex ?? Math.floor(r.frames.length / 2)}" aria-label="Scrub reaction frames" />
               <span class="g-scrub-label">Scrub for best frame</span>`
            : ""
        }
        <div class="g-meta"><strong>${escapeHtml(r.label)}</strong>${r.bust ? "Bust" : r.isPriorFavorite ? "Saved" : "Hit"}</div>
      `;
      const img = item.querySelector("img");
      img.addEventListener("click", () => {
        openReactionPreview(reactionDisplayUrl(r), filename);
      });
      if (hasClip) {
        const scrub = item.querySelector(".g-scrub");
        scrub.addEventListener("input", () => {
          const url = setReactionFrame(r, Number(scrub.value));
          img.src = url;
          if (multi && selectedFavoriteIndex === i) {
            // keep favorite pointing at the scrubbed frame
            player.favorite = url;
          }
        });
      }
      if (multi) {
        item.querySelector(".fav-pick").addEventListener("click", (e) => {
          e.stopPropagation();
          selectedFavoriteIndex = i;
          // Selecting a clip as favorite uses its current scrubbed frame
          if (r.frames?.length) setReactionFrame(r, r.frameIndex ?? 0);
          renderGalleryBody(player);
          renderGalleryActions(player);
        });
      }
      item.querySelector(".dl-circle").addEventListener("click", (e) => {
        e.stopPropagation();
        downloadReactionWithBanner(reactionDisplayUrl(r), filename);
      });
      modalBody.appendChild(item);
    });
  }

  function renderGalleryActions(player) {
    modalActions.innerHTML = "";
    const multi = isMultiplayer();
    const last = isLastPlayerTurn();
    const entries = getGalleryEntries(player);

    const dlAll = document.createElement("button");
    dlAll.type = "button";
    dlAll.className = "btn btn-download-all";
    dlAll.textContent = "Download All";
    dlAll.disabled = entries.length === 0;
    dlAll.addEventListener("click", () => {
      entries.forEach((r, i) => {
        downloadReactionWithBanner(reactionDisplayUrl(r), `${player.name}-reaction-${i + 1}.jpg`);
      });
    });

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "btn btn-confirm-fav";
    if (last) {
      confirm.textContent = "End Game";
    } else if (!multi) {
      confirm.textContent = "Next Round";
    } else {
      confirm.textContent = "Next Player";
    }
    confirm.disabled = multi && entries.length > 0 && selectedFavoriteIndex < 0;
    confirm.addEventListener("click", () => {
      if (multi && selectedFavoriteIndex >= 0 && entries[selectedFavoriteIndex]) {
        const chosen = entries[selectedFavoriteIndex];
        const fav = reactionDisplayUrl(chosen);
        player.favorite = fav;
        saveFavorite(player.name, fav);
      }
      closeModal();
      advanceAfterTurn();
    });

    modalActions.appendChild(dlAll);
    modalActions.appendChild(confirm);
  }

  function winnerPhotoFor(player, favMap) {
    return player.favorite || favMap[player.name] || player.reactions.at(-1)?.dataUrl || null;
  }

  function showWinner() {
    // Multiplayer only — solo ends on the results gallery
    const topScore = Math.max(...players.map((p) => p.banked));
    const winners = players.filter((p) => p.banked === topScore);
    const favMap = loadFavoritesMap();

    modalBody.classList.add("is-winner");
    modalActions.innerHTML = "";

    if (topScore <= 0) {
      modalTitle.textContent = "Turkey Tom Wins";
      modalSubtitle.textContent = "Nobody bagged any cash";
      modalBody.innerHTML = `
        <img class="winner-photo winner-photo-tom" src="assets/turkey-tile.png" alt="Turkey Tom" />
      `;
    } else if (winners.length > 1) {
      modalTitle.textContent = "It's a tie!";
      modalSubtitle.textContent = `${winners.map((w) => w.name).join(" & ")} — ${formatValue(topScore)}`;
      const photos = winners
        .map((w) => {
          const photo = winnerPhotoFor(w, favMap);
          if (!photo) {
            return `<div class="winner-tie-slot"><p class="modal-subtitle">${escapeHtml(w.name)}</p></div>`;
          }
          return `
            <figure class="winner-tie-slot">
              <img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(w.name)}" />
              <figcaption class="winner-caption">${escapeHtml(w.name)}</figcaption>
            </figure>
          `;
        })
        .join("");
      modalBody.innerHTML = `<div class="winner-photos">${photos}</div>`;
    } else {
      const winner = winners[0];
      const photo = winnerPhotoFor(winner, favMap);
      modalTitle.textContent = `${winner.name} wins!`;
      modalSubtitle.textContent = formatValue(topScore);
      modalBody.innerHTML = photo
        ? `<img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(winner.name)}" />`
        : `<p class="modal-subtitle">No favorite photo saved.</p>`;
    }

    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn btn-play-again";
    again.textContent = "End Game";
    again.addEventListener("click", () => {
      closeModal();
      returnToLobby();
    });
    modalActions.appendChild(again);
    modalRoot.hidden = false;
  }

  function returnToLobby() {
    gameStarted = false;
    players = [];
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = false;
    soloStartArmed = false;
    setSoloWarning(false);
    setTurnScore(0);
    scoreLabel.textContent = "Turn";
    scoreboard.classList.remove("is-multi-round");
    roundLabel.hidden = true;
    clearReactionStrip();
    hideBanner();
    setLit(-1);
    buildBoard();
    renderPlayerList();
    renderLeaderboard();
    syncSetupButtons();
    syncTurnHud();
    updateActionButton();
  }

  function resetForNewGame() {
    players.forEach((p) => {
      p.banked = 0;
      p.reactions = [];
      p.favorite = null;
      p.done = false;
      p.roundsPlayed = 0;
    });
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = true;
    clearReactionStrip();
    hideBanner();
    buildBoard();
    setTurnScore(0);
    syncTurnHud();
    updateActionButton();
  }

  function collapsePlayersEditor() {
    playersEditor.hidden = true;
    setupPanel.hidden = false;
    setupPanel.style.display = "";
    setupPanel.removeAttribute("aria-hidden");
    syncSetupButtons();
  }

  function openPlayersEditor() {
    playersEditor.hidden = false;
    syncSetupButtons();
    playerNameInput.focus();
  }

  function ensurePlayersForStart() {
    if (players.length === 0) {
      players.push({
        name: "Player 1",
        banked: 0,
        reactions: [],
        favorite: null,
        done: false,
        roundsPlayed: 0,
      });
      renderPlayerList();
    }
  }

  function setSoloWarning(visible) {
    soloWarning.hidden = !visible;
  }

  function beginGame() {
    ensurePlayersForStart();
    soloStartArmed = false;
    setSoloWarning(false);
    totalRounds = readTotalRounds();
    players.forEach((p) => {
      p.banked = 0;
      p.reactions = [];
      p.favorite = null;
      p.done = false;
      p.roundsPlayed = 0;
    });
    gameStarted = true;
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = true;
    collapsePlayersEditor();
    clearReactionStrip();
    buildBoard();
    setTurnScore(0);
    syncSetupButtons();
    syncTurnHud();
    renderLeaderboard();
    updateActionButton();
  }

  function tryBeginFromStartButton() {
    if (players.length === 0 && !soloStartArmed) {
      soloStartArmed = true;
      setSoloWarning(true);
      return;
    }
    beginGame();
    startSpin();
  }

  function startGameFromSetup() {
    if (gameStarted) return;
    soloStartArmed = false;
    setSoloWarning(false);
    beginGame();
  }

  function onActionClick() {
    if (!gameStarted) {
      tryBeginFromStartButton();
      return;
    }
    if (spinning) stopSpin();
    else startSpin();
  }

  btnAddPlayers.addEventListener("click", openPlayersEditor);
  btnStartFromSetup.addEventListener("click", startGameFromSetup);
  captureVideoToggle?.addEventListener("change", () => {
    captureVideoToggle.setAttribute("aria-checked", captureVideoToggle.checked ? "true" : "false");
  });

  roundsTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRoundsMenu();
  });
  roundsMenu.addEventListener("click", (e) => {
    const opt = e.target.closest('[role="option"]');
    if (!opt) return;
    setSelectedRounds(Number(opt.dataset.value));
    closeRoundsMenu();
  });
  document.addEventListener("click", (e) => {
    if (!roundsPicker.contains(e.target)) closeRoundsMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !roundsMenu.hidden) {
      closeRoundsMenu();
      roundsTrigger.focus();
    }
  });
  setSelectedRounds(1);

  addPlayerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;
    soloStartArmed = false;
    setSoloWarning(false);
    players.push({ name, banked: 0, reactions: [], favorite: null, done: false, roundsPlayed: 0 });
    playerNameInput.value = "";
    renderPlayerList();
    syncSetupButtons();
    if (gameStarted) renderLeaderboard();
    playerNameInput.focus();
  });

  btnDonePlayers.addEventListener("click", collapsePlayersEditor);
  btnAction.addEventListener("click", onActionClick);
  btnBank.addEventListener("click", () => {
    bankPoints();
  });

  previewBackdrop.addEventListener("click", closeReactionPreview);
  previewClose.addEventListener("click", (e) => {
    e.stopPropagation();
    closeReactionPreview();
  });
  previewModal.addEventListener("click", (e) => {
    if (e.target === previewModal) closeReactionPreview();
  });
  previewDownload.addEventListener("click", (e) => {
    e.stopPropagation();
    if (previewDataUrl) downloadReactionWithBanner(previewDataUrl, previewFilename);
  });
  reactionsPrevBtn?.addEventListener("click", () => shiftReactionFocus(-1));
  reactionsNextBtn?.addEventListener("click", () => shiftReactionFocus(1));
  reactionsStackWrap?.addEventListener(
    "wheel",
    (e) => {
      if (!getReactionCards().length) return;
      if (isReactionsHorizontal()) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 2) {
          e.preventDefault();
          reactionsStackWrap.scrollLeft += e.deltaY;
          updateReactionsNav();
        }
        return;
      }
      e.preventDefault();
      if (Math.abs(e.deltaY) < 2) return;
      const now = performance.now();
      if (now < reactionWheelLockUntil) return;
      reactionWheelLockUntil = now + 140;
      shiftReactionFocus(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false }
  );
  reactionsStackWrap?.addEventListener("scroll", () => {
    if (isReactionsHorizontal()) updateReactionsNav();
  });
  let reactionTouchStartY = null;
  reactionsStackWrap?.addEventListener(
    "touchstart",
    (e) => {
      if (isReactionsHorizontal()) return;
      reactionTouchStartY = e.touches[0]?.clientY ?? null;
    },
    { passive: true }
  );
  reactionsStackWrap?.addEventListener(
    "touchend",
    (e) => {
      if (isReactionsHorizontal() || reactionTouchStartY == null) return;
      const endY = e.changedTouches[0]?.clientY;
      if (endY == null) {
        reactionTouchStartY = null;
        return;
      }
      const dy = endY - reactionTouchStartY;
      reactionTouchStartY = null;
      if (Math.abs(dy) < 36) return;
      shiftReactionFocus(dy < 0 ? 1 : -1);
    },
    { passive: true }
  );
  const onReactionsLayoutChange = () => layoutReactionsStack();
  if (typeof reactionsLayoutQuery.addEventListener === "function") {
    reactionsLayoutQuery.addEventListener("change", onReactionsLayoutChange);
  } else {
    reactionsLayoutQuery.addListener(onReactionsLayoutChange);
  }
  window.addEventListener("resize", () => {
    layoutReactionsStack();
  });
  layoutReactionsStack();
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !previewModal.hidden) {
      closeReactionPreview();
      return;
    }
    if (!previewModal.hidden || !modalRoot.hidden) return;
    if (isReactionsHorizontal()) {
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        shiftReactionFocus(-1);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        shiftReactionFocus(1);
      }
      return;
    }
    if (e.code === "ArrowUp") {
      e.preventDefault();
      shiftReactionFocus(-1);
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      shiftReactionFocus(1);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || !modalRoot.hidden || !previewModal.hidden) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    if (!gameStarted) {
      tryBeginFromStartButton();
      return;
    }
    if (spinning) stopSpin();
    else if (canAct && !turnOver) startSpin();
  });

  buildBoard();
  buildBoardLights();
  syncSetupButtons();
  syncTurnHud();
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
