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
  const REACTION_DELAY_MS = 1500;
  /** Gunshot / feather-burst peak in turkey-trouble-fire.mp4 */
  const FIRE_GUNSHOT_MS = 150;
  const TILE_PULSE_MS = 550;
  const TILE_FLIP_MS = 450;
  const FAVORITES_KEY = "turkeyTroubleFavorites";

  const board = document.getElementById("board");
  const boardLights = document.getElementById("board-lights");
  const camera = document.getElementById("camera");
  const captureCanvas = document.getElementById("capture");
  const cameraStatus = document.getElementById("camera-status");
  const cameraWell = board.querySelector(".camera-well");
  const resultBanner = document.getElementById("result-banner");
  const turkeyBlast = document.getElementById("turkey-blast");
  const fireVideo = document.getElementById("fire-video");
  const bustVideo = document.getElementById("bust-video");
  const fireHit = document.getElementById("fire-hit");
  const turnHud = document.getElementById("turn-hud");
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
  const btnDonePlayers = document.getElementById("btn-done-players");
  const btnStartFromSetup = document.getElementById("btn-start-from-setup");
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
    const editorOpen = !playersEditor.hidden;
    btnDonePlayers.hidden = !(gameStarted && editorOpen);
    btnAddPlayers.hidden = editorOpen;
    btnStartFromSetup.hidden = gameStarted || !editorOpen;
  }

  function syncTurnHud() {
    turnHud.hidden = !gameStarted;
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
      // Start bust playback in the same click turn so audio/video unlock reliably
      const bustPromise = playTurkeyAnimation();
      finishTurnAfterTurkey(bustPromise);
      return;
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

  async function finishPrizeAfterFire(firePromise, landed) {
    await (firePromise || fireVideoPromise || Promise.resolve());
    if (turnOver) return;
    await playPrizeReveal(landed);
    if (turnOver) return;
    canAct = true;
    awaitingChoice = true;
    updateActionButton();
  }

  async function finishTurnAfterTurkey(bustPromise) {
    await (bustPromise || playTurkeyAnimation());
    const playerName = players[currentPlayer]?.name || "Player";
    captureReaction({
      bust: true,
      label: "Bust!",
      name: playerName,
    });
    await (reactionCapturePromise || Promise.resolve());
    openEndTurnGallery("turkey");
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
    card.addEventListener("click", () => {
      openReactionPreview(dataUrl, `${name}-reaction.jpg`);
    });
    reactionStrip.prepend(card);
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
    return players.every((p, i) => i === endTurnPlayerIndex || p.done);
  }

  function openEndTurnGallery(reason) {
    endTurnPlayerIndex = currentPlayer;
    const player = players[endTurnPlayerIndex];
    const multi = isMultiplayer();
    selectedFavoriteIndex = -1;

    if (multi) {
      modalTitle.textContent = "Pick your favorite photo to continue";
    } else {
      modalTitle.textContent = `${player.name}'s results`;
    }
    modalSubtitle.innerHTML = `<span class="end-turn-cash">${formatValue(player.banked)}</span>`;

    renderGalleryBody(player);
    renderGalleryActions(player);
    modalRoot.hidden = false;
  }

  function renderGalleryBody(player) {
    modalBody.classList.remove("is-winner");
    const multi = isMultiplayer();
    if (!player.reactions.length) {
      modalBody.innerHTML = `<p class="modal-subtitle">No reaction photos this turn.</p>`;
      return;
    }

    modalBody.innerHTML = "";
    player.reactions.forEach((r, i) => {
      const filename = `${player.name}-reaction-${i + 1}.jpg`;
      const item = document.createElement("div");
      item.className = "gallery-item" + (multi && i === selectedFavoriteIndex ? " is-selected" : "");
      item.innerHTML = `
        <div class="g-media">
          ${
            multi
              ? `<button type="button" class="fav-pick${i === selectedFavoriteIndex ? " is-on" : ""}" aria-label="Pick as favorite">★</button>`
              : ""
          }
          <img src="${r.dataUrl}" alt="Reaction ${i + 1}" />
          <button type="button" class="dl-circle" aria-label="Download">${DOWNLOAD_ICON_SVG}</button>
        </div>
        <div class="g-meta"><strong>${escapeHtml(r.label)}</strong>${r.bust ? "Bust" : "Hit"}</div>
      `;
      item.querySelector("img").addEventListener("click", () => {
        openReactionPreview(r.dataUrl, filename);
      });
      if (multi) {
        item.querySelector(".fav-pick").addEventListener("click", (e) => {
          e.stopPropagation();
          selectedFavoriteIndex = i;
          renderGalleryBody(player);
          renderGalleryActions(player);
        });
      }
      item.querySelector(".dl-circle").addEventListener("click", (e) => {
        e.stopPropagation();
        downloadDataUrl(r.dataUrl, filename);
      });
      modalBody.appendChild(item);
    });
  }

  function renderGalleryActions(player) {
    modalActions.innerHTML = "";
    const multi = isMultiplayer();
    const last = isLastPlayerTurn();

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
    if (!multi || last) {
      confirm.textContent = "End Game";
    } else {
      confirm.textContent = "Next Player";
    }
    confirm.disabled = multi && player.reactions.length > 0 && selectedFavoriteIndex < 0;
    confirm.addEventListener("click", () => {
      if (multi && player.reactions.length && selectedFavoriteIndex >= 0) {
        const fav = player.reactions[selectedFavoriteIndex].dataUrl;
        player.favorite = fav;
        saveFavorite(player.name, fav);
      }
      closeModal();
      if (!multi) {
        returnToLobby();
        return;
      }
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
      scoreEl.textContent = formatValue(0);
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
    gameStarted = true;
    currentPlayer = 0;
    spinsThisTurn = 0;
    turnOver = false;
    awaitingChoice = false;
    canAct = true;
    scoreLabel.textContent = players[currentPlayer].name;
    collapsePlayersEditor();
    clearReactionStrip();
    buildBoard();
    setTurnScore(0);
    syncTurnHud();
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

  addPlayerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    if (!name) return;
    soloStartArmed = false;
    setSoloWarning(false);
    players.push({ name, banked: 0, reactions: [], favorite: null, done: false });
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
    if (previewDataUrl) downloadDataUrl(previewDataUrl, previewFilename);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && !previewModal.hidden) {
      closeReactionPreview();
      return;
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
