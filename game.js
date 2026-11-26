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
  const TURKEY_MESSAGE_MS = 3000;
  /** Fallback only if overlay duration can't be measured */
  const REACTION_CLIP_MS = 3000;
  const REACTION_CLIP_FPS = 10;
  const REACTION_CLIP_MAX_MS = 20000;
  const FAVORITES_KEY = "turkeyTroubleFavorites";
  const HIGH_SCORE_KEY = "turkeyTroubleHighScore";
  const SOUND_MODE_KEY = "turkeyTroubleSoundMode";
  const REACTION_MODE_KEY = "turkeyTroubleReactionMode";
  const VIDEO_REACTION_KEY = "turkeyTroubleVideoReaction"; // legacy bool → migrated

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
  const cameraReactionHud = document.getElementById("camera-reaction-hud");
  const turnHud = document.getElementById("turn-hud");
  const scoreEl = document.getElementById("score");
  const scoreDialRow = document.getElementById("score-dial-row");
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
  const playModeToggle = document.getElementById("play-mode-toggle");
  const modeSingleBtn = document.getElementById("mode-single");
  const modeMultiBtn = document.getElementById("mode-multi");
  const playersEditor = document.getElementById("players-editor");
  const addPlayerForm = document.getElementById("add-player-form");
  const playerNameInput = document.getElementById("player-name-input");
  const playerList = document.getElementById("player-list");
  const btnStartFromSetup = document.getElementById("btn-start-from-setup");
  let multiPlayerMode = false;
  const roundsPicker = document.getElementById("rounds-picker");
  const roundsTrigger = document.getElementById("rounds-trigger");
  const roundsTriggerValue = document.getElementById("rounds-trigger-value");
  const roundsMenu = document.getElementById("rounds-menu");
  const scoreboard = document.getElementById("scoreboard");
  const roundLabel = document.getElementById("round-label");
  const reactionModePicker = document.getElementById("reaction-mode-picker");
  const reactionModeTrigger = document.getElementById("reaction-mode-trigger");
  const reactionModeTriggerIcons = document.getElementById("reaction-mode-trigger-icons");
  const reactionModeMenu = document.getElementById("reaction-mode-menu");
  const soundModePicker = document.getElementById("sound-mode-picker");
  const soundModeTrigger = document.getElementById("sound-mode-trigger");
  const soundModeTriggerIcons = document.getElementById("sound-mode-trigger-icons");
  const soundModeMenu = document.getElementById("sound-mode-menu");
  /** @type {"all" | "effects" | "mute"} */
  function loadStoredSoundMode() {
    try {
      const raw = localStorage.getItem(SOUND_MODE_KEY);
      if (raw === "all" || raw === "effects" || raw === "mute") return raw;
    } catch (_) {
      /* ignore */
    }
    return "all";
  }

  /** @returns {"video" | "image" | "none"} */
  function loadStoredReactionMode() {
    try {
      const raw = localStorage.getItem(REACTION_MODE_KEY);
      if (raw === "video" || raw === "image" || raw === "none") return raw;
      // Migrate legacy Video Reaction checkbox
      const legacy = localStorage.getItem(VIDEO_REACTION_KEY);
      if (legacy === "0" || legacy === "false") return "image";
      if (legacy === "1" || legacy === "true") return "video";
    } catch (_) {
      /* ignore */
    }
    return "video";
  }

  let soundMode = loadStoredSoundMode();
  /** @type {"video" | "image" | "none"} */
  let reactionMode = loadStoredReactionMode();
  const SOUND_MODE_META = {
    all: {
      label: "All",
      iconsHtml:
        '<span class="sound-mode-icon sound-mode-icon-music"></span><span class="sound-mode-plus">+</span><span class="sound-mode-icon sound-mode-icon-speaker"></span>',
    },
    effects: {
      label: "Sound Effects Only",
      iconsHtml: '<span class="sound-mode-icon sound-mode-icon-speaker"></span>',
    },
    mute: {
      label: "Mute",
      iconsHtml: '<span class="sound-mode-icon sound-mode-icon-mute"></span>',
    },
  };
  const REACTION_MODE_META = {
    video: {
      label: "Video",
      iconsHtml: '<span class="dl-icon dl-icon-video"></span>',
    },
    image: {
      label: "Image",
      iconsHtml: '<span class="dl-icon dl-icon-image"></span>',
    },
    none: {
      label: "None",
      iconsHtml: '<span class="dl-icon dl-icon-none"></span>',
    },
  };
  let selectedRounds = 1;
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
  const previewDownloadImage = document.getElementById("preview-download-image");
  const previewDownloadVideo = document.getElementById("preview-download-video");
  const previewClose = document.getElementById("preview-close");
  const previewClip = document.getElementById("preview-clip");
  const previewPlay = document.getElementById("preview-play");
  const previewScrub = document.getElementById("preview-scrub");
  const previewTime = document.getElementById("preview-time");
  const previewSelectFrame = document.getElementById("preview-select-frame");
  const previewSelectStatus = document.getElementById("preview-select-status");
  const previewPip = document.getElementById("preview-pip");
  let previewDataUrl = "";
  let previewFilename = "reaction.png";
  /** @type {ReturnType<typeof createClipPlayer>|null} */
  let previewClipPlayer = null;
  /** @type {{dataUrl:string,frames?:string[],frameIndex?:number,selectedFrameIndex?:number,isClip?:boolean,label:string,bust:boolean,score?:number,hits?:number}|null} */
  let previewReaction = null;

  /** @type {{ value: number, isTurkey: boolean, el: HTMLButtonElement }[]} */
  let tiles = [];
  /** @type {{ name: string, banked: number, hits: number, reactions: {dataUrl:string,frames?:string[],frameIndex?:number,isClip?:boolean,label:string,bust:boolean,score?:number,hits?:number}[], favorite: string|null, done: boolean, roundsPlayed: number }[]} */
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
  let renamingActivePlayer = false;
  /** @type {HTMLInputElement|null} */
  let scoreLabelEdit = null;

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
    "tone-crimson",
    "tone-moss",
  ];

  /** @type {ReturnType<typeof setTimeout>[]} */
  let tileToneTimers = [];

  function stopTileToneTwinkle() {
    tileToneTimers.forEach((t) => clearTimeout(t));
    tileToneTimers = [];
  }

  function tileToneTwinkleAllowed() {
    // Same vibe as the bulbs — idle shimmer between spins, not mid-action
    return (
      !spinning &&
      !tileRevealInProgress &&
      !document.querySelector(".board-cheat-overlay")
    );
  }

  function applyRandomTileTone(tile) {
    if (!tile?.el || tile.isTurkey) return;
    const current = TILE_TONES.find((t) => tile.el.classList.contains(t));
    let next = TILE_TONES[Math.floor(Math.random() * TILE_TONES.length)];
    if (TILE_TONES.length > 1) {
      let guard = 0;
      while (next === current && guard < 8) {
        next = TILE_TONES[Math.floor(Math.random() * TILE_TONES.length)];
        guard += 1;
      }
    }
    TILE_TONES.forEach((t) => tile.el.classList.remove(t));
    tile.el.classList.add(next);
  }

  function startTileToneTwinkle() {
    stopTileToneTwinkle();
    if (!tiles.length) return;

    const scheduleShift = (tileIndex) => {
      // ~0.75× bulb cadence (slower shimmer on prize faces)
      const delay = (700 + Math.random() * 1600) / 0.75;
      const timer = setTimeout(() => {
        if (!tiles[tileIndex]) return;
        if (tileToneTwinkleAllowed()) {
          applyRandomTileTone(tiles[tileIndex]);
        }
        scheduleShift(tileIndex);
      }, delay);
      tileToneTimers.push(timer);
    };

    tiles.forEach((_, i) => scheduleShift(i));
  }

  function buildBoard() {
    stopTileToneTwinkle();
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
    startTileToneTwinkle();
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
    playCardFlipSfx();
    await waitMs(TILE_FLIP_MS);

    clearTileRevealClasses();
    tileRevealInProgress = false;
    syncLobbyMusic();
  }

  function isBoardFullyCleared() {
    return tiles.length > 0 && tiles.every((t) => t.isTurkey);
  }

  function restorePrizeTile(tile) {
    tile.isTurkey = false;
    tile.el.classList.remove("is-turkey", "is-flipped", "is-awarded");
    tile.el.setAttribute("aria-label", formatValue(tile.value));
    const front = tile.el.querySelector(".tile-face-front");
    if (front && !front.querySelector(".label")) {
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = formatValue(tile.value);
      front.appendChild(label);
    }
  }

  function tileBoardSide(index) {
    const slot = LAYOUT[index] || { row: 0, col: 0 };
    if (slot.row === 1) return "top";
    if (slot.row === 4) return "bottom";
    if (slot.col === 4) return "right";
    if (slot.col === 1) return "left";
    return "other";
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /**
   * Pull up to 4 still-flipped tiles: prefer one from each board side,
   * then fill any leftover slots at random (never a tight clump by index).
   */
  function pickScatteredUnflipBatch(remaining, batchSize = 4) {
    if (!remaining.length) return [];

    const bySide = { top: [], right: [], bottom: [], left: [], other: [] };
    remaining.forEach((entry) => {
      bySide[tileBoardSide(entry.index)].push(entry);
    });

    const batch = [];
    const takeFrom = (list) => {
      if (!list.length || batch.length >= batchSize) return;
      const pickAt = Math.floor(Math.random() * list.length);
      batch.push(list.splice(pickAt, 1)[0]);
    };

    // One from each side first (sides shuffled so which side leads varies)
    shuffleInPlace(["top", "right", "bottom", "left"]).forEach((side) => {
      takeFrom(bySide[side]);
    });

    // Fill remaining slots from whatever is left
    const leftovers = remaining.filter((entry) => !batch.includes(entry));
    shuffleInPlace(leftovers);
    while (batch.length < batchSize && leftovers.length) {
      batch.push(leftovers.shift());
    }

    return batch;
  }

  /** Three quick card-flip hits under a batch of tile unflips. */
  async function playTripleCardFlip() {
    playCardFlipSfxLayered();
    await waitMs(95);
    playCardFlipSfxLayered();
    await waitMs(95);
    playCardFlipSfxLayered();
  }

  /** Full clear without a bust — accuse, then unflip 4 scattered tiles at a time with triple flips. */
  async function showBoardClearedCheatMoment() {
    const overlay = document.createElement("div");
    overlay.className = "board-cheat-overlay";
    overlay.setAttribute("role", "status");
    overlay.innerHTML = `<p class="board-cheat-msg">Are you cheating?</p>`;
    // On .board (not .board-frame) so container queries don't size-contain the light ring
    board.appendChild(overlay);
    await waitMs(3000);

    const remaining = tiles
      .map((tile, index) => ({ tile, index }))
      .filter(({ tile }) => tile.isTurkey);

    while (remaining.length) {
      const batch = pickScatteredUnflipBatch(remaining, 4);
      batch.forEach((entry) => {
        const at = remaining.indexOf(entry);
        if (at >= 0) remaining.splice(at, 1);
      });
      const sfx = playTripleCardFlip();
      batch.forEach(({ tile }) => restorePrizeTile(tile));
      await Promise.all([sfx, waitMs(TILE_FLIP_MS + 120)]);
    }

    overlay.classList.add("is-out");
    await waitMs(280);
    overlay.remove();
  }

  /** Dev helper — board full of turkeys, then run the cheat / unflip sequence. */
  window.__demoBoardCheatClear = async function demoBoardCheatClear() {
    if (!tiles.length) buildBoard();
    hideBanner();
    clearTileRevealClasses();
    tiles.forEach((tile) => {
      tile.isTurkey = true;
      tile.el.classList.add("is-turkey", "is-flipped");
      tile.el.setAttribute("aria-label", "Turkey");
      tile.el.querySelector(".label")?.remove();
    });
    await waitMs(600);
    await showBoardClearedCheatMoment();
  };

  /** Always five dials: $00,000 … $99,999 */
  const SCORE_DIAL_DIGITS = 5;

  function formatValue(n) {
    return `$${Number(n).toLocaleString()}`;
  }

  function formatDialDigits(n) {
    const clamped = Math.max(0, Math.min(99999, Math.round(Number(n) || 0)));
    // Five digits, no comma on the HUD dials (leaderboard still uses formatValue)
    return String(clamped).padStart(SCORE_DIAL_DIGITS, "0");
  }

  function activeRunningTotal() {
    const p = players[currentPlayer];
    if (!p) return turnScore;
    return p.banked + turnScore;
  }

  /** Shown on dials / leaderboard while a cash-register count-up is running. */
  let scoreDisplayOverride = null;
  let scoreDialAnimating = false;

  function digitStripHtml() {
    let html = "";
    for (let d = 0; d <= 9; d += 1) html += `<span>${d}</span>`;
    return html;
  }

  function ensureScoreDialStructure() {
    if (!scoreDialRow) return;
    if (scoreDialRow.dataset.sig === "DDDDD") return;
    scoreDialRow.dataset.sig = "DDDDD";
    // Fixed five-digit register: 00000 (no comma on dials)
    scoreDialRow.innerHTML = Array.from({ length: SCORE_DIAL_DIGITS }, () =>
      `<span class="score-dial"><span class="score-dial-strip">${digitStripHtml()}</span></span>`
    ).join("");
  }

  function paintScoreDials(value) {
    if (!scoreEl || !scoreDialRow) return;
    const n = Math.max(0, Math.min(99999, Math.round(Number(value) || 0)));
    scoreEl.setAttribute("aria-label", formatValue(n));
    ensureScoreDialStructure();
    const formatted = formatDialDigits(n);
    const dials = scoreDialRow.querySelectorAll(".score-dial-strip");
    let digitIndex = 0;
    for (const ch of formatted) {
      if (ch < "0" || ch > "9") continue;
      const strip = dials[digitIndex];
      digitIndex += 1;
      if (!strip) continue;
      // % is relative to the strip height (10 equal digits) — stays locked on whole numbers
      strip.style.transform = `translateY(${-Number(ch) * 10}%)`;
    }
  }

  function playerDisplayTotal(p, index) {
    if (
      scoreDisplayOverride != null &&
      index === currentPlayer &&
      !p.done
    ) {
      return scoreDisplayOverride;
    }
    if (index === currentPlayer && !p.done) return p.banked + turnScore;
    return p.banked;
  }

  function setTurnScore(n) {
    turnScore = n;
    scoreDisplayOverride = null;
    paintScoreDials(activeRunningTotal());
    if (gameStarted) renderLeaderboard();
  }

  function isScoreDialAnimating() {
    return scoreDialAnimating;
  }

  function stopChaChing() {
    try {
      chaChingSfx.pause();
      chaChingSfx.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function stopMoneyDrain() {
    try {
      moneyDrainSfx.pause();
      moneyDrainSfx.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  /** Play a one-shot SFX (respects mute / effects-only; never gated as music). */
  function playSfxDuration(audio, fallbackMs) {
    if (!effectsAllowed()) return Promise.resolve(fallbackMs);
    try {
      audio.pause();
      audio.currentTime = 0;
      const playAttempt = audio.play();
      if (playAttempt) playAttempt.catch(() => {});
    } catch (_) {
      /* ignore */
    }
    const dur = Number(audio.duration);
    return Promise.resolve(Number.isFinite(dur) && dur > 0.2 ? dur * 1000 : fallbackMs);
  }

  function playChaChing() {
    return playSfxDuration(chaChingSfx, 1280);
  }

  function playMoneyDrain() {
    return playSfxDuration(moneyDrainSfx, 1240);
  }

  async function animateScoreDials(fromTotal, toTotal, durationMs) {
    const start = performance.now();
    let lastLbBucket = -1;
    scoreDisplayOverride = fromTotal;
    paintScoreDials(fromTotal);
    renderLeaderboard();

    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / Math.max(16, durationMs));
        // Ease out — big early spin, settles like a register
        const eased = 1 - (1 - t) ** 2.4;
        const value = Math.round(fromTotal + (toTotal - fromTotal) * eased);
        scoreDisplayOverride = value;
        paintScoreDials(value);
        const bucket = Math.floor(t * 20);
        if (bucket !== lastLbBucket) {
          lastLbBucket = bucket;
          renderLeaderboard();
        }
        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    scoreDisplayOverride = null;
    paintScoreDials(toTotal);
    renderLeaderboard();
  }

  /**
   * Cash-register count-up on the HUD dials (+ leaderboard) while cha-ching plays.
   * Call only after flash/zinger audio finishes.
   */
  async function creditPrizeAmount(amount) {
    const add = Math.max(0, Math.round(Number(amount) || 0));
    if (!add) return;

    const fromTotal = activeRunningTotal();
    turnScore += add;
    const toTotal = activeRunningTotal();
    // Hit count ticks up with the cash dial (not at Fire! land)
    if (players[currentPlayer]) {
      players[currentPlayer].hits = (players[currentPlayer].hits || 0) + 1;
    }

    scoreDialAnimating = true;
    syncLobbyMusic();
    const durationMs = await playChaChing();
    await animateScoreDials(fromTotal, toTotal, durationMs);
    stopChaChing();
    scoreDialAnimating = false;
    syncLobbyMusic();
  }

  /**
   * During "Turkey Tom Got You!" — money drain SFX + dials roll to $00,000.
   * Clears turn pot and banked cash (matches “lost all your cash”).
   */
  async function drainScoreToZero() {
    const fromTotal = scoreDisplayOverride != null ? scoreDisplayOverride : activeRunningTotal();

    scoreDialAnimating = true;
    syncLobbyMusic();
    const durationMs = await playMoneyDrain();
    await animateScoreDials(fromTotal, 0, durationMs || 1240);

    turnScore = 0;
    if (players[currentPlayer]) players[currentPlayer].banked = 0;
    scoreDisplayOverride = null;
    paintScoreDials(0);
    renderLeaderboard();
    stopMoneyDrain();
    scoreDialAnimating = false;
    syncLobbyMusic();
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

  function setBankVisible(enabled) {
    // Always show Bag Cash so the control row stays balanced; only enable when baggable
    btnBank.hidden = false;
    btnBank.classList.remove("is-slot-hidden");
    btnBank.disabled = !enabled;
  }

  function updateActionButton() {
    btnAction.classList.remove("is-start", "is-stop", "is-keep");

    if (!gameStarted) {
      btnAction.textContent = "Start Game";
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
    resultBanner.classList.remove("is-centered");
    resultBanner.textContent = text;
    resultBanner.classList.toggle("is-turkey", isTurkey);
  }

  function showTurkeyBustMessage() {
    resultBanner.hidden = false;
    resultBanner.classList.add("is-turkey", "is-centered");
    resultBanner.innerHTML = `
      <span class="banner-title">Turkey Tom Got You!</span>
      <span class="banner-sep" aria-hidden="true">·</span>
      <span class="banner-sub">You've lost all your cash</span>
    `;
  }

  function hideBanner() {
    resultBanner.hidden = true;
    resultBanner.textContent = "";
    resultBanner.innerHTML = "";
    resultBanner.classList.remove("is-turkey", "is-centered");
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
        if (currentPlayer >= players.length) currentPlayer = Math.max(0, players.length - 1);
        renderPlayerList();
        syncSetupButtons();
        renderLeaderboard();
        syncTurnHud();
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
    return reactionMode === "video";
  }

  function isReactionImageMode() {
    return reactionMode === "image";
  }

  function isReactionNoneMode() {
    return reactionMode === "none";
  }

  function syncReactionEmptyLabel() {
    if (!reactionStrip) return;
    reactionStrip.dataset.reactionMode = reactionMode;
  }

  function syncPlayModeToggle() {
    if (!modeSingleBtn || !modeMultiBtn) return;
    modeSingleBtn.classList.toggle("is-active", !multiPlayerMode);
    modeMultiBtn.classList.toggle("is-active", multiPlayerMode);
    modeSingleBtn.setAttribute("aria-pressed", multiPlayerMode ? "false" : "true");
    modeMultiBtn.setAttribute("aria-pressed", multiPlayerMode ? "true" : "false");
    modeSingleBtn.disabled = gameStarted;
    modeMultiBtn.disabled = gameStarted;
    if (playModeToggle) playModeToggle.setAttribute("aria-disabled", gameStarted ? "true" : "false");
  }

  function syncSetupButtons() {
    const editorOpen = !playersEditor.hidden;
    btnStartFromSetup.hidden = gameStarted || !editorOpen;
    roundsTrigger.disabled = gameStarted;
    // Reactions mode stays editable anytime (incl. mid-game / while set to None)
    if (reactionModeTrigger) reactionModeTrigger.disabled = false;
    if (gameStarted) closeRoundsMenu();
    if (roundsPicker) roundsPicker.hidden = false;
    syncPlayModeToggle();
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
    closeSoundModeMenu();
    closeReactionModeMenu();
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

  function makeBlankPlayer(name) {
    return {
      name,
      banked: 0,
      hits: 0,
      reactions: [],
      favorite: null,
      done: false,
      roundsPlayed: 0,
    };
  }

  function ensureActivePlayerSlot() {
    if (players.length === 0) {
      players.push(makeBlankPlayer("Player 1"));
      currentPlayer = 0;
      renderPlayerList();
    }
    if (currentPlayer < 0 || currentPlayer >= players.length) currentPlayer = 0;
  }

  function commitActivePlayerRename(rawName) {
    ensureActivePlayerSlot();
    const fallback = `Player ${currentPlayer + 1}`;
    const name = String(rawName || "")
      .trim()
      .slice(0, 24) || fallback;
    players[currentPlayer].name = name;
    renamingActivePlayer = false;
    if (scoreLabelEdit) {
      scoreLabelEdit.remove();
      scoreLabelEdit = null;
    }
    scoreLabel.hidden = false;
    scoreLabel.textContent = name;
    renderPlayerList();
    renderLeaderboard();
  }

  function cancelActivePlayerRename() {
    renamingActivePlayer = false;
    if (scoreLabelEdit) {
      scoreLabelEdit.remove();
      scoreLabelEdit = null;
    }
    scoreLabel.hidden = false;
    const player = players[currentPlayer];
    if (player) scoreLabel.textContent = player.name;
  }

  function beginActivePlayerRename() {
    if (renamingActivePlayer || players.length === 0) return;
    renamingActivePlayer = true;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "score-label-edit";
    input.maxLength = 24;
    input.value = players[currentPlayer].name;
    input.setAttribute("aria-label", "Edit player name");
    input.style.width = `${Math.max(4, Math.min(24, input.value.length + 2))}ch`;
    scoreLabel.hidden = true;
    scoreLabel.after(input);
    scoreLabelEdit = input;
    input.focus();
    input.select();

    const finish = (commit) => {
      if (!renamingActivePlayer) return;
      if (commit) commitActivePlayerRename(input.value);
      else cancelActivePlayerRename();
    };

    input.addEventListener("input", () => {
      input.style.width = `${Math.max(4, Math.min(24, input.value.length + 2))}ch`;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      }
    });
    input.addEventListener("blur", () => finish(true));
  }

  function syncTurnHud() {
    turnHud.hidden = false;
    if (players.length === 0) {
      if (!renamingActivePlayer) {
        scoreLabel.textContent = "Add players";
        scoreLabel.hidden = false;
      }
      scoreboard.classList.remove("is-multi-round");
      roundLabel.hidden = true;
      return;
    }
    if (currentPlayer < 0 || currentPlayer >= players.length) currentPlayer = 0;
    const player = players[currentPlayer];
    if (!renamingActivePlayer) {
      scoreLabel.textContent = player.name;
      scoreLabel.hidden = false;
    }
    const multiRound = gameStarted && totalRounds > 1;
    scoreboard.classList.toggle("is-multi-round", multiRound);
    roundLabel.hidden = !multiRound;
    if (multiRound) {
      roundLabel.textContent = `Round #${currentRoundNumber(player)}`;
    }
  }

  const leaderboardEmpty = document.getElementById("leaderboard-empty");
  const highScoreEl = document.getElementById("high-score");
  const highScoreNameEl = document.getElementById("high-score-name");
  const highScoreStatsEl = document.getElementById("high-score-stats");

  /** @returns {{ name: string, banked: number, hits: number } | null} */
  function loadHighScore() {
    try {
      const raw = JSON.parse(localStorage.getItem(HIGH_SCORE_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      const name = String(raw.name || "").trim();
      const banked = Math.max(0, Math.floor(Number(raw.banked) || 0));
      const hits = Math.max(0, Math.floor(Number(raw.hits) || 0));
      if (!name || banked <= 0) return null;
      return { name, banked, hits };
    } catch {
      return null;
    }
  }

  function saveHighScore(record) {
    localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(record));
  }

  /** Higher cash wins; same cash → fewer hits wins (matches cash-tie rules). */
  function isBetterHighScore(candidate, current) {
    if (!candidate || candidate.banked <= 0) return false;
    if (!current) return true;
    if (candidate.banked !== current.banked) return candidate.banked > current.banked;
    return (candidate.hits || 0) < (current.hits || 0);
  }

  function considerHighScore(name, banked, hits) {
    const candidate = {
      name: String(name || "").trim(),
      banked: Math.max(0, Math.floor(Number(banked) || 0)),
      hits: Math.max(0, Math.floor(Number(hits) || 0)),
    };
    if (!candidate.name || candidate.banked <= 0) return false;
    const current = loadHighScore();
    if (!isBetterHighScore(candidate, current)) return false;
    saveHighScore(candidate);
    return true;
  }

  function considerPlayersForHighScore(list = players) {
    let changed = false;
    list.forEach((p) => {
      if (considerHighScore(p.name, p.banked, p.hits)) changed = true;
    });
    return changed;
  }

  function renderHighScore() {
    if (!highScoreEl || !highScoreNameEl || !highScoreStatsEl) return;
    const record = loadHighScore();
    if (!record) {
      highScoreEl.hidden = true;
      highScoreNameEl.textContent = "";
      highScoreStatsEl.textContent = "";
      return;
    }
    highScoreEl.hidden = false;
    highScoreNameEl.textContent = record.name;
    highScoreStatsEl.innerHTML = `
      <span class="hs-cash">${formatValue(record.banked)}</span>
      <span class="hs-sep" aria-hidden="true">|</span>
      <span class="hs-hits"><span class="lb-hits-icon" aria-hidden="true"></span>${record.hits}</span>
    `;
  }

  function renderLeaderboard() {
    renderHighScore();
    const showScores = gameStarted && players.length > 0;
    if (!showScores) {
      leaderboardList.innerHTML = "";
      if (leaderboardEmpty) {
        leaderboardEmpty.hidden = false;
        leaderboardEmpty.textContent = players.length
          ? "Waiting for game start…"
          : "Waiting for players…";
      }
      return;
    }

    if (leaderboardEmpty) leaderboardEmpty.hidden = true;

    const ranked = players
      .map((p, index) => ({ p, index, total: playerDisplayTotal(p, index) }))
      .sort((a, b) => b.total - a.total || a.index - b.index);

    leaderboardList.innerHTML = ranked
      .map(
        ({ p, index, total }, rank) => {
          const hits = Math.max(0, p.hits || 0);
          return `
      <li class="leaderboard-row${index === currentPlayer && !p.done ? " is-active" : ""}${p.done ? " is-done" : ""}">
        <span class="lb-rank">${rank + 1}</span>
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-score">${formatValue(total)}</span>
        <span class="lb-hits"><span class="lb-hits-icon" aria-hidden="true"></span>${hits} ${hits === 1 ? "Hit" : "Hits"}</span>
      </li>`;
        }
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

  const lobbyMusic = new Audio("assets/quirky-loading-theme.ogg");
  lobbyMusic.loop = true;
  lobbyMusic.preload = "auto";
  lobbyMusic.volume = 0.32;

  // SFX (effects mode) — cash-register dial-up after prize flash
  const chaChingSfx = new Audio("assets/cha_ching.wav");
  chaChingSfx.preload = "auto";
  chaChingSfx.volume = lobbyMusic.volume;
  chaChingSfx.addEventListener("ended", () => syncLobbyMusic());

  // SFX (effects mode) — dial drain during "Turkey Tom Got You!"
  const moneyDrainSfx = new Audio("assets/money_drain.wav");
  moneyDrainSfx.preload = "auto";
  moneyDrainSfx.volume = lobbyMusic.volume;
  moneyDrainSfx.addEventListener("ended", () => syncLobbyMusic());

  const cardFlipSfx = new Audio("assets/card-flip-whoosh.mp3");
  cardFlipSfx.preload = "auto";
  cardFlipSfx.volume = 0.75;
  cardFlipSfx.addEventListener("ended", () => syncLobbyMusic());

  const podiumApplause = new Audio("assets/podium-real-applause.ogg");
  podiumApplause.preload = "auto";
  podiumApplause.volume = 0.7;
  podiumApplause.addEventListener("ended", () => syncLobbyMusic());

  // Source remastered to lobby peak; keep playback gain near lobby so levels match.
  const noWinnerComedy = new Audio("assets/no-winner-comedy.wav");
  noWinnerComedy.preload = "auto";
  noWinnerComedy.volume = 0.38;
  noWinnerComedy.addEventListener("ended", () => syncLobbyMusic());

  // Flash stings — SFX (not music). Peak-matched; volumeScale is relative to lobby level.
  const PRIZE_FLASH_STINGS = [
    { src: "assets/yippee.wav", volumeScale: 1 },
    { src: "assets/okay_lets_go.wav", volumeScale: 2 },
    { src: "assets/yeehaw.wav", volumeScale: 1 },
    { src: "assets/oh_yeah.wav", volumeScale: 1 },
  ];
  const TURKEY_FLASH_STINGS = [
    { src: "assets/bruh.wav", volumeScale: 1 },
    { src: "assets/yikes.wav", volumeScale: 1 },
  ];
  let prizeFlashStingIndex = 0;
  let turkeyFlashStingIndex = 0;
  /** @type {HTMLAudioElement|null} */
  let activeFlashSting = null;

  PRIZE_FLASH_STINGS.concat(TURKEY_FLASH_STINGS).forEach(({ src }) => {
    const a = new Audio(src);
    a.preload = "auto";
  });

  /** Only the looping lobby theme. Everything else is a sound effect. */
  function lobbyMusicAllowed() {
    return soundMode === "all";
  }

  /** Cha-ching, money drain, flash VO, clips, ticks, fanfare, etc. */
  function effectsAllowed() {
    return soundMode !== "mute";
  }

  function stopFlashSting() {
    if (!activeFlashSting) return;
    try {
      activeFlashSting.pause();
      activeFlashSting.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
    activeFlashSting = null;
  }

  function nextFlashSting(kind) {
    if (kind === "turkey") {
      const sting = TURKEY_FLASH_STINGS[turkeyFlashStingIndex % TURKEY_FLASH_STINGS.length];
      turkeyFlashStingIndex = (turkeyFlashStingIndex + 1) % TURKEY_FLASH_STINGS.length;
      return sting;
    }
    const sting = PRIZE_FLASH_STINGS[prizeFlashStingIndex % PRIZE_FLASH_STINGS.length];
    prizeFlashStingIndex = (prizeFlashStingIndex + 1) % PRIZE_FLASH_STINGS.length;
    return sting;
  }

  /** Cycle prize/turkey flash VO — SFX. Resolves when the sting ends. */
  function playFlashSting(kind) {
    stopFlashSting();
    if (!effectsAllowed()) return Promise.resolve();
    const sting = nextFlashSting(kind);
    const audio = new Audio(sting.src);
    const scale = typeof sting.volumeScale === "number" ? sting.volumeScale : 1;
    audio.volume = Math.min(1, lobbyMusic.volume * scale);
    activeFlashSting = audio;
    return new Promise((resolve) => {
      const done = () => {
        if (activeFlashSting === audio) activeFlashSting = null;
        resolve();
      };
      audio.addEventListener("ended", done, { once: true });
      audio.addEventListener("error", done, { once: true });
      const playAttempt = audio.play();
      if (playAttempt) playAttempt.catch(done);
    });
  }

  function isPodiumApplausePlaying() {
    return effectsAllowed() && !podiumApplause.paused && !podiumApplause.ended;
  }

  function isNoWinnerComedyPlaying() {
    return effectsAllowed() && !noWinnerComedy.paused && !noWinnerComedy.ended;
  }

  function stopPodiumApplause() {
    try {
      podiumApplause.pause();
      podiumApplause.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function stopNoWinnerComedy() {
    try {
      noWinnerComedy.pause();
      noWinnerComedy.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function stopResultFanfare() {
    stopPodiumApplause();
    stopNoWinnerComedy();
    syncLobbyMusic();
  }

  function playPodiumApplause() {
    if (!effectsAllowed()) return;
    stopNoWinnerComedy();
    try {
      podiumApplause.pause();
      podiumApplause.currentTime = 0;
      const playAttempt = podiumApplause.play();
      if (playAttempt) playAttempt.catch(() => {});
    } catch (_) {
      /* ignore playback errors */
    }
    syncLobbyMusic();
  }

  function playNoWinnerComedy() {
    if (!effectsAllowed()) return;
    stopPodiumApplause();
    try {
      noWinnerComedy.pause();
      noWinnerComedy.currentTime = 0;
      const playAttempt = noWinnerComedy.play();
      if (playAttempt) playAttempt.catch(() => {});
    } catch (_) {
      /* ignore playback errors */
    }
    syncLobbyMusic();
  }

  /** End-of-turn sting: applause if cash was bagged, comedy/boo if Turkey Tom busted them. */
  function playEndTurnResultSound(reason) {
    if (reason === "turkey") playNoWinnerComedy();
    else if (reason === "bank") playPodiumApplause();
  }

  function isOverlayClipPlaying() {
    return [fireVideo, bustVideo].some((v) => v && v.classList.contains("is-showing"));
  }

  /** True while the between-spins reaction flash is showing (lobby must stay silent). */
  let reactionFlashPlaying = false;

  function isReactionFlashPlaying() {
    return reactionFlashPlaying;
  }

  function isCardFlipSfxPlaying() {
    return effectsAllowed() && !cardFlipSfx.paused && !cardFlipSfx.ended;
  }

  function stopCardFlipSfx() {
    try {
      cardFlipSfx.pause();
      cardFlipSfx.currentTime = 0;
    } catch (_) {
      /* ignore */
    }
  }

  function silenceSpinTicks() {
    if (!gobbleGain) return;
    try {
      gobbleGain.gain.setValueAtTime(0, audioCtx?.currentTime || 0);
      gobbleGain.disconnect();
    } catch (_) {
      /* ignore */
    }
    gobbleGain = null;
  }

  function syncOverlayClipMute() {
    const muted = !effectsAllowed();
    [fireVideo, bustVideo].forEach((video) => {
      if (video && video.classList.contains("is-showing")) video.muted = muted;
    });
  }

  function closeSoundModeMenu() {
    if (!soundModeMenu || !soundModeTrigger) return;
    soundModeMenu.hidden = true;
    soundModeTrigger.setAttribute("aria-expanded", "false");
  }

  function closeReactionModeMenu() {
    if (!reactionModeMenu || !reactionModeTrigger) return;
    reactionModeMenu.hidden = true;
    reactionModeTrigger.setAttribute("aria-expanded", "false");
  }

  function openSoundModeMenu() {
    if (!soundModeMenu || !soundModeTrigger) return;
    closeRoundsMenu();
    closeReactionModeMenu();
    soundModeMenu.hidden = false;
    soundModeTrigger.setAttribute("aria-expanded", "true");
  }

  function openReactionModeMenu() {
    if (!reactionModeMenu || !reactionModeTrigger) return;
    closeRoundsMenu();
    closeSoundModeMenu();
    reactionModeMenu.hidden = false;
    reactionModeTrigger.setAttribute("aria-expanded", "true");
  }

  function toggleSoundModeMenu() {
    if (!soundModeMenu) return;
    if (soundModeMenu.hidden) openSoundModeMenu();
    else closeSoundModeMenu();
  }

  function toggleReactionModeMenu() {
    if (!reactionModeMenu) return;
    if (reactionModeMenu.hidden) openReactionModeMenu();
    else closeReactionModeMenu();
  }

  function syncSoundModeToggle() {
    const meta = SOUND_MODE_META[soundMode] || SOUND_MODE_META.all;
    if (soundModeTriggerIcons) soundModeTriggerIcons.innerHTML = meta.iconsHtml;
    if (soundModeTrigger) {
      soundModeTrigger.setAttribute("aria-label", `${meta.label}. Music and Sounds`);
      soundModeTrigger.title = meta.label;
    }
    soundModeMenu?.querySelectorAll("[data-sound-mode]").forEach((opt) => {
      const on = opt.getAttribute("data-sound-mode") === soundMode;
      opt.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function syncReactionModeToggle() {
    const meta = REACTION_MODE_META[reactionMode] || REACTION_MODE_META.video;
    if (reactionModeTriggerIcons) reactionModeTriggerIcons.innerHTML = meta.iconsHtml;
    if (reactionModeTrigger) {
      reactionModeTrigger.setAttribute("aria-label", `${meta.label}. Reactions`);
      reactionModeTrigger.title = meta.label;
    }
    reactionModeMenu?.querySelectorAll("[data-reaction-mode]").forEach((opt) => {
      const on = opt.getAttribute("data-reaction-mode") === reactionMode;
      opt.setAttribute("aria-selected", on ? "true" : "false");
    });
    syncReactionEmptyLabel();
  }

  function setReactionMode(mode) {
    if (mode !== "video" && mode !== "image" && mode !== "none") return;
    reactionMode = mode;
    try {
      localStorage.setItem(REACTION_MODE_KEY, reactionMode);
    } catch (_) {
      /* ignore quota / private mode */
    }
    syncReactionModeToggle();
    closeReactionModeMenu();
  }

  function setSoundMode(mode) {
    if (mode !== "all" && mode !== "effects" && mode !== "mute") return;
    soundMode = mode;
    try {
      localStorage.setItem(SOUND_MODE_KEY, soundMode);
    } catch (_) {
      /* ignore quota / private mode */
    }
    syncSoundModeToggle();
    closeSoundModeMenu();
    if (!effectsAllowed()) {
      stopCardFlipSfx();
      stopFlashSting();
      stopChaChing();
      stopMoneyDrain();
      stopResultFanfare();
      silenceSpinTicks();
    }
    syncOverlayClipMute();
    if (lobbyMusicAllowed()) unlockLobbyMusic();
    else syncLobbyMusic();
  }

  function playCardFlipSfx() {
    if (!effectsAllowed()) return;
    try {
      cardFlipSfx.pause();
      cardFlipSfx.currentTime = 0;
      const playAttempt = cardFlipSfx.play();
      if (playAttempt) playAttempt.catch(() => {});
    } catch (_) {
      /* ignore playback errors */
    }
    syncLobbyMusic();
  }

  /** Overlapping flip hit — clones so rapid triples don't cut each other off. */
  function playCardFlipSfxLayered() {
    if (!effectsAllowed()) return;
    try {
      const layer = cardFlipSfx.cloneNode(true);
      layer.volume = cardFlipSfx.volume;
      const playAttempt = layer.play();
      if (playAttempt) playAttempt.catch(() => {});
      layer.addEventListener(
        "ended",
        () => {
          layer.remove();
        },
        { once: true }
      );
    } catch (_) {
      playCardFlipSfx();
    }
    syncLobbyMusic();
  }

  function syncLobbyMusic() {
    const shouldPlay =
      lobbyMusicAllowed() &&
      !document.hidden &&
      !spinning &&
      !isOverlayClipPlaying() &&
      !isReactionFlashPlaying() &&
      !isScoreDialAnimating() &&
      !isCardFlipSfxPlaying() &&
      !isPodiumApplausePlaying() &&
      !isNoWinnerComedyPlaying();
    if (!shouldPlay) {
      if (!lobbyMusic.paused) lobbyMusic.pause();
      return;
    }
    if (!lobbyMusic.paused) return;
    const playAttempt = lobbyMusic.play();
    if (playAttempt) playAttempt.catch(() => {});
  }

  function unlockLobbyMusic() {
    ensureAudio();
    syncLobbyMusic();
  }

  function playGobble() {
    if (!spinning || !effectsAllowed()) return;
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
    fireHit.style.removeProperty("--fire-hit-size");
    fireHit.setAttribute("aria-hidden", "true");
  }

  /**
   * Keep the prize blast centered on the feather burst, but shrink the type so
   * it never reaches the camera-well edges (incl. during the 1.06 pop scale).
   */
  function fitFireHitInWell() {
    if (!fireHit || !cameraWell || fireHit.hidden) return;
    const wellW = cameraWell.clientWidth;
    const wellH = cameraWell.clientHeight;
    if (wellW < 8 || wellH < 8) return;

    const padX = Math.max(10, wellW * 0.07);
    const padY = Math.max(8, wellH * 0.07);
    const centerX = wellW * 0.8;
    const centerY = wellH * 0.3;
    // Room while staying centered on the burst — tightest side wins
    const maxHalfW = Math.min(centerX - padX, wellW - padX - centerX);
    const maxHalfH = Math.min(centerY - padY, wellH - padY - centerY);
    const popPad = 1.08; // leave headroom for fire-hit-pop peak scale
    const maxW = Math.max(20, maxHalfW * 2) / popPad;
    const maxH = Math.max(14, maxHalfH * 2) / popPad;

    fireHit.style.removeProperty("--fire-hit-size");
    const base = parseFloat(getComputedStyle(fireHit).fontSize) || 24;
    fireHit.style.setProperty("--fire-hit-size", `${base.toFixed(2)}px`);

    const w = Math.max(1, fireHit.scrollWidth);
    const h = Math.max(1, fireHit.scrollHeight);
    const scale = Math.min(1, maxW / w, maxH / h);
    fireHit.style.setProperty("--fire-hit-size", `${(base * scale).toFixed(2)}px`);
  }

  function scheduleFireHitAmount(text) {
    clearFireHit();
    fireHitTimer = setTimeout(() => {
      fireHit.textContent = text;
      fireHit.hidden = false;
      fireHit.setAttribute("aria-hidden", "false");
      fireHit.classList.remove("is-pop");
      fitFireHitInWell();
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
    syncLobbyMusic();
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
        syncLobbyMusic();
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
      video.muted = !effectsAllowed();
      video.playsInline = true;
      video.onended = finish;
      video.onerror = finish;
      syncLobbyMusic();

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
        if (!effectsAllowed()) video.muted = true;
        syncLobbyMusic();
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
    syncLobbyMusic();
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
      syncLobbyMusic();
      return;
    }

    landed.el.classList.add("is-awarded");
    spinsThisTurn += 1;

    const awardedValue = landed.value;
    const wasTurkey = landed.isTurkey;
    const playerName = players[currentPlayer]?.name || "Player";

    const reactionLabel = wasTurkey ? "Bust!" : `+${formatValue(awardedValue)}`;
    const reactionHud = snapshotReactionHud(wasTurkey, awardedValue);
    // Seed live camera HUD now — stays hidden under Fire!/bust, then persists through flash
    setCameraReactionHud({
      label: reactionLabel,
      bust: wasTurkey,
      score: reactionHud.score,
      hits: reactionHud.hits,
    });

    if (wasTurkey) {
      // Keep dials on the current total until money_drain during the bust message
      turnOver = true;
      canAct = false;
      awaitingChoice = false;
      playSting("bust");
      updateActionButton();
      // Start bust playback in the same click turn so audio/video unlock reliably
      const bustPromise = playTurkeyAnimation();
      if (isReactionVideoMode()) {
        // Record from Fire!/bust start through the end of the bust clip
        reactionCapturePromise = captureReactionClip({
          bust: true,
          label: reactionLabel,
          name: playerName,
          score: reactionHud.score,
          hits: reactionHud.hits,
          untilPromise: bustPromise,
        });
      } else if (isReactionImageMode()) {
        reactionCapturePromise = scheduleStillReaction({
          bust: true,
          label: reactionLabel,
          name: playerName,
          score: reactionHud.score,
          hits: reactionHud.hits,
        });
      } else {
        reactionCapturePromise = Promise.resolve();
      }
      finishTurnAfterTurkey(bustPromise);
      return;
    }

    const firePromise = playFireVideo();
    if (isReactionVideoMode()) {
      // Record from Fire! start through the end of the fire clip
      reactionCapturePromise = captureReactionClip({
        bust: false,
        label: reactionLabel,
        name: playerName,
        score: reactionHud.score,
        hits: reactionHud.hits,
        untilPromise: firePromise,
      });
    } else if (isReactionImageMode()) {
      reactionCapturePromise = scheduleStillReaction({
        bust: false,
        label: reactionLabel,
        name: playerName,
        score: reactionHud.score,
        hits: reactionHud.hits,
      });
    } else {
      reactionCapturePromise = Promise.resolve();
    }

    scheduleFireHitAmount(formatValue(awardedValue));
    // Hold the running total (+ hit count) until after zinger / reaction flash, then cha-ching dial-up
    hideBanner();
    playSting("win");

    canAct = false;
    awaitingChoice = false;
    updateActionButton();
    finishPrizeAfterFire(firePromise, landed, awardedValue);
  }

  async function decodeFlashImage() {
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
  }

  /** Flash mic playback is 2× louder than unity (HTMLAudio maxes at 1). */
  const FLASH_AUDIO_GAIN = 2;

  function stopFlashPlaybackAudio(audio, graph) {
    if (audio) {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch (_) {
        /* ignore */
      }
    }
    if (graph) {
      try {
        graph.source?.disconnect();
      } catch (_) {
        /* ignore */
      }
      try {
        graph.gain?.disconnect();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /** Source seconds to keep from the cheer spike (≥1s → ~2s wall time at 0.5×). */
  const FLASH_SPIKE_MIN_SEC = 1;

  /**
   * Find the cheer spike onset, then keep at least 1s of source from there
   * (plays ~2s at 0.5×). Returns trim bounds + frame indices, or null if flat/quiet.
   */
  async function analyzeReactionAudioSpike(audioBlob, frameCount) {
    if (!audioBlob || !frameCount) return null;
    try {
      ensureAudio();
      const raw = await audioBlob.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(raw.slice(0));
      const channel = buffer.getChannelData(0);
      const { sampleRate, duration } = buffer;
      if (!channel.length || duration <= 0) return null;

      const clipFps = reactionClipFps();
      const windowSec = 1 / clipFps;
      const windowSamples = Math.max(1, Math.floor(sampleRate * windowSec));
      const energies = [];
      for (let i = 0; i < channel.length; i += windowSamples) {
        const end = Math.min(channel.length, i + windowSamples);
        let sum = 0;
        for (let j = i; j < end; j += 1) sum += channel[j] * channel[j];
        energies.push(Math.sqrt(sum / (end - i)));
      }
      if (energies.length < 2) return null;

      let peakIdx = 0;
      let peak = energies[0];
      for (let i = 1; i < energies.length; i += 1) {
        if (energies[i] > peak) {
          peak = energies[i];
          peakIdx = i;
        }
      }

      const sorted = energies.slice().sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      // Quiet / flat take — no useful spike to isolate
      if (peak < 0.015 || peak < Math.max(median * 2.4, median + 0.012)) {
        return null;
      }

      // Walk back from the peak to the start of the loud region
      const threshold = Math.max(median * 2.0, peak * 0.38, 0.012);
      let spikeStart = peakIdx;
      while (spikeStart > 0 && energies[spikeStart - 1] >= threshold) spikeStart -= 1;

      // ≥1s of source starting at the spike → ~2s playback at 0.5×
      let startSec = spikeStart * windowSec;
      let endSec = startSec + FLASH_SPIKE_MIN_SEC;
      if (endSec > duration) {
        endSec = duration;
        startSec = Math.max(0, endSec - FLASH_SPIKE_MIN_SEC);
      }
      // If the whole take is shorter than 1s, use everything
      if (duration < FLASH_SPIKE_MIN_SEC) {
        startSec = 0;
        endSec = duration;
      }

      let startFrame = Math.max(0, Math.floor(startSec * clipFps));
      let endFrame = Math.min(frameCount, Math.ceil(endSec * clipFps));
      const minFrames = Math.min(frameCount, Math.ceil(FLASH_SPIKE_MIN_SEC * clipFps));
      if (endFrame - startFrame < minFrames) {
        endFrame = Math.min(frameCount, startFrame + minFrames);
        if (endFrame - startFrame < minFrames) {
          startFrame = Math.max(0, endFrame - minFrames);
        }
      }
      if (startFrame >= endFrame) return null;

      return { startSec, endSec, startFrame, endFrame, peakIdx };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Play reaction frames (+ optional mic) in the expanded flash at `rate`.
   * Prize: cheer spike region at 0.5×. Bust: full clip at 2×.
   * Only called when a meaningful audio spike was detected. Audio is an SFX.
   */
  async function playFlashClipAtRate(frames, reaction, rate, opts = {}) {
    const playbackRate = rate > 0 ? rate : 1;
    const fps = reactionClipFps();
    const frameInterval = Math.max(16, Math.round(1000 / fps / playbackRate));
    const trim = opts.trimToSpike ? reaction?.flashTrim : null;
    const startFrame = trim ? trim.startFrame : 0;
    const endFrame = trim ? trim.endFrame : frames.length;
    const startSec = trim ? trim.startSec : 0;
    const decodeEach = isLikelyMobileDevice();
    let flashAudio = null;
    let flashGraph = null;

    // Flash audio counts as a sound effect (all / effects — not mute)
    if (effectsAllowed() && reaction?.audioUrl) {
      try {
        ensureAudio();
        if (audioCtx?.state === "suspended") {
          try {
            await audioCtx.resume();
          } catch (_) {
            /* continue with element volume */
          }
        }
        flashAudio = new Audio(reaction.audioUrl);
        flashAudio.playsInline = true;
        flashAudio.playbackRate = playbackRate;
        // Let pitch ride with rate — slow-mo deep / 2× chipmunk
        if ("preservesPitch" in flashAudio) flashAudio.preservesPitch = false;
        if ("mozPreservesPitch" in flashAudio) flashAudio.mozPreservesPitch = false;
        if ("webkitPreservesPitch" in flashAudio) flashAudio.webkitPreservesPitch = false;
        flashAudio.volume = 1;
        try {
          flashAudio.currentTime = Math.max(0, startSec);
        } catch (_) {
          /* iOS may reject seek before metadata */
        }
        // Prefer GainNode boost; fall back to plain element play on mobile WebAudio quirks
        try {
          const source = audioCtx.createMediaElementSource(flashAudio);
          const gain = audioCtx.createGain();
          gain.gain.value = FLASH_AUDIO_GAIN;
          source.connect(gain);
          gain.connect(audioCtx.destination);
          flashGraph = { source, gain };
        } catch (_) {
          flashGraph = null;
          flashAudio.volume = Math.min(1, FLASH_AUDIO_GAIN);
        }
        const playAttempt = flashAudio.play();
        if (playAttempt) playAttempt.catch(() => {});
      } catch (_) {
        stopFlashPlaybackAudio(flashAudio, flashGraph);
        flashAudio = null;
        flashGraph = null;
      }
    }

    try {
      for (let i = startFrame; i < endFrame; i += 1) {
        reactionFlashImage.src = frames[i] || frames[0];
        // Mobile Safari often skips paints if we don't await decode between data-URLs
        if (decodeEach || i === startFrame) await decodeFlashImage();
        await waitMs(frameInterval);
      }
    } finally {
      stopFlashPlaybackAudio(flashAudio, flashGraph);
    }
  }

  /**
   * Expanded reaction flash.
   * Always: cycling zinger over the selected-frame still.
   * If video mode + meaningful mic spike: after the zinger, play the recording
   * (prize spike @ 0.5×, full bust @ 2×). No spike → zinger only, then move on.
   * @param {object|string} reactionOrUrl
   * @param {{ rate?: number, trimToSpike?: boolean, kind?: "prize"|"turkey" }} [opts]
   */
  async function flashReactionPhoto(reactionOrUrl, opts = {}) {
    if (!reactionFlash || !reactionFlashImage) return;
    // Reactions → None: skip the between-pulls zinger / flash entirely
    if (isReactionNoneMode()) return;

    const rate = typeof opts.rate === "number" && opts.rate > 0 ? opts.rate : 0.5;
    const trimToSpike = !!opts.trimToSpike;
    const kind = opts.kind === "turkey" ? "turkey" : "prize";
    const reaction =
      reactionOrUrl && typeof reactionOrUrl === "object" ? reactionOrUrl : null;
    const dataUrl = reaction ? reactionDisplayUrl(reaction) : reactionOrUrl;
    if (!dataUrl) return;

    const frames = reaction?.frames;
    const hasClipFrames = Array.isArray(frames) && frames.length > 1;
    const clipFps = reactionClipFps();
    // Prefer mic-spike trim; if analysis missed (common on quiet mobile mics), still slow-mo a mid window
    if (trimToSpike && hasClipFrames && reaction && !reaction.flashTrim) {
      const span = Math.min(
        frames.length,
        Math.max(3, Math.ceil(FLASH_SPIKE_MIN_SEC * clipFps))
      );
      const startFrame = Math.max(0, Math.floor((frames.length - span) / 2));
      const endFrame = Math.min(frames.length, startFrame + span);
      reaction.flashTrim = {
        startSec: startFrame / clipFps,
        endSec: endFrame / clipFps,
        startFrame,
        endFrame,
        peakIdx: startFrame,
      };
    }
    // Play from captured frames even if mode flipped; video-mode gate was skipping valid clips
    const playClip = hasClipFrames && (isReactionVideoMode() || reaction?.isClip);

    // Cover the live camera with the stored snapshot, then enlarge that composite
    reactionFlash.hidden = false;
    reactionFlash.classList.add("is-on");
    reactionFlash.setAttribute("aria-hidden", "false");
    cameraWell.classList.add("is-reaction-flash");

    reactionFlashPlaying = true;
    // Sting + optional reaction mic only — lobby stays out
    stopCardFlipSfx();
    syncLobbyMusic();

    try {
      // Selected-frame thumbnail under the zinger either way
      reactionFlashImage.src = dataUrl;
      await decodeFlashImage();
      await playFlashSting(kind);

      if (playClip) {
        await playFlashClipAtRate(frames, reaction, rate, { trimToSpike });
      } else if (!effectsAllowed()) {
        // Muted: no zinger length to wait on — brief still hold
        await waitMs(REACTION_FLASH_MS);
      }
    } finally {
      stopFlashSting();
      reactionFlashPlaying = false;
      cameraWell.classList.remove("is-reaction-flash");
      reactionFlash.classList.remove("is-on");
      reactionFlash.hidden = true;
      reactionFlash.setAttribute("aria-hidden", "true");
      reactionFlashImage.removeAttribute("src");
      syncLobbyMusic();
    }
  }

  async function finishPrizeAfterFire(firePromise, landed, awardedValue) {
    await (firePromise || fireVideoPromise || Promise.resolve());
    if (turnOver) return;
    // Wait for the normal in-turn snap (taken during Fire!), then flip — no new capture later
    await (reactionCapturePromise || Promise.resolve());
    const latest = players[currentPlayer]?.reactions?.at(-1) || null;
    if (turnOver) return;
    await playPrizeReveal(landed);
    if (turnOver) return;
    // Hit every tile without a turkey → accuse, then flip the board back
    if (isBoardFullyCleared()) {
      await showBoardClearedCheatMoment();
      if (turnOver) return;
    }
    // Zinger; then cheer spike @ 0.5× only if mic had a real peak
    await flashReactionPhoto(latest, { rate: 0.5, trimToSpike: true, kind: "prize" });
    // Safe to encode download video now that the flash has finished
    deferWarmReactionVideoExport(latest);
    if (turnOver) return;
    // Cash register dial-up after flash audio
    await creditPrizeAmount(awardedValue);
    if (turnOver) return;
    canAct = true;
    awaitingChoice = true;
    updateActionButton();
  }

  async function finishTurnAfterTurkey(bustPromise) {
    await (bustPromise || playTurkeyAnimation());
    // Bust clip done — show copy, drain dials with money_drain, hold message
    showTurkeyBustMessage();
    await Promise.all([
      drainScoreToZero(),
      waitMs(TURKEY_MESSAGE_MS),
      reactionCapturePromise || Promise.resolve(),
    ]);
    const latest = players[currentPlayer]?.reactions?.at(-1) || null;
    // Zinger; then full bust clip @ 2× only if mic had a real peak
    await flashReactionPhoto(latest, { rate: 2, kind: "turkey" });
    deferWarmReactionVideoExport(latest);
    hideBanner();
    openEndTurnGallery("turkey");
  }

  /** Match object-fit: cover — crop the stream to the on-screen camera well aspect. */
  function getReactionCoverCrop() {
    const vw = camera.videoWidth || 640;
    const vh = camera.videoHeight || 480;
    const dw = camera.clientWidth || cameraWell.clientWidth || vw;
    const dh = camera.clientHeight || cameraWell.clientHeight || vh;
    if (!vw || !vh || !dw || !dh) {
      return { sx: 0, sy: 0, sw: vw, sh: vh, w: vw, h: vh };
    }
    const displayAspect = dw / dh;
    const videoAspect = vw / vh;
    let sx;
    let sy;
    let sw;
    let sh;
    if (videoAspect > displayAspect) {
      sh = vh;
      sw = vh * displayAspect;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / displayAspect;
      sx = 0;
      sy = (vh - sh) / 2;
    }
    return {
      sx,
      sy,
      sw,
      sh,
      w: Math.max(1, Math.round(sw)),
      h: Math.max(1, Math.round(sh)),
    };
  }

  function getBannerEl() {
    return bannerImage.complete && bannerImage.naturalWidth ? bannerImage : cameraBorder;
  }

  /** Export / capture size: at least the border PNG’s native resolution, same aspect as the cover crop. */
  function getReactionOutputSize(srcW, srcH) {
    const banner = getBannerEl();
    const bw = banner?.naturalWidth || 0;
    const bh = banner?.naturalHeight || 0;
    if (!srcW || !srcH) {
      return { w: Math.max(1, bw || 640), h: Math.max(1, bh || 480) };
    }
    if (!bw || !bh) return { w: srcW, h: srcH };
    const scale = Math.max(bw / srcW, bh / srcH, 1);
    return {
      w: Math.max(1, Math.round(srcW * scale)),
      h: Math.max(1, Math.round(srcH * scale)),
    };
  }

  function drawReactionCamera(ctx, w, h, crop) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    if (crop) {
      ctx.drawImage(camera, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
    } else {
      ctx.drawImage(camera, 0, 0, w, h);
    }
    ctx.restore();
  }

  function drawImageCover(ctx, img, dw, dh) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
      ctx.drawImage(img, 0, 0, dw, dh);
      return;
    }
    const ir = iw / ih;
    const dr = dw / dh;
    let sx;
    let sy;
    let sw;
    let sh;
    if (ir > dr) {
      sh = ih;
      sw = ih * dr;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = iw / dr;
      sx = 0;
      sy = (ih - sh) / 2;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  }

  function stampBannerOnCanvas(ctx, w, h) {
    const banner = getBannerEl();
    if (!banner?.naturalWidth) return;
    // Draw the PNG at the canvas size; when canvas matches banner native size this is 1:1.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(banner, 0, 0, w, h);
  }

  /**
   * Score/hits at the moment of this spin’s result (before dial credit / drain animations).
   * Wins include the awarded cash + the new hit; busts keep the pre-drain total.
   */
  function snapshotReactionHud(bust, awardedValue) {
    const p = players[currentPlayer];
    const hits = (p?.hits || 0) + (bust ? 0 : 1);
    const award = Math.max(0, Math.round(Number(awardedValue) || 0));
    const score = bust ? activeRunningTotal() : activeRunningTotal() + award;
    return { score, hits };
  }

  function reactionHasHud(reaction) {
    if (!reaction) return false;
    // Prior-round favorites are stored as bare dataUrls — no spin/score snapshot.
    if (reaction.isPriorFavorite && reaction.score == null && reaction.hits == null) return false;
    return reaction.label != null || reaction.score != null || reaction.hits != null;
  }

  function reactionHudContentsHtml(reaction) {
    const label = escapeHtml(reaction.label || "");
    const score = formatValue(Math.max(0, Math.round(Number(reaction.score) || 0)));
    const hits = Math.max(0, Math.floor(Number(reaction.hits) || 0));
    const spinClass = reaction.bust ? "reaction-hud-spin is-bust" : "reaction-hud-spin";
    return `<div class="${spinClass}">${label}</div>
      <div class="reaction-hud-stats">
        <span class="reaction-hud-score">${score}</span>
        <span class="reaction-hud-hits"><span class="lb-hits-icon"></span>${hits}</span>
      </div>`;
  }

  function reactionOverlayHtml(reaction) {
    if (!reactionHasHud(reaction)) return "";
    return `<div class="reaction-hud" aria-hidden="true">
      ${reactionHudContentsHtml(reaction)}
    </div>`;
  }

  /** Live camera HUD — spin result + standings; CSS hides it during Fire!/bust. */
  function setCameraReactionHud(reaction) {
    if (!cameraReactionHud) return;
    if (!reactionHasHud(reaction)) {
      clearCameraReactionHud();
      return;
    }
    cameraReactionHud.innerHTML = reactionHudContentsHtml(reaction);
    cameraReactionHud.hidden = false;
    cameraReactionHud.setAttribute("aria-hidden", "false");
  }

  function clearCameraReactionHud() {
    if (!cameraReactionHud) return;
    cameraReactionHud.hidden = true;
    cameraReactionHud.setAttribute("aria-hidden", "true");
    cameraReactionHud.innerHTML = "";
  }

  function syncPreviewReactionHud(reaction) {
    const frame = previewImage?.parentElement;
    if (!frame) return;
    frame.querySelectorAll(".reaction-hud").forEach((el) => el.remove());
    if (!reactionHasHud(reaction)) return;
    frame.insertAdjacentHTML("beforeend", reactionOverlayHtml(reaction));
  }

  /** Preload crosshair for canvas stamps (same asset as leaderboard hits). */
  const hitsIconImage = new Image();
  hitsIconImage.decoding = "async";
  hitsIconImage.src = "assets/crosshair-hit.png";

  function ensureHitsIconLoaded() {
    if (hitsIconImage.complete && hitsIconImage.naturalWidth) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const done = () => resolve(!!(hitsIconImage.complete && hitsIconImage.naturalWidth));
      hitsIconImage.addEventListener("load", done, { once: true });
      hitsIconImage.addEventListener("error", done, { once: true });
      // Re-kick decode in case the first attempt raced
      if (!hitsIconImage.src) hitsIconImage.src = "assets/crosshair-hit.png";
    });
  }

  /** Gold crosshair + contour drop-shadow matching .reaction-hud-stats CSS filters. */
  function drawGoldHitsIcon(ctx, x, y, size) {
    const icon = hitsIconImage;
    if (!icon.complete || !icon.naturalWidth) return;

    const makeTinted = (color) => {
      const oc = document.createElement("canvas");
      oc.width = size;
      oc.height = size;
      const octx = oc.getContext("2d");
      if (!octx) return null;
      octx.drawImage(icon, 0, 0, size, size);
      octx.globalCompositeOperation = "source-in";
      octx.fillStyle = color;
      octx.fillRect(0, 0, size, size);
      return oc;
    };

    const black = makeTinted("#000000");
    const gold = makeTinted("#f0b429");
    if (!black || !gold) return;

    // CSS: drop-shadow(0 2px 3px) / (0 4px 12px) / (0 8px 28px) — scaled to icon size
    const layers = [
      { oy: Math.max(2, size * 0.12), blur: Math.max(3, size * 0.2), a: 1 },
      { oy: Math.max(4, size * 0.25), blur: Math.max(10, size * 0.75), a: 0.95 },
      { oy: Math.max(8, size * 0.5), blur: Math.max(18, size * 1.75), a: 0.85 },
    ];

    ctx.save();
    for (const layer of layers) {
      ctx.save();
      ctx.globalAlpha = layer.a;
      if (typeof ctx.filter === "string") {
        // Soft silhouette under the glyph — same idea as CSS filter: drop-shadow
        ctx.filter = `blur(${layer.blur}px)`;
        ctx.drawImage(black, x, y + layer.oy);
      } else {
        ctx.shadowColor = `rgba(0, 0, 0, ${layer.a})`;
        ctx.shadowBlur = layer.blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = layer.oy;
        ctx.drawImage(black, x, y);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (typeof ctx.filter === "string") ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(gold, x, y);
    ctx.restore();
  }

  function strokeFillText(ctx, text, x, y) {
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  /** Bake spin result + score/hits into a downloaded still/video frame (after border). */
  function stampReactionHudOnCanvas(ctx, w, h, reaction) {
    if (!reactionHasHud(reaction)) return;
    const label = String(reaction.label || "").trim();
    const scoreN = Math.max(0, Math.round(Number(reaction.score) || 0));
    const hitsN = Math.max(0, Math.floor(Number(reaction.hits) || 0));

    const padX = Math.round(w * 0.085);
    const padTop = Math.round(h * 0.08);
    const padBottom = Math.round(h * 0.085);
    const spinPx = Math.max(28, Math.round(w * 0.09));
    const statsPx = Math.max(20, Math.round(w * 0.055));
    const stroke = Math.max(3, Math.round(w * 0.01));

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
    ctx.shadowBlur = Math.max(22, Math.round(w * 0.045));
    ctx.shadowOffsetY = Math.max(6, Math.round(w * 0.012));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (label) {
      ctx.font = `${spinPx}px Bangers, cursive`;
      ctx.fillStyle = reaction.bust ? "#e85a45" : "#f0b429";
      strokeFillText(ctx, label, padX, padTop);
    }

    const scoreText = formatValue(scoreN);
    const hitsText = String(hitsN);
    ctx.font = `700 ${statsPx}px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillStyle = "#f0b429";
    const statsY = h - padBottom - statsPx;
    strokeFillText(ctx, scoreText, padX, statsY);

    const scoreW = ctx.measureText(scoreText).width;
    const gap = Math.round(statsPx * 0.55);
    const iconSize = Math.round(statsPx * 0.95);
    const iconX = padX + scoreW + gap;
    const iconY = statsY + Math.round((statsPx - iconSize) / 2);
    drawGoldHitsIcon(ctx, iconX, iconY, iconSize);
    const hitsX = iconX + iconSize + Math.round(statsPx * 0.22);
    strokeFillText(ctx, hitsText, hitsX, statsY);
    ctx.restore();
  }

  /**
   * Live clip frames must stay light — banner-native export size made mobile
   * capture so slow that reactions collapsed to a single still (no 0.5× flash).
   */
  function getReactionCaptureSize(srcW, srcH) {
    let w = Math.max(1, Math.round(srcW || 640));
    let h = Math.max(1, Math.round(srcH || 480));
    // BBV mobile (blob iframe + Safari) needs tiny frames to keep 10fps viable
    const maxEdge = isLikelyMobileDevice() ? 480 : 960;
    const edge = Math.max(w, h);
    if (edge > maxEdge) {
      const scale = maxEdge / edge;
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }
    return { w, h };
  }

  function reactionClipFps() {
    return isLikelyMobileDevice() ? 6 : REACTION_CLIP_FPS;
  }

  async function waitForCameraFrame(timeoutMs = 2000) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (camera?.srcObject && camera.videoWidth > 0 && camera.readyState >= 2) {
        return true;
      }
      await waitMs(50);
    }
    return !!(camera?.srcObject && camera.videoWidth > 0);
  }

  function grabReactionFrameDataUrl() {
    if (!camera.srcObject) return null;
    if (!camera.videoWidth || !camera.videoHeight) return null;
    try {
      const crop = getReactionCoverCrop();
      const out = getReactionCaptureSize(crop.w, crop.h);
      if (captureCanvas.width !== out.w) captureCanvas.width = out.w;
      if (captureCanvas.height !== out.h) captureCanvas.height = out.h;
      const ctx = captureCanvas.getContext("2d");
      // Camera only — border is overlaid in CSS for display and stamped fresh on download.
      drawReactionCamera(ctx, out.w, out.h, crop);
      const quality = isLikelyMobileDevice() ? 0.62 : 0.92;
      return captureCanvas.toDataURL("image/jpeg", quality);
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  function formatClipTimestamp(frameIndex) {
    const ms = Math.round((Math.max(0, frameIndex) / REACTION_CLIP_FPS) * 1000);
    const sec = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${sec}.${tenths}s`;
  }

  function clipDurationLabel(frameCount) {
    const last = Math.max(0, frameCount - 1);
    return formatClipTimestamp(last);
  }

  function syncReactionCardThumbs(reaction) {
    if (!reaction || !reactionStrip) return;
    const url = reactionDisplayUrl(reaction);
    reactionStrip.querySelectorAll(".reaction-card").forEach((card) => {
      if (card._reaction !== reaction) return;
      const img = card.querySelector("img");
      if (img) img.src = url;
    });
  }

  function updatePipEl(pipEl, reaction) {
    if (!pipEl) return;
    const url = reactionDisplayUrl(reaction);
    if (!url || !reaction.frames?.length) {
      pipEl.hidden = true;
      pipEl.removeAttribute("src");
      return;
    }
    pipEl.hidden = false;
    pipEl.src = url;
  }

  /**
   * @param {{
   *   reaction: {dataUrl:string,frames?:string[],frameIndex?:number,selectedFrameIndex?:number},
   *   imgEl: HTMLImageElement,
   *   playBtn: HTMLButtonElement,
   *   scrubEl: HTMLInputElement,
   *   timeEl: HTMLElement,
   *   pipEl?: HTMLImageElement|null,
   *   hoverRoot?: HTMLElement|null,
   *   autoplayOnHover?: boolean,
   *   onFrameChange?: (url:string)=>void,
   * }} opts
   */
  function createClipPlayer({
    reaction,
    imgEl,
    playBtn,
    scrubEl,
    timeEl,
    pipEl,
    hoverRoot,
    autoplayOnHover = true,
    onFrameChange,
  }) {
    const frames = reaction?.frames || [];
    const last = Math.max(0, frames.length - 1);
    const interval = Math.round(1000 / REACTION_CLIP_FPS);
    let playing = false;
    let timer = null;
    let destroyed = false;
    let playhead = ensureSelectedFrameIndex(reaction);

    scrubEl.min = "0";
    scrubEl.max = String(last);
    scrubEl.step = "1";
    updatePipEl(pipEl, reaction);

    function renderTime(idx) {
      timeEl.textContent = `${formatClipTimestamp(idx)} / ${clipDurationLabel(frames.length)}`;
    }

    function showPlayhead(index) {
      if (destroyed || !frames.length) return "";
      playhead = Math.min(last, Math.max(0, index));
      const url = frames[playhead];
      imgEl.src = url;
      scrubEl.value = String(playhead);
      renderTime(playhead);
      onFrameChange?.(url, false);
      return url;
    }

    function stopTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function pause() {
      playing = false;
      stopTimer();
      playBtn.textContent = "▶";
      playBtn.setAttribute("aria-label", "Play");
    }

    /** Always starts at frame 0, plays through once, then stops on the last frame. */
    function play() {
      if (destroyed || frames.length < 2 || playing) return;
      showPlayhead(0);
      playing = true;
      playBtn.textContent = "❚❚";
      playBtn.setAttribute("aria-label", "Pause");
      const tick = () => {
        if (!playing || destroyed) return;
        if (playhead >= last) {
          pause();
          return;
        }
        showPlayhead(playhead + 1);
        timer = setTimeout(tick, interval);
      };
      timer = setTimeout(tick, interval);
    }

    function toggle() {
      if (playing) pause();
      else play();
    }

    function selectCurrentFrame() {
      const url = selectReactionFrame(reaction, playhead);
      updatePipEl(pipEl, reaction);
      syncReactionCardThumbs(reaction);
      return url;
    }

    // Start on the selected thumbnail frame
    showPlayhead(ensureSelectedFrameIndex(reaction));

    const onPlayClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    const onScrubInput = () => {
      pause();
      showPlayhead(Number(scrubEl.value));
    };
    const onEnter = () => play();
    const onLeave = () => {
      pause();
      // Return main view to the selected thumbnail frame
      showPlayhead(ensureSelectedFrameIndex(reaction));
    };

    playBtn.addEventListener("click", onPlayClick);
    scrubEl.addEventListener("input", onScrubInput);
    const hoverEnabled = autoplayOnHover && hoverRoot;
    if (hoverEnabled) {
      hoverRoot.addEventListener("mouseenter", onEnter);
      hoverRoot.addEventListener("mouseleave", onLeave);
    }

    return {
      play,
      pause,
      showPlayhead,
      selectCurrentFrame,
      getPlayhead: () => playhead,
      isPlaying: () => playing,
      destroy() {
        destroyed = true;
        pause();
        playBtn.removeEventListener("click", onPlayClick);
        scrubEl.removeEventListener("input", onScrubInput);
        if (hoverEnabled) {
          hoverRoot.removeEventListener("mouseenter", onEnter);
          hoverRoot.removeEventListener("mouseleave", onLeave);
        }
      },
    };
  }

  function buildClipPlayerMarkup(reaction) {
    const last = Math.max(0, (reaction.frames?.length || 1) - 1);
    const idx = ensureSelectedFrameIndex(reaction);
    return `
      <div class="clip-player" data-clip-root>
        <div class="clip-toolbar">
          <button type="button" class="clip-play" data-clip-play aria-label="Play">▶</button>
          <input
            type="range"
            class="clip-scrub"
            data-clip-scrub
            min="0"
            max="${last}"
            value="${idx}"
            aria-label="Scrub reaction frames"
          />
          <span class="clip-time" data-clip-time>${formatClipTimestamp(idx)} / ${clipDurationLabel(reaction.frames.length)}</span>
        </div>
        <button type="button" class="btn btn-select-frame" data-clip-select>Select Frame</button>
        <p class="clip-select-status" data-clip-status hidden>Frame selected</p>
      </div>
    `;
  }

  function bindClipPlayerIn(root, reaction, { hoverRoot, onFrameChange, onSelect } = {}) {
    const playBtn = root.querySelector("[data-clip-play]");
    const scrubEl = root.querySelector("[data-clip-scrub]");
    const timeEl = root.querySelector("[data-clip-time]");
    const selectBtn = root.querySelector("[data-clip-select]");
    const statusEl = root.querySelector("[data-clip-status]");
    const media = root.previousElementSibling?.classList?.contains("g-media")
      ? root.previousElementSibling
      : root.parentElement?.querySelector?.(".g-media");
    const imgEl = media?.querySelector?.("img.g-playback, img:not(.clip-pip)") || media?.querySelector?.("img");
    const pipEl = media?.querySelector?.(".clip-pip, [data-clip-pip]");
    if (!playBtn || !scrubEl || !timeEl || !imgEl) return null;

    const player = createClipPlayer({
      reaction,
      imgEl,
      playBtn,
      scrubEl,
      timeEl,
      pipEl,
      hoverRoot: hoverRoot || media || imgEl,
      onFrameChange,
    });

    selectBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      player.pause();
      const url = player.selectCurrentFrame();
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = "Frame selected";
        clearTimeout(selectBtn._statusTimer);
        selectBtn._statusTimer = setTimeout(() => {
          statusEl.hidden = true;
        }, 1200);
      }
      onSelect?.(url);
    });

    return player;
  }

  function prependReactionCard(reaction, name) {
    const dataUrl = reactionDisplayUrl(reaction);
    const card = document.createElement("article");
    card.className = "reaction-card" + (reaction.bust ? " is-bust" : "");
    card._reaction = reaction;
    card.innerHTML = `
      <div class="reaction-shot">
        <img src="${dataUrl}" alt="Reaction from ${escapeHtml(name)}" />
        ${reactionOverlayHtml(reaction)}
      </div>
      <div class="meta"><strong>${escapeHtml(reaction.label)}</strong>${escapeHtml(name)}</div>
    `;
    card.addEventListener("click", () => {
      openReactionPreview(reaction, `${name}-reaction.png`);
    });
    reactionStrip.prepend(card);
    reactionFocusIndex = 0;
    layoutReactionsStack();
  }

  function scheduleStillReaction({ bust, label, name, score, hits }) {
    return new Promise((resolve) => {
      if (reactionTimer) clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => {
        captureReaction({ bust, label, name, score, hits });
        reactionTimer = null;
        reactionCapturePromise = null;
        resolve();
      }, REACTION_DELAY_MS);
    });
  }

  function pickAudioRecorderMimeType() {
    // iOS Safari: mp4/aac only — webm-first caused mic capture to fail on mobile
    const types = isLikelyMobileDevice()
      ? ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    if (typeof MediaRecorder === "undefined") return "";
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  /** Parallel mic capture for the reaction clip window (same timeline as frames). */
  function startReactionMicRecorder() {
    if (!micAvailable || !micTrack || micTrack.readyState === "ended") return null;
    if (typeof MediaRecorder === "undefined") return null;
    try {
      const stream = new MediaStream([micTrack]);
      const mimeType = pickAudioRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const stopped = new Promise((resolve) => {
        recorder.onstop = () => {
          if (!chunks.length) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, {
            type: recorder.mimeType || chunks[0].type || "audio/webm",
          });
          resolve(blob.size ? blob : null);
        };
        recorder.onerror = () => resolve(null);
      });
      recorder.start(100);
      return {
        stop() {
          if (recorder.state === "recording" || recorder.state === "paused") {
            try {
              recorder.requestData();
            } catch (_) {
              /* ignore */
            }
            try {
              recorder.stop();
            } catch (_) {
              return Promise.resolve(null);
            }
            return stopped;
          }
          return Promise.resolve(null);
        },
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async function captureReactionClip({ bust, label, name, score, hits, untilPromise }) {
    if (!camera.srcObject) return;
    await waitForCameraFrame();
    const frames = [];
    const fps = reactionClipFps();
    const interval = Math.round(1000 / fps);
    const started = performance.now();
    let stop = false;
    const markStop = () => {
      stop = true;
    };
    if (untilPromise && typeof untilPromise.then === "function") {
      untilPromise.then(markStop, markStop);
    } else {
      setTimeout(markStop, REACTION_CLIP_MS);
    }

    // Keep grabbing briefly after overlay ends so a slow first frame doesn't yield a "still"
    const minFrames = Math.max(4, Math.ceil((REACTION_CLIP_MS / 1000) * fps * 0.5));
    const minMs = Math.round(REACTION_CLIP_MS * 0.6);

    const micRec = startReactionMicRecorder();
    let audioBlob = null;
    try {
      // Capture from Fire!/bust start until the overlay clip ends (with a short floor)
      while (performance.now() - started < REACTION_CLIP_MAX_MS) {
        const frame = grabReactionFrameDataUrl();
        if (frame) frames.push(frame);
        const elapsed = performance.now() - started;
        if (stop && frames.length >= minFrames && elapsed >= minMs) break;
        if (stop && elapsed >= REACTION_CLIP_MS) break;
        await waitMs(interval);
      }
      const last = grabReactionFrameDataUrl();
      if (last) frames.push(last);
    } finally {
      if (micRec) audioBlob = await micRec.stop();
    }

    if (frames.length < 2) return;

    const flashTrim = audioBlob
      ? await analyzeReactionAudioSpike(audioBlob, frames.length)
      : null;

    let selectedFrameIndex = Math.min(frames.length - 1, Math.floor(frames.length / 2));
    // Prefer a still from the cheer region when we found one
    if (flashTrim) {
      selectedFrameIndex = Math.min(
        frames.length - 1,
        Math.floor((flashTrim.startFrame + flashTrim.endFrame) / 2)
      );
    }
    const dataUrl = frames[selectedFrameIndex];
    const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
    const reaction = {
      dataUrl,
      frames,
      frameIndex: selectedFrameIndex,
      selectedFrameIndex,
      isClip: true,
      label,
      bust,
      score,
      hits,
      audioBlob: audioBlob || null,
      audioUrl,
      flashTrim,
    };
    const player = players[currentPlayer];
    if (player) {
      player.reactions.push(reaction);
    }
    prependReactionCard(reaction, name);
    // PNG only here — video encode must wait until after the post-fire flash
    warmReactionPngExport(reaction);
  }

  function captureReaction({ bust, label, name, score, hits }) {
    const dataUrl = grabReactionFrameDataUrl();
    if (!dataUrl) return;

    const reaction = { dataUrl, label, bust, score, hits };
    const player = players[currentPlayer];
    if (player) {
      player.reactions.push(reaction);
    }
    prependReactionCard(reaction, name);
    warmReactionPngExport(reaction);
  }

  function ensureSelectedFrameIndex(reaction) {
    if (!reaction?.frames?.length) return 0;
    const last = reaction.frames.length - 1;
    if (reaction.selectedFrameIndex == null) {
      reaction.selectedFrameIndex = Math.min(
        last,
        Math.max(0, reaction.frameIndex ?? Math.floor(last / 2))
      );
    }
    reaction.selectedFrameIndex = Math.min(last, Math.max(0, reaction.selectedFrameIndex));
    reaction.frameIndex = reaction.selectedFrameIndex;
    reaction.dataUrl = reaction.frames[reaction.selectedFrameIndex];
    return reaction.selectedFrameIndex;
  }

  function reactionDisplayUrl(reaction) {
    if (!reaction) return "";
    if (reaction.frames?.length) {
      const idx = ensureSelectedFrameIndex(reaction);
      return reaction.frames[idx] || reaction.dataUrl;
    }
    return reaction.dataUrl;
  }

  function selectReactionFrame(reaction, index) {
    if (!reaction?.frames?.length) return reaction?.dataUrl || "";
    const idx = Math.min(reaction.frames.length - 1, Math.max(0, index));
    reaction.selectedFrameIndex = idx;
    reaction.frameIndex = idx;
    reaction.dataUrl = reaction.frames[idx];
    // Selected still changed — drop cached PNG so the next save matches
    reaction._exportPngBlob = null;
    reaction._exportPngPromise = null;
    warmReactionPngExport(reaction);
    return reaction.dataUrl;
  }

  function setReactionFrame(reaction, index) {
    // Back-compat alias used by favorite picking — locks the selected thumbnail
    return selectReactionFrame(reaction, index);
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function pngDownloadName(filename) {
    return String(filename || "reaction.png").replace(/\.(jpg|jpeg|webp)$/i, ".png");
  }

  /** Avoid overwrite prompts — stamp every save with a unique date/time suffix. */
  function uniqueDownloadName(filename) {
    const raw = String(filename || "reaction.bin");
    const m = /\.([a-z0-9]+)$/i.exec(raw);
    const ext = m ? `.${m[1].toLowerCase()}` : "";
    const stemRaw = ext ? raw.slice(0, -ext.length) : raw;
    const stem =
      stemRaw
        .replace(/[^a-z0-9._-]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "reaction";
    const d = new Date();
    const p = (n, w = 2) => String(n).padStart(w, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(
      d.getMinutes()
    )}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
    return `${stem}-${stamp}${ext}`;
  }

  function mimeFromFilename(filename) {
    const name = String(filename || "").toLowerCase();
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".webp")) return "image/webp";
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".webm")) return "video/webm";
    return "application/octet-stream";
  }

  function isLikelyMobileDevice() {
    return (
      window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "")
    );
  }

  function isEmbeddedFrame() {
    try {
      return !!(window.parent && window.parent !== window);
    } catch (_) {
      return true;
    }
  }

  /**
   * Blob-URL game shells (BBV iframe) can't reliably use <a download>.
   * Hand the file to the host page when embedded.
   */
  function requestHostDownload(payload) {
    try {
      if (!isEmbeddedFrame()) return false;
      window.parent.postMessage(
        { source: "turkey-trouble", type: "download", ...payload },
        "*",
        payload.buffer ? [payload.buffer] : []
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function triggerAnchorDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => resolve(blob), type, quality);
        return;
      }
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        resolve(dataUrlToBlob(dataUrl));
      } catch (_) {
        resolve(null);
      }
    });
  }

  function dataUrlToBlob(dataUrl) {
    try {
      const parts = String(dataUrl).split(",");
      const header = parts[0] || "";
      const b64 = parts[1] || "";
      const mime = /data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (_) {
      return null;
    }
  }

  function filesFromSaveEntries(entries) {
    return entries.map(({ blob, filename }) => {
      const name = String(filename || "reaction.bin");
      const type = blob.type || mimeFromFilename(name);
      return new File([blob], name, { type });
    });
  }

  async function tryShareFiles(entries) {
    if (typeof navigator.share !== "function" || typeof File === "undefined") {
      return false;
    }
    const files = filesFromSaveEntries(entries);
    if (!files.length) return false;
    const data = { files, title: "Turkey Trouble" };
    try {
      if (typeof navigator.canShare === "function" && !navigator.canShare(data)) {
        return false;
      }
    } catch (_) {
      return false;
    }
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      // Real user cancel. In iframes (BBV) WebKit sometimes AbortErrors without a
      // sheet after a lost tap gesture — return false so host download can run.
      if (err && err.name === "AbortError") return !isEmbeddedFrame();
      return false;
    }
  }

  /** Shrink big PNGs before postMessage — large transfers flake out in mobile iframes. */
  async function blobForHostTransfer(blob, filename) {
    const name = String(filename || "reaction.bin");
    if (!blob) return { blob, filename: name };
    const mime = blob.type || mimeFromFilename(name);
    if (!/^image\//.test(mime)) return { blob, filename: name };
    // Small enough — keep as-is (preserves PNG border crispness)
    if (blob.size < 1_250_000) return { blob, filename: name };
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      if (typeof bitmap.close === "function") bitmap.close();
      const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
      if (jpeg && jpeg.size && jpeg.size < blob.size) {
        return {
          blob: jpeg,
          filename: name.replace(/\.png$/i, ".jpg"),
        };
      }
    } catch (_) {
      /* keep original */
    }
    return { blob, filename: name };
  }

  function savePickerTypesFor(filename, mime) {
    const extMatch = /\.[a-z0-9]+$/i.exec(filename || "");
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const type = mime || mimeFromFilename(filename);
    return [
      {
        description: "Reaction file",
        accept: { [type]: ext ? [ext] : [".bin"] },
      },
    ];
  }

  /**
   * Open Finder/Explorer immediately (must run in the click gesture).
   * Returns { handle, filename }, { cancelled: true }, or null if unsupported.
   */
  async function reserveDesktopSave(filename) {
    if (isLikelyMobileDevice()) return null;
    if (typeof window.showSaveFilePicker !== "function") return null;
    const name = uniqueDownloadName(filename);
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: savePickerTypesFor(name),
      });
      return { handle, filename: name };
    } catch (err) {
      if (err && err.name === "AbortError") return { cancelled: true };
      return null;
    }
  }

  async function writeBlobToFileHandle(handle, blob) {
    if (!handle || !blob) return false;
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  }

  async function trySaveFilePicker(entries) {
    if (typeof window.showSaveFilePicker !== "function") return false;
    if (isLikelyMobileDevice()) return false;
    if (!entries?.length) return false;
    try {
      for (const { blob, filename } of entries) {
        const name = String(filename || "reaction.bin");
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: savePickerTypesFor(name, blob.type),
        });
        await writeBlobToFileHandle(handle, blob);
      }
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true;
      return false;
    }
  }

  async function trySaveToDirectory(entries) {
    if (typeof window.showDirectoryPicker !== "function") return false;
    if (isLikelyMobileDevice()) return false;
    if (!entries?.length) return false;
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      for (const { blob, filename } of entries) {
        const name = String(filename || uniqueDownloadName("reaction.bin"));
        const fileHandle = await dir.getFileHandle(name, { create: true });
        await writeBlobToFileHandle(fileHandle, blob);
      }
      return true;
    } catch (err) {
      if (err && err.name === "AbortError") return true;
      return false;
    }
  }

  async function tryHostDownloadEntries(entries) {
    if (!isEmbeddedFrame() || !entries.length) return false;
    try {
      const prepared = [];
      for (const entry of entries) {
        prepared.push(await blobForHostTransfer(entry.blob, entry.filename));
      }
      if (prepared.length === 1) {
        const { blob, filename } = prepared[0];
        const buffer = await blob.arrayBuffer();
        return requestHostDownload({
          filename,
          mime: blob.type || mimeFromFilename(filename),
          buffer,
        });
      }
      for (const { blob, filename } of prepared) {
        const buffer = await blob.arrayBuffer();
        requestHostDownload({
          filename,
          mime: blob.type || mimeFromFilename(filename),
          buffer,
        });
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Mobile standalone → share sheet.
   * Mobile BBV iframe → host download first (share is flaky after async image render).
   * Desktop → Finder/Explorer (single file) or folder picker (batch). Never Share.
   * @param {{ blob: Blob, filename: string }[]} entries
   */
  async function saveFilesToDevice(entries) {
    const list = (entries || [])
      .filter((e) => e?.blob)
      .map((e) => ({
        blob: e.blob,
        filename: uniqueDownloadName(e.filename),
      }));
    if (!list.length) return;

    if (isLikelyMobileDevice()) {
      // Embedded shells: host is reliable; share often AbortErrors once the tap gesture is gone
      if (isEmbeddedFrame()) {
        if (await tryHostDownloadEntries(list)) return;
        if (await tryShareFiles(list)) return;
      } else {
        if (await tryShareFiles(list)) return;
        if (await tryHostDownloadEntries(list)) return;
      }
      list.forEach(({ blob, filename }) => triggerAnchorDownload(blob, filename));
      return;
    }

    if (list.length > 1 && (await trySaveToDirectory(list))) return;
    if (list.length === 1 && (await trySaveFilePicker(list))) return;
    if (await tryHostDownloadEntries(list)) return;
    list.forEach(({ blob, filename }) => triggerAnchorDownload(blob, filename));
  }

  async function saveBlobToDevice(blob, filename) {
    if (!blob) return;
    await saveFilesToDevice([{ blob, filename }]);
  }

  async function renderReactionPngBlob(reactionOrUrl) {
    const reaction =
      reactionOrUrl && typeof reactionOrUrl === "object"
        ? reactionOrUrl
        : { dataUrl: reactionOrUrl };
    const dataUrl = reactionDisplayUrl(reaction) || reaction.dataUrl;
    if (!dataUrl) return null;

    await ensureHitsIconLoaded();

    let img;
    try {
      img = await loadImageFromUrl(dataUrl);
    } catch (_) {
      return dataUrlToBlob(dataUrl);
    }

    const srcW = img.naturalWidth || 640;
    const srcH = img.naturalHeight || 480;
    const banner = getBannerEl();
    // Prefer the border PNG’s native pixel grid so the frame stays crisp.
    let outW;
    let outH;
    if (banner?.naturalWidth && banner?.naturalHeight) {
      outW = banner.naturalWidth;
      outH = banner.naturalHeight;
    } else {
      const sized = getReactionOutputSize(srcW, srcH);
      outW = sized.w;
      outH = sized.h;
    }
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    drawImageCover(ctx, img, outW, outH);
    // Stamp the original PNG last so JPEG camera compression never touches the border.
    stampBannerOnCanvas(ctx, outW, outH);
    stampReactionHudOnCanvas(ctx, outW, outH, reaction);
    return (await canvasToBlob(canvas, "image/png")) || dataUrlToBlob(canvas.toDataURL("image/png"));
  }

  function warmReactionPngExport(reaction) {
    if (!reaction || reaction._exportPngBlob || reaction._exportPngPromise) return;
    reaction._exportPngPromise = renderReactionPngBlob(reaction)
      .then((blob) => {
        if (blob) reaction._exportPngBlob = blob;
        return blob;
      })
      .catch(() => null)
      .finally(() => {
        reaction._exportPngPromise = null;
      });
  }

  /**
   * Video encode is realtime + MediaRecorder — starting it right after capture
   * starved the post-fire 0.5× flash on mobile. Only warm once flash/overlays
   * are idle.
   */
  function deferWarmReactionVideoExport(reaction, delayMs = 400) {
    if (!reactionHasClip(reaction)) return;
    if (reaction._exportVideoBlob || reaction._exportVideoPromise) return;
    if (reaction._exportVideoWarmTimer) {
      clearTimeout(reaction._exportVideoWarmTimer);
      reaction._exportVideoWarmTimer = null;
    }

    const tryWarm = () => {
      reaction._exportVideoWarmTimer = null;
      if (reaction._exportVideoBlob || reaction._exportVideoPromise) return;
      if (reactionFlashPlaying || isOverlayClipPlaying()) {
        reaction._exportVideoWarmTimer = setTimeout(tryWarm, 500);
        return;
      }
      warmReactionVideoExport(reaction);
    };

    reaction._exportVideoWarmTimer = setTimeout(tryWarm, Math.max(0, delayMs));
  }

  function warmReactionExports(reaction) {
    if (!reaction) return;
    warmReactionPngExport(reaction);
    deferWarmReactionVideoExport(reaction);
  }

  async function getReactionPngExport(reactionOrUrl) {
    const reaction =
      reactionOrUrl && typeof reactionOrUrl === "object" ? reactionOrUrl : null;
    if (reaction?._exportPngBlob) return reaction._exportPngBlob;
    if (reaction?._exportPngPromise) {
      const warmed = await reaction._exportPngPromise;
      if (warmed) return warmed;
    }
    const blob = await renderReactionPngBlob(reactionOrUrl);
    if (blob && reaction) reaction._exportPngBlob = blob;
    return blob;
  }

  async function downloadReactionWithBanner(reactionOrUrl, filename) {
    const name = pngDownloadName(filename);
    // Desktop: open Finder/Explorer on the click, before async render loses the gesture
    const desktop = await reserveDesktopSave(name);
    if (desktop?.cancelled) return;

    // Keep warm moving so a second tap (or this await) is more likely to hit cache
    if (reactionOrUrl && typeof reactionOrUrl === "object") {
      warmReactionPngExport(reactionOrUrl);
    }

    const blob = await getReactionPngExport(reactionOrUrl);
    if (!blob) return;

    if (desktop?.handle) {
      await writeBlobToFileHandle(desktop.handle, blob);
      return;
    }
    await saveBlobToDevice(blob, desktop?.filename || name);
  }

  function pickRecorderMimeType(withAudio = false) {
    const types = withAudio
      ? [
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
        ]
      : [
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
    if (typeof MediaRecorder === "undefined") return "";
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function reactionHasClip(reaction) {
    return Array.isArray(reaction?.frames) && reaction.frames.length > 1;
  }

  function showVideoDownloadControls() {
    return isReactionVideoMode();
  }

  async function reactionAudioBlob(reaction) {
    if (reaction?.audioBlob instanceof Blob && reaction.audioBlob.size) {
      return reaction.audioBlob;
    }
    if (!reaction?.audioUrl) return null;
    try {
      const res = await fetch(reaction.audioUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return blob.size ? blob : null;
    } catch (_) {
      return null;
    }
  }

  /** Decode mic take into a MediaStream track (no speaker playback). */
  async function createExportAudioFeed(audioBlob) {
    if (!audioBlob) return null;
    try {
      ensureAudio();
      if (!audioCtx) return null;
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const raw = await audioBlob.arrayBuffer();
      const buffer = await audioCtx.decodeAudioData(raw.slice(0));
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);
      const track = dest.stream.getAudioTracks()[0] || null;
      if (!track) return null;
      return {
        track,
        start() {
          try {
            source.start(0);
          } catch (_) {
            /* already started */
          }
        },
        stop() {
          try {
            source.stop();
          } catch (_) {
            /* ignore */
          }
          try {
            source.disconnect();
          } catch (_) {
            /* ignore */
          }
          dest.stream.getTracks().forEach((t) => t.stop());
        },
      };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  /**
   * Encode reaction frames (+ mic audio when present) to a downloadable video blob.
   * @returns {Promise<{ blob: Blob, ext: string, mime: string } | null>}
   */
  async function buildReactionVideoBlob(reaction) {
    const frames = reaction?.frames?.length ? reaction.frames : null;
    if (!frames?.length) return null;
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
      return null;
    }

    await ensureHitsIconLoaded();
    const first = await loadImageFromUrl(frames[0]);
    const banner = getBannerEl();
    const srcW = first.naturalWidth || 640;
    const srcH = first.naturalHeight || 480;
    let outW;
    let outH;
    if (banner?.naturalWidth && banner?.naturalHeight) {
      outW = banner.naturalWidth;
      outH = banner.naturalHeight;
    } else {
      const sized = getReactionOutputSize(srcW, srcH);
      outW = sized.w;
      outH = sized.h;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    const videoStream = canvas.captureStream(REACTION_CLIP_FPS);

    const audioBlob = await reactionAudioBlob(reaction);
    const audioFeed = await createExportAudioFeed(audioBlob);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioFeed?.track) tracks.push(audioFeed.track);
    const stream = new MediaStream(tracks);

    const mimeType = pickRecorderMimeType(!!audioFeed?.track);
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 })
      : new MediaRecorder(stream, { videoBitsPerSecond: 12000000 });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    const paintFrame = (frameImg) => {
      ctx.clearRect(0, 0, outW, outH);
      drawImageCover(ctx, frameImg, outW, outH);
      stampBannerOnCanvas(ctx, outW, outH);
      stampReactionHudOnCanvas(ctx, outW, outH, reaction);
    };

    paintFrame(first);
    audioFeed?.start();
    recorder.start(100);

    const frameDelay = Math.round(1000 / REACTION_CLIP_FPS);
    try {
      for (let i = 1; i < frames.length; i += 1) {
        await waitMs(frameDelay);
        const frameImg = await loadImageFromUrl(frames[i]);
        paintFrame(frameImg);
      }
      await waitMs(frameDelay);
    } finally {
      try {
        recorder.stop();
      } catch (_) {
        /* ignore */
      }
      audioFeed?.stop();
      stream.getTracks().forEach((t) => t.stop());
      videoStream.getTracks().forEach((t) => t.stop());
    }
    await stopped;

    if (!chunks.length) return null;
    const mime = recorder.mimeType || mimeType || "video/webm";
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    return { blob: new Blob(chunks, { type: mime }), ext, mime };
  }

  /** Pre-encode so mobile share can open on the download tap (gesture still valid). */
  function warmReactionVideoExport(reaction) {
    if (!reactionHasClip(reaction)) return;
    if (reaction._exportVideoBlob || reaction._exportVideoPromise) return;
    reaction._exportVideoPromise = buildReactionVideoBlob(reaction)
      .then((built) => {
        if (built?.blob) {
          reaction._exportVideoBlob = built.blob;
          reaction._exportVideoExt = built.ext;
          reaction._exportVideoMime = built.mime;
        }
        return built;
      })
      .catch((err) => {
        console.error(err);
        return null;
      })
      .finally(() => {
        reaction._exportVideoPromise = null;
      });
  }

  async function getReactionVideoExport(reaction) {
    if (reaction?._exportVideoBlob) {
      return {
        blob: reaction._exportVideoBlob,
        ext: reaction._exportVideoExt || "webm",
        mime: reaction._exportVideoMime || reaction._exportVideoBlob.type,
      };
    }
    if (reaction?._exportVideoPromise) {
      const built = await reaction._exportVideoPromise;
      if (built?.blob) return built;
    }
    const built = await buildReactionVideoBlob(reaction);
    if (built?.blob && reaction) {
      reaction._exportVideoBlob = built.blob;
      reaction._exportVideoExt = built.ext;
      reaction._exportVideoMime = built.mime;
    }
    return built;
  }

  async function downloadReactionVideo(reaction, filename) {
    const frames = reaction?.frames?.length ? reaction.frames : null;
    if (!frames?.length) {
      await downloadReactionWithBanner(reaction, filename.replace(/\.(webm|mp4)$/i, ".png"));
      return;
    }

    const base = String(filename || "reaction").replace(/\.(jpg|jpeg|png|webm|mp4)$/i, "");
    const mimeGuess = pickRecorderMimeType(true);
    const extGuess = mimeGuess.includes("mp4") ? "mp4" : "webm";
    // Desktop: pick save location immediately so encode doesn't fall back to auto-download
    const desktop = await reserveDesktopSave(`${base}.${extGuess}`);
    if (desktop?.cancelled) return;

    const built = await getReactionVideoExport(reaction);
    if (!built?.blob) {
      if (desktop?.handle) {
        // User already chose a video path — fall back to a still via a fresh image save
        await downloadReactionWithBanner(reaction, `${base}.png`);
        return;
      }
      await downloadReactionWithBanner(reaction, filename.replace(/\.(webm|mp4)$/i, ".png"));
      return;
    }

    if (desktop?.handle) {
      await writeBlobToFileHandle(desktop.handle, built.blob);
      return;
    }
    await saveBlobToDevice(built.blob, desktop?.filename || `${base}.${built.ext || extGuess}`);
  }

  function syncPreviewDownloadButtons() {
    if (previewDownloadVideo) previewDownloadVideo.hidden = !showVideoDownloadControls();
  }

  const DL_IMAGE_ICON = `<span class="dl-icon dl-icon-image" aria-hidden="true"></span>`;
  const DL_VIDEO_ICON = `<span class="dl-icon dl-icon-video" aria-hidden="true"></span>`;

  function openReactionPreview(reactionOrUrl, filename) {
    // Available anytime except mid-spin (stacks over end-turn gallery)
    if (spinning) return;

    if (previewClipPlayer) {
      previewClipPlayer.destroy();
      previewClipPlayer = null;
    }

    const reaction =
      reactionOrUrl && typeof reactionOrUrl === "object"
        ? reactionOrUrl
        : { dataUrl: reactionOrUrl, label: "", bust: false };
    previewReaction = reaction;
    previewDataUrl = reactionDisplayUrl(reaction);
    previewFilename = pngDownloadName(filename || "reaction.png");
    previewImage.src = previewDataUrl;
    syncPreviewReactionHud(reaction);
    if (previewSelectStatus) previewSelectStatus.hidden = true;

    const hasClip = reactionHasClip(reaction);
    if (previewClip) previewClip.hidden = !hasClip;
    if (previewPip) {
      if (hasClip) updatePipEl(previewPip, reaction);
      else {
        previewPip.hidden = true;
        previewPip.removeAttribute("src");
      }
    }
    syncPreviewDownloadButtons();
    warmReactionExports(reaction);
    if (hasClip && previewPlay && previewScrub && previewTime) {
      previewClipPlayer = createClipPlayer({
        reaction,
        imgEl: previewImage,
        playBtn: previewPlay,
        scrubEl: previewScrub,
        timeEl: previewTime,
        pipEl: previewPip,
        hoverRoot: null,
        autoplayOnHover: false,
        onFrameChange: () => {
          // playhead changes don't change the selected thumbnail / download target
          previewDataUrl = reactionDisplayUrl(reaction);
        },
      });
    }

    previewModal.hidden = false;
  }

  function closeReactionPreview() {
    if (previewClipPlayer) {
      previewClipPlayer.destroy();
      previewClipPlayer = null;
    }
    previewReaction = null;
    previewModal.hidden = true;
    previewImage.removeAttribute("src");
    previewDataUrl = "";
    syncPreviewReactionHud(null);
    if (previewClip) previewClip.hidden = true;
    if (previewSelectStatus) previewSelectStatus.hidden = true;
    if (previewPip) {
      previewPip.hidden = true;
      previewPip.removeAttribute("src");
    }
  }

  async function bankPoints() {
    if (!awaitingChoice || spinning || turnOver || tileRevealInProgress) return;
    const bankedAmount = turnScore;
    players[currentPlayer].banked += bankedAmount;
    considerHighScore(
      players[currentPlayer].name,
      players[currentPlayer].banked,
      players[currentPlayer].hits
    );
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

  async function downloadDataUrl(dataUrl, filename) {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return;
    await saveBlobToDevice(blob, filename || "reaction.png");
  }

  function closeModal() {
    stopResultFanfare();
    modalBody.querySelectorAll("[data-clip-root]").forEach((node) => {
      node._clipPlayer?.destroy?.();
    });
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
    clearCameraReactionHud();
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
      paintScoreDials(0);
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

    // Capture end-of-turn banked totals (solo + multi) for the persistent high score
    considerHighScore(player.name, player.banked, player.hits);
    renderHighScore();

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

    // Solo game over with $0 across all rounds → no-winner comedy.
    // Otherwise end-of-turn: podium if cash bagged this turn, comedy/boo if Turkey Tom.
    if (!multi && isLastPlayerTurn() && player.banked <= 0) {
      playNoWinnerComedy();
    } else {
      playEndTurnResultSound(reason);
    }
  }

  function renderGalleryBody(player) {
    modalBody.classList.remove("is-winner");
    const multi = isMultiplayer();
    const entries = getGalleryEntries(player);
    if (!entries.length) {
      modalBody.innerHTML = `<p class="modal-subtitle">No reaction photos this turn.</p>`;
      return;
    }

    // Tear down any prior clip players attached to gallery items
    modalBody.querySelectorAll("[data-clip-root]").forEach((node) => {
      node._clipPlayer?.destroy?.();
    });

    modalBody.innerHTML = "";
    entries.forEach((r, i) => {
      warmReactionExports(r);
      const filename = `${player.name}-reaction-${i + 1}.png`;
      const hasClip = reactionHasClip(r);
      const showVideoDl = showVideoDownloadControls();
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
          <img class="g-playback" src="${currentUrl}" alt="Reaction ${i + 1}" />
          ${reactionOverlayHtml(r)}
          ${
            hasClip
              ? `<img class="clip-pip" data-clip-pip src="${currentUrl}" alt="Selected frame" />`
              : ""
          }
          <div class="dl-actions">
            <button type="button" class="dl-circle" data-dl="image" aria-label="Save image to camera roll" title="Save image">${DL_IMAGE_ICON}</button>
            ${
              showVideoDl
                ? `<button type="button" class="dl-circle" data-dl="video" aria-label="Save video to camera roll" title="Save video">${DL_VIDEO_ICON}</button>`
                : ""
            }
          </div>
        </div>
        ${hasClip ? buildClipPlayerMarkup(r) : ""}
        <div class="g-meta"><strong>${escapeHtml(r.label)}</strong>${r.bust ? "Bust" : r.isPriorFavorite ? "Saved" : "Hit"}</div>
      `;
      const img = item.querySelector("img.g-playback");
      const media = item.querySelector(".g-media");
      img.addEventListener("click", () => {
        openReactionPreview(r, filename);
      });
      if (hasClip) {
        const clipRoot = item.querySelector("[data-clip-root]");
        const clipPlayer = bindClipPlayerIn(clipRoot, r, {
          hoverRoot: media,
          onSelect: (url) => {
            if (multi && selectedFavoriteIndex === i) player.favorite = url;
          },
        });
        if (clipRoot) clipRoot._clipPlayer = clipPlayer;
      }
      if (multi) {
        item.querySelector(".fav-pick").addEventListener("click", (e) => {
          e.stopPropagation();
          selectedFavoriteIndex = i;
          if (r.frames?.length) selectReactionFrame(r, ensureSelectedFrameIndex(r));
          renderGalleryBody(player);
          renderGalleryActions(player);
        });
      }
      item.querySelector('[data-dl="image"]')?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await downloadReactionWithBanner(r, filename);
      });
      item.querySelector('[data-dl="video"]')?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await downloadReactionVideo(r, `${player.name}-reaction-${i + 1}.webm`);
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
    dlAll.textContent = "Save All";
    dlAll.disabled = entries.length === 0;
    dlAll.addEventListener("click", async () => {
      const files = [];
      for (let i = 0; i < entries.length; i += 1) {
        const blob = await getReactionPngExport(entries[i]);
        if (blob) {
          files.push({
            blob,
            filename: `${player.name}-reaction-${i + 1}.png`,
          });
        }
      }
      await saveFilesToDevice(files);
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

  function appendEndGameButton() {
    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn btn-play-again";
    again.textContent = "End Game";
    again.addEventListener("click", () => {
      closeModal();
      returnToLobby();
    });
    modalActions.appendChild(again);
  }

  function shotsLabel(n) {
    const count = Math.max(0, n || 0);
    return `${count} ${count === 1 ? "shot" : "shots"}`;
  }

  /**
   * Dollar-amount tie → fewest hits wins. Hits also tied → dual winners.
   * Title stays put while subtitle cycles, then the reveal lands.
   */
  async function runCashTiebreaker(tiedPlayers, topScore, favMap) {
    const beat = (ms) =>
      waitMs(window.__tiebreakFast ? Math.max(350, Math.round(ms * 0.18)) : ms);

    modalTitle.classList.remove("is-fav-prompt");
    modalTitle.textContent = "THIS TIE MUST BE BROKEN";
    modalSubtitle.classList.add("is-tiebreak-cycle");
    modalSubtitle.textContent = `${tiedPlayers.map((p) => p.name).join(" & ")} — ${formatValue(topScore)}`;
    modalBody.innerHTML = "";
    modalActions.innerHTML = "";
    modalRoot.hidden = false;
    playPodiumApplause();

    // Each cycling line holds ~3s before the next
    await beat(3000);
    modalSubtitle.textContent =
      "The tiebreaker is awarded to the hunter who achieved this score in the fewest number of shots";
    await beat(3000);
    modalSubtitle.textContent = "And the winner is....";
    await beat(3000);

    const byShots = [...tiedPlayers].sort(
      (a, b) => (a.hits || 0) - (b.hits || 0) || a.name.localeCompare(b.name)
    );
    const fewest = byShots[0].hits || 0;
    const shotWinners = byShots.filter((p) => (p.hits || 0) === fewest);

    modalSubtitle.classList.remove("is-tiebreak-cycle");

    if (shotWinners.length === 1) {
      const winner = shotWinners[0];
      const rivals = tiedPlayers.filter((p) => p !== winner);
      const photo = winnerPhotoFor(winner, favMap);
      modalTitle.textContent = "THIS TIE MUST BE BROKEN";
      modalSubtitle.textContent = `${winner.name}!`;
      modalBody.innerHTML = `
        ${
          photo
            ? `<img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(winner.name)}" />`
            : `<p class="modal-subtitle">No favorite photo saved.</p>`
        }
        <p class="tiebreak-compare">
          ${escapeHtml(winner.name)} sealed it in ${shotsLabel(winner.hits)}
          ${rivals
            .map(
              (r) =>
                ` · ${escapeHtml(r.name)} needed ${shotsLabel(r.hits)}`
            )
            .join("")}
        </p>
      `;
    } else {
      modalTitle.textContent = "WHAT? TIED AGAIN!";
      modalSubtitle.textContent = "I'm out of ideas at this point. You're both winners!";
      const slots = shotWinners
        .map((w) => {
          const photo = winnerPhotoFor(w, favMap);
          return `
            <figure class="winner-tie-slot">
              ${
                photo
                  ? `<img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(w.name)}" />`
                  : `<div class="winner-photo winner-photo-empty" aria-hidden="true"></div>`
              }
              <figcaption class="winner-caption">${escapeHtml(w.name)}</figcaption>
              <p class="tiebreak-dual-meta">${formatValue(topScore)} · ${shotsLabel(w.hits)}</p>
            </figure>
          `;
        })
        .join("");
      modalBody.innerHTML = `<div class="winner-photos">${slots}</div>`;
    }

    appendEndGameButton();
  }

  async function showWinner() {
    // Multiplayer only — solo ends on the results gallery
    considerPlayersForHighScore();
    renderHighScore();
    const topScore = Math.max(...players.map((p) => p.banked));
    const winners = players.filter((p) => p.banked === topScore);
    const favMap = loadFavoritesMap();

    modalBody.classList.add("is-winner");
    modalActions.innerHTML = "";
    modalSubtitle.classList.remove("is-tiebreak-cycle");

    if (topScore <= 0) {
      modalTitle.textContent = "Turkey Tom Wins";
      modalSubtitle.textContent = "Nobody bagged any cash";
      modalBody.innerHTML = `
        <img class="winner-photo winner-photo-tom" src="assets/turkey-tile.png" alt="Turkey Tom" />
      `;
      appendEndGameButton();
      modalRoot.hidden = false;
      playNoWinnerComedy();
      return;
    }

    if (winners.length > 1) {
      await runCashTiebreaker(winners, topScore, favMap);
      return;
    }

    const winner = winners[0];
    const photo = winnerPhotoFor(winner, favMap);
    modalTitle.textContent = `${winner.name} wins!`;
    modalSubtitle.textContent = formatValue(topScore);
    modalBody.innerHTML = photo
      ? `<img class="winner-photo" src="${photo}" alt="Winning reaction from ${escapeHtml(winner.name)}" />`
      : `<p class="modal-subtitle">No favorite photo saved.</p>`;
    appendEndGameButton();
    modalRoot.hidden = false;
    playPodiumApplause();
  }

  /** Dev helper — preview both tie endings without playing a full match. */
  window.__demoTieEndings = async function demoTieEndings(mode) {
    const placeholder = (label, hue) => {
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 360;
      const ctx = c.getContext("2d");
      ctx.fillStyle = `hsl(${hue} 42% 28%)`;
      ctx.fillRect(0, 0, 480, 360);
      ctx.fillStyle = "#f0b429";
      ctx.font = "bold 42px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, 240, 190);
      return c.toDataURL("image/jpeg", 0.85);
    };

    gameStarted = true;
    if (mode === "shots") {
      players = [
        { ...makeBlankPlayer("Austin"), banked: 12500, hits: 3, favorite: placeholder("Austin", 28) },
        { ...makeBlankPlayer("Sam"), banked: 12500, hits: 7, favorite: placeholder("Sam", 200) },
      ];
    } else {
      players = [
        { ...makeBlankPlayer("Austin"), banked: 12500, hits: 4, favorite: placeholder("Austin", 28) },
        { ...makeBlankPlayer("Sam"), banked: 12500, hits: 4, favorite: placeholder("Sam", 200) },
      ];
    }
    currentPlayer = 0;
    renderLeaderboard();
    await showWinner();
  };

  function returnToLobby() {
    gameStarted = false;
    multiPlayerMode = false;
    playersEditor.hidden = true;
    players = [makeBlankPlayer("Player 1")];
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = false;
    renamingActivePlayer = false;
    if (scoreLabelEdit) {
      scoreLabelEdit.remove();
      scoreLabelEdit = null;
    }
    scoreLabel.hidden = false;
    setTurnScore(0);
    scoreboard.classList.remove("is-multi-round");
    roundLabel.hidden = true;
    clearReactionStrip();
    clearCameraReactionHud();
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
      p.hits = 0;
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
    clearCameraReactionHud();
    hideBanner();
    buildBoard();
    setTurnScore(0);
    syncTurnHud();
    updateActionButton();
  }

  function collapsePlayersEditor() {
    multiPlayerMode = false;
    playersEditor.hidden = true;
    setupPanel.hidden = false;
    setupPanel.style.display = "";
    setupPanel.removeAttribute("aria-hidden");
    if (!gameStarted) {
      players = [makeBlankPlayer("Player 1")];
      currentPlayer = 0;
      setTurnScore(0);
      renderPlayerList();
    } else if (players.length === 0) {
      ensureActivePlayerSlot();
    }
    syncSetupButtons();
    syncTurnHud();
    renderLeaderboard();
  }

  function openPlayersEditor() {
    multiPlayerMode = true;
    cancelActivePlayerRename();
    players = [];
    currentPlayer = 0;
    playersEditor.hidden = false;
    setTurnScore(0);
    renderPlayerList();
    renderLeaderboard();
    syncSetupButtons();
    syncTurnHud();
    unlockLobbyMusic();
    playerNameInput.focus();
  }

  function setPlayMode(multi) {
    if (gameStarted) return;
    if (multi === multiPlayerMode && multi === !playersEditor.hidden) return;
    if (multi) openPlayersEditor();
    else collapsePlayersEditor();
  }

  function ensurePlayersForStart() {
    ensureActivePlayerSlot();
  }

  function beginGame() {
    ensurePlayersForStart();
    totalRounds = readTotalRounds();
    players.forEach((p) => {
      p.banked = 0;
      p.hits = 0;
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
    playersEditor.hidden = true;
    setupPanel.hidden = false;
    setupPanel.style.display = "";
    setupPanel.removeAttribute("aria-hidden");
    clearReactionStrip();
    buildBoard();
    setTurnScore(0);
    syncSetupButtons();
    syncTurnHud();
    renderLeaderboard();
    updateActionButton();
    unlockLobbyMusic();
  }

  function tryBeginFromStartButton() {
    beginGame();
  }

  function startGameFromSetup() {
    if (gameStarted) return;
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

  modeSingleBtn?.addEventListener("click", () => setPlayMode(false));
  modeMultiBtn?.addEventListener("click", () => setPlayMode(true));
  btnStartFromSetup.addEventListener("click", startGameFromSetup);
  reactionModeTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleReactionModeMenu();
  });
  reactionModeMenu?.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-reaction-mode]");
    if (!opt) return;
    setReactionMode(opt.getAttribute("data-reaction-mode"));
  });
  soundModeTrigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSoundModeMenu();
  });
  soundModeMenu?.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-sound-mode]");
    if (!opt) return;
    setSoundMode(opt.getAttribute("data-sound-mode"));
  });

  roundsTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    closeSoundModeMenu();
    closeReactionModeMenu();
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
    if (soundModePicker && !soundModePicker.contains(e.target)) closeSoundModeMenu();
    if (reactionModePicker && !reactionModePicker.contains(e.target)) closeReactionModeMenu();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Escape") return;
    if (!roundsMenu.hidden) {
      closeRoundsMenu();
      roundsTrigger.focus();
    }
    if (soundModeMenu && !soundModeMenu.hidden) {
      closeSoundModeMenu();
      soundModeTrigger?.focus();
    }
    if (reactionModeMenu && !reactionModeMenu.hidden) {
      closeReactionModeMenu();
      reactionModeTrigger?.focus();
    }
  });
  setSelectedRounds(1);
  syncSoundModeToggle();
  syncReactionModeToggle();

  addPlayerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;
    players.push(makeBlankPlayer(name));
    playerNameInput.value = "";
    renderPlayerList();
    syncSetupButtons();
    renderLeaderboard();
    syncTurnHud();
    playerNameInput.focus();
  });

  scoreLabel.addEventListener("click", beginActivePlayerRename);
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
  previewDownloadImage?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!previewReaction && !previewDataUrl) return;
    await downloadReactionWithBanner(
      previewReaction || { dataUrl: previewDataUrl },
      previewFilename || "reaction.png"
    );
  });
  previewDownloadVideo?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!previewReaction) return;
    const base = String(previewFilename || "reaction").replace(/\.(jpg|jpeg|png|webm|mp4)$/i, "");
    await downloadReactionVideo(previewReaction, `${base}.webm`);
  });
  previewSelectFrame?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!previewReaction?.frames?.length) return;
    previewClipPlayer?.pause();
    const url =
      previewClipPlayer?.selectCurrentFrame() ||
      selectReactionFrame(previewReaction, previewReaction.selectedFrameIndex ?? 0);
    previewDataUrl = url;
    previewImage.src = url;
    updatePipEl(previewPip, previewReaction);
    syncReactionCardThumbs(previewReaction);
    if (previewSelectStatus) {
      previewSelectStatus.hidden = false;
      previewSelectStatus.textContent = "Frame selected";
      clearTimeout(previewSelectFrame._statusTimer);
      previewSelectFrame._statusTimer = setTimeout(() => {
        previewSelectStatus.hidden = true;
      }, 1200);
    }
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
  const boardRow = document.querySelector(".board-row");
  const boardFrame = document.querySelector(".board-frame");
  const boardColumn = document.querySelector(".board-column");
  const reactionsPanel = document.querySelector(".reactions-panel");
  const stageEl = document.querySelector(".stage");

  function readCssPx(styles, prop) {
    const raw = styles.getPropertyValue(prop).trim();
    if (!raw) return 0;
    if (raw.endsWith("px")) return parseFloat(raw) || 0;
    if (raw.endsWith("rem")) {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return (parseFloat(raw) || 0) * root;
    }
    return parseFloat(raw) || 0;
  }

  function outerHeight(el) {
    if (!el || el.hidden) return 0;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.height + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0);
  }

  function fitPlayArea() {
    if (!boardRow || !board || !boardFrame) return;

    const rowStyles = getComputedStyle(boardRow);
    const bodyStyles = getComputedStyle(document.body);
    const frameStyles = getComputedStyle(boardFrame);

    const colGap = parseFloat(rowStyles.columnGap) || parseFloat(rowStyles.gap) || 0;
    const frameMarginY =
      (parseFloat(frameStyles.marginTop) || 0) + (parseFloat(frameStyles.marginBottom) || 0);
    const bodyPadBottom = parseFloat(bodyStyles.paddingBottom) || 0;
    const bodyPadX =
      (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
    const border = 6; // 3px left + 3px right
    const safety = 6;
    const horizontal = isReactionsHorizontal();
    const stageW = stageEl?.clientWidth || document.documentElement.clientWidth;
    const columnW = boardColumn?.clientWidth || stageW;
    // Prefer visualViewport — matches the iframe / iOS visible width the user actually sees
    const viewportW = window.visualViewport?.width || document.documentElement.clientWidth;
    const viewportH = window.visualViewport?.height || window.innerHeight;
    const usableViewportW = Math.max(160, viewportW - bodyPadX);
    const rowTop = boardRow.getBoundingClientRect().top;

    // Solve tile size against width + height with interdependent pad/gap/reactions width.
    let tileW = readCssPx(rowStyles, "--fit-tile-w") || 120;
    let gap = 8;
    let pad = 18;
    let boardInnerW = 480;

    function layoutGap(tw) {
      return Math.max(4.5, Math.min(8, tw * 0.04));
    }
    function layoutPad(tw) {
      const bulbR = Math.max(6, Math.min(12, tw * 0.045));
      const bulbClear = Math.max(5, Math.min(10, tw * 0.035));
      return Math.max(
        bulbR + bulbClear + 4,
        Math.max(10, Math.min(28, tw * 0.11))
      );
    }
    function boardWidthFor(tw, g) {
      return 4 * tw + 5 * g + border;
    }

    for (let i = 0; i < 6; i++) {
      gap = layoutGap(tileW);
      // Frame ring (lights + clearance outside board border) is locked to the board —
      // never shrink pad to chase edge-to-edge width; body padding handles that.
      pad = layoutPad(tileW);
      const reactionsW = horizontal
        ? 0
        : Math.min(240, Math.max(72, tileW * 0.92));
      const sideGutter = horizontal ? 0 : reactionsW + colGap;
      // Mobile: fit the light frame inside the visible viewport (iframe-safe), not just columnW.
      const availableFrameW = horizontal
        ? Math.max(160, Math.min(columnW, usableViewportW) - 4)
        : Math.max(160, stageW - 2 * sideGutter);
      const availableBoardW = Math.max(140, availableFrameW - 2 * pad);

      let reservedBelow =
        frameMarginY + 2 * pad + outerHeight(controls) + bodyPadBottom + safety;
      if (horizontal) {
        if (reactionsPanel) reservedBelow += outerHeight(reactionsPanel);
        if (leaderboard) reservedBelow += outerHeight(leaderboard);
      }
      const availableBoardH = Math.max(120, viewportH - rowTop - reservedBelow);

      const tileFromW = (availableBoardW - border - 5 * gap) / 4;
      const tileFromH = (availableBoardH - border - 5 * gap) / (4 * (3 / 5));
      // Floor mobile tile width so 4 tracks + gaps + border never exceed the frame budget.
      const next = horizontal
        ? Math.max(48, Math.floor(tileFromW * 100) / 100)
        : Math.max(48, Math.min(tileFromW, tileFromH));
      boardInnerW = boardWidthFor(next, layoutGap(next));
      if (Math.abs(next - tileW) < 0.25) {
        tileW = next;
        break;
      }
      tileW = next;
    }

    gap = layoutGap(tileW);
    pad = layoutPad(tileW);
    let bulbRadius = Math.max(6, Math.min(12, tileW * 0.045));
    let bulbClearance = Math.max(5, Math.min(10, tileW * 0.035));
    boardInnerW = boardWidthFor(tileW, gap);

    // Final mobile clamp: frame (board + pad ring) must fit the visible viewport.
    if (horizontal) {
      const maxFrameW = Math.max(160, Math.min(columnW, usableViewportW) - 4);
      let maxBoardW = Math.max(140, maxFrameW - 2 * pad);
      if (boardInnerW > maxBoardW) {
        tileW = Math.max(48, Math.floor(((maxBoardW - border - 5 * gap) / 4) * 100) / 100);
        gap = layoutGap(tileW);
        pad = layoutPad(tileW);
        bulbRadius = Math.max(6, Math.min(12, tileW * 0.045));
        bulbClearance = Math.max(5, Math.min(10, tileW * 0.035));
        boardInnerW = boardWidthFor(tileW, gap);
        maxBoardW = Math.max(140, maxFrameW - 2 * pad);
        if (boardInnerW > maxBoardW) {
          tileW = Math.max(48, Math.floor(((maxBoardW - border - 5 * gap) / 4) * 100) / 100);
          gap = layoutGap(tileW);
          pad = layoutPad(tileW);
          bulbRadius = Math.max(6, Math.min(12, tileW * 0.045));
          bulbClearance = Math.max(5, Math.min(10, tileW * 0.035));
          boardInnerW = boardWidthFor(tileW, gap);
        }
      }
    }
    const reactionsCol = Math.min(240, Math.max(72, tileW * 0.92));

    boardRow.style.setProperty("--fit-tile-w", `${tileW.toFixed(2)}px`);
    boardRow.style.setProperty("--gap", `${gap.toFixed(2)}px`);
    boardRow.style.setProperty("--board-inner-w", `${boardInnerW.toFixed(2)}px`);
    boardRow.style.setProperty("--board-pad", `${pad.toFixed(2)}px`);
    boardRow.style.setProperty("--bulb-radius", `${bulbRadius.toFixed(2)}px`);
    boardRow.style.setProperty("--bulb-clearance", `${bulbClearance.toFixed(2)}px`);
    if (!horizontal) {
      boardRow.style.setProperty("--reactions-col", `${reactionsCol.toFixed(2)}px`);
    }

    // Post-layout correction: if the frame still spills past the visible right edge, shrink once.
    if (horizontal) {
      void board.offsetWidth;
      const frameRight = boardFrame.getBoundingClientRect().right;
      const maxRight = viewportW - (parseFloat(bodyStyles.paddingRight) || 0) - 1;
      if (frameRight > maxRight + 0.5 && tileW > 48) {
        const overflow = frameRight - maxRight;
        const shrink = Math.min(overflow / 4, tileW - 48);
        tileW = Math.max(48, Math.floor((tileW - shrink) * 100) / 100);
        gap = layoutGap(tileW);
        pad = layoutPad(tileW);
        bulbRadius = Math.max(6, Math.min(12, tileW * 0.045));
        bulbClearance = Math.max(5, Math.min(10, tileW * 0.035));
        boardInnerW = boardWidthFor(tileW, gap);
        boardRow.style.setProperty("--fit-tile-w", `${tileW.toFixed(2)}px`);
        boardRow.style.setProperty("--gap", `${gap.toFixed(2)}px`);
        boardRow.style.setProperty("--board-inner-w", `${boardInnerW.toFixed(2)}px`);
        boardRow.style.setProperty("--board-pad", `${pad.toFixed(2)}px`);
        boardRow.style.setProperty("--bulb-radius", `${bulbRadius.toFixed(2)}px`);
        boardRow.style.setProperty("--bulb-clearance", `${bulbClearance.toFixed(2)}px`);
      }
    }

    // Lock camera overlay type to the clip window (1 unit = 1% of well width)
    const cameraWell = board.querySelector(".camera-well");
    if (cameraWell) {
      const wellW = cameraWell.clientWidth || 0;
      if (wellW > 0) {
        cameraWell.style.setProperty("--cam-u", `${(wellW / 100).toFixed(3)}px`);
      }
    }
  }

  let fitRaf = 0;
  function scheduleFitPlayArea() {
    if (fitRaf) cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0;
      // Two passes: pad/gap change with tile size, so remeasure once.
      fitPlayArea();
      fitPlayArea();
      layoutReactionsStack();
    });
  }

  const onReactionsLayoutChange = () => scheduleFitPlayArea();
  if (typeof reactionsLayoutQuery.addEventListener === "function") {
    reactionsLayoutQuery.addEventListener("change", onReactionsLayoutChange);
  } else {
    reactionsLayoutQuery.addListener(onReactionsLayoutChange);
  }
  window.addEventListener("resize", scheduleFitPlayArea);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleFitPlayArea);
  }
  if (typeof ResizeObserver === "function") {
    const chromeObserver = new ResizeObserver(() => scheduleFitPlayArea());
    if (stageEl) chromeObserver.observe(stageEl);
    if (setupPanel) chromeObserver.observe(setupPanel);
    if (turnHud) chromeObserver.observe(turnHud);
    const brandLogo = document.querySelector(".brand-logo");
    if (brandLogo) chromeObserver.observe(brandLogo);
  }
  scheduleFitPlayArea();
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
  ensureActivePlayerSlot();
  syncSetupButtons();
  syncTurnHud();
  paintScoreDials(0);
  renderLeaderboard();
  updateActionButton();
  startCamera();
  syncSoundModeToggle();
  syncReactionModeToggle();
  syncLobbyMusic();

  document.addEventListener(
    "pointerdown",
    () => {
      unlockLobbyMusic();
    },
    { once: true }
  );
  document.addEventListener("visibilitychange", syncLobbyMusic);

  /** Full AV stream from getUserMedia (video for preview; mic track kept for future features). */
  let mediaStream = null;
  /** @type {MediaStreamTrack|null} */
  let micTrack = null;
  let micAvailable = false;

  function attachCameraStream(stream, { hasMic }) {
    mediaStream = stream;
    micTrack = stream.getAudioTracks()[0] || null;
    micAvailable = !!(hasMic && micTrack && micTrack.readyState !== "ended");
    // Keep the <video> element muted so the mic isn't played back into the speakers.
    camera.muted = true;
    camera.srcObject = stream;
    cameraStatus.classList.add("is-hidden");
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = "Camera not supported in this browser.";
      return;
    }

    const videoConstraints = { facingMode: "user" };
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });
      attachCameraStream(stream, { hasMic: true });
    } catch (err) {
      console.error(err);
      // Mic denied / missing — still try camera so the game is playable.
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
        attachCameraStream(videoOnly, { hasMic: false });
        cameraStatus.classList.remove("is-hidden");
        cameraStatus.textContent =
          "Mic blocked — allow microphone access and reload for reaction audio.";
        setTimeout(() => cameraStatus.classList.add("is-hidden"), 4500);
      } catch (videoErr) {
        console.error(videoErr);
        cameraStatus.textContent =
          "Camera & mic permission needed — allow access and reload.";
      }
    }
  }
})();
