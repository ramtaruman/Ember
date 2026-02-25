/* ============================================================
   Ember – game.js
   Full game logic, state management, scoring, animations
   ============================================================ */

'use strict';

// ─── CARD DATA ────────────────────────────────────────────────
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];

const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_LABELS = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const COLOR_MAP = { spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black' };

const RANK_LABELS = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
function rankLabel(r) { return RANK_LABELS[r] || r; }
function suitLabel(s) { return SUIT_LABELS[s]; }
function cardName(card) { return `${rankLabel(card.rank)} of ${suitLabel(card.suit)}`; }

function randomCard() {
    return {
        rank: RANKS[Math.floor(Math.random() * 13)],
        suit: SUITS[Math.floor(Math.random() * 4)],
    };
}

// ─── STATE ────────────────────────────────────────────────────
let state = {};

function initState(players, turnsPerPlayer) {
    state = {
        players: players.map(name => ({ name, score: 0, turns: 0, totalPossible: 0, correct: 0 })),
        turnsPerPlayer,
        currentPlayerIdx: 0,
        currentTurn: 1,           // 1-based turn for current player
        totalTurns: players.length * turnsPerPlayer,
        turnsCompleted: 0,
        phase: 'predict',         // 'predict' | 'reveal'
        currentCard: null,
        predictions: { color: [], suit: [], rank: [] },
        singlePlayer: players.length === 1,
    };
}

// ─── UI HELPERS ───────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    el.classList.add('active');
}

function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden', 'show');
    void t.offsetWidth; // reflow
    t.classList.add('show');
    setTimeout(() => t.classList.add('hidden'), 2600);
}


// ─── RENDER CARD (inside card-front) ─────────────────────────
function renderCardFront(card, container) {
    const colorClass = COLOR_MAP[card.suit] === 'red' ? 'red-card' : 'black-card';
    const sym = SUIT_SYMBOLS[card.suit];
    container.innerHTML = `
    <div class="card-rank-top ${colorClass}">${card.rank}</div>
    <div class="card-suit-top ${colorClass}">${sym}</div>
    <div class="card-center-suit ${colorClass}">${sym}</div>
    <div class="card-rank-bottom ${colorClass}">${card.rank}</div>
    <div class="card-suit-bottom ${colorClass}">${sym}</div>
  `;
}

// ─── SCORE CALCULATION ────────────────────────────────────────
function calcScore(card, predictions) {
    const { color, suit, rank } = predictions;
    const results = [];
    let total = 0;

    // Color (1pt)
    const colorSelected = color.length;
    if (colorSelected > 0 && colorSelected < 2) {
        const hit = color.includes(COLOR_MAP[card.suit]);
        const pts = hit ? 1 : 0;
        results.push({ label: `Color – ${color.map(c => cap(c)).join(', ')}`, pts, hit });
        total += pts;
    } else if (colorSelected === 2) {
        results.push({ label: 'Color – (both selected)', pts: 0, hit: false, voided: true });
    }

    // Suit (2pts)
    const suitSelected = suit.length;
    if (suitSelected > 0 && suitSelected < 4) {
        const hit = suit.includes(card.suit);
        const pts = hit ? 2 : 0;
        results.push({ label: `Suit – ${suit.map(s => suitLabel(s)).join(', ')}`, pts, hit });
        total += pts;
    } else if (suitSelected === 4) {
        results.push({ label: 'Suit – (all selected)', pts: 0, hit: false, voided: true });
    }

    // Rank (6pts)
    const rankSelected = rank.length;
    if (rankSelected > 0 && rankSelected < 13) {
        const hit = rank.includes(card.rank);
        const pts = hit ? 6 : 0;
        results.push({ label: `Rank – ${rank.slice(0, 4).join(', ')}${rank.length > 4 ? '…' : ''}`, pts, hit });
        total += pts;
    } else if (rankSelected === 13) {
        results.push({ label: 'Rank – (all selected)', pts: 0, hit: false, voided: true });
    }

    return { results, total };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── TURN SETUP ───────────────────────────────────────────────
function setupTurn() {
    const player = state.players[state.currentPlayerIdx];
    state.phase = 'predict';
    state.currentCard = null;
    state.predictions = { color: [], suit: [], rank: [] };

    // HUD
    $('hud-player-name').textContent = player.name;
    const turnDisplay = state.singlePlayer
        ? `${state.currentTurn} / ${state.turnsPerPlayer}`
        : `${state.currentTurn} / ${state.turnsPerPlayer}`;
    $('hud-turn').textContent = turnDisplay;
    $('hud-score').textContent = player.score;

    // Reset card flip
    const card3d = $('card-3d');
    card3d.classList.remove('flipped');

    // Clear predictions UI
    document.querySelectorAll('.pred-btn').forEach(btn => btn.classList.remove('selected'));
    const btnReveal = $('btn-reveal');
    btnReveal.disabled = false;
    btnReveal.textContent = '';
    btnReveal.innerHTML = '<span class="reveal-icon">🃏</span> Reveal Card';

    showScreen('screen-game');
}

// ─── PREDICTION TOGGLE ────────────────────────────────────────
function togglePrediction(btn) {
    const cat = btn.dataset.cat;
    const val = btn.dataset.val;

    if (btn.classList.contains('selected')) {
        btn.classList.remove('selected');
        state.predictions[cat] = [];
    } else {
        // Deselect any currently active button in this category
        document.querySelectorAll(`.pred-btn[data-cat="${cat}"]`).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.predictions[cat] = [val];
    }
}

// ─── REVEAL ──────────────────────────────────────────────────
function doReveal() {
    if (state.phase !== 'predict') return;
    state.phase = 'reveal';

    const card = randomCard();
    state.currentCard = card;

    // Render card front
    renderCardFront(card, $('card-front-content'));

    // Flip animation
    const card3d = $('card-3d');
    card3d.classList.add('flipped');

    // Build result after flip completes
    setTimeout(() => showResult(card), 750);
}

// ─── SHOW RESULT ─────────────────────────────────────────────
function showResult(card) {
    const { predictions } = state;
    const { results, total } = calcScore(card, predictions);
    const player = state.players[state.currentPlayerIdx];
    player.score += total;
    player.turns += 1;

    // Accuracy tracking
    const anyPrediction = predictions.color.length + predictions.suit.length + predictions.rank.length;
    if (anyPrediction > 0) {
        player.totalPossible += 1;
        if (total > 0) player.correct += 1;
    }

    // HUD score update
    $('hud-score').textContent = player.score;

    // Result screen: card display
    const resultCardDisplay = $('result-card-display');
    renderCardFront(card, resultCardDisplay.querySelector('.card-front-content') || (() => {
        resultCardDisplay.innerHTML = '';
        const inner = document.createElement('div');
        inner.className = 'card-front-content';
        resultCardDisplay.appendChild(inner);
        return inner;
    })());

    // Ensure result card has proper structure
    resultCardDisplay.innerHTML = '';
    const rcInner = document.createElement('div');
    rcInner.className = 'card-front-content';
    resultCardDisplay.appendChild(rcInner);
    renderCardFront(card, rcInner);

    $('result-card-name').textContent = cardName(card);

    // Breakdown
    const sb = $('score-breakdown');
    sb.innerHTML = '';
    if (results.length === 0) {
        sb.innerHTML = '<div class="score-row"><span class="score-row-label">No predictions made</span><span class="score-row-pts zero">—</span></div>';
    } else {
        results.forEach((r, i) => {
            const row = document.createElement('div');
            row.className = 'score-row';
            row.style.animationDelay = `${i * 0.08}s`;
            row.innerHTML = `
        <span class="score-row-label">${r.voided ? '⚠️ ' : r.hit ? '✅ ' : '❌ '}${r.label}</span>
        <span class="score-row-pts ${r.pts > 0 ? 'positive' : 'zero'}">${r.pts > 0 ? '+' + r.pts : r.voided ? '0 (voided)' : '0'}</span>
      `;
            sb.appendChild(row);
        });
    }

    $('result-turn-score').textContent = total > 0 ? `+${total}` : '0';
    $('result-running-score').textContent = player.score;

    // Mini scoreboard (multiplayer)
    buildMiniScoreboard();

    // Next turn button label
    const isLast = checkIfLastTurn();
    $('btn-next-turn').textContent = isLast ? '🏆 See Final Scores' : 'Next Turn →';

    showScreen('screen-result');
}

function buildMiniScoreboard() {
    const ms = $('mini-scoreboard');
    if (state.singlePlayer) { ms.innerHTML = ''; return; }
    ms.innerHTML = `<div class="mini-sb-title">Scoreboard</div>`;
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p) => {
        const isCurrent = p === state.players[state.currentPlayerIdx];
        const row = document.createElement('div');
        row.className = `mini-sb-row${isCurrent ? ' current-player' : ''}`;
        row.innerHTML = `<span class="mini-sb-player">${isCurrent ? '▶ ' : ''}${p.name}</span><span class="mini-sb-score">${p.score}</span>`;
        ms.appendChild(row);
    });
}

// ─── NEXT TURN LOGIC ─────────────────────────────────────────
function nextTurn() {
    state.turnsCompleted += 1;

    if (checkIfLastTurn()) {
        // We just finished the last turn — go to end
        showEndScreen();
        return;
    }

    if (state.singlePlayer) {
        state.currentTurn += 1;
    } else {
        // Rotate: advance player, wrap around, increment turn when all players done
        const nextIdx = (state.currentPlayerIdx + 1) % state.players.length;
        if (nextIdx === 0) {
            // All players have gone this round
            state.currentTurn += 1;
        }
        state.currentPlayerIdx = nextIdx;
        state.currentTurn = state.players[state.currentPlayerIdx].turns + 1;
    }

    setupTurn();
}

function checkIfLastTurn() {
    return state.turnsCompleted >= state.totalTurns;
}

// ─── END GAME ────────────────────────────────────────────────
function showEndScreen() {
    showConfetti();

    const sorted = [...state.players].sort((a, b) => b.score - a.score);

    // Winner message
    let winnerMsg = '';
    if (state.singlePlayer) {
        winnerMsg = `You scored ${sorted[0].score} pts in ${state.turnsPerPlayer} turns!`;
    } else {
        const topScore = sorted[0].score;
        const winners = sorted.filter(p => p.score === topScore);
        if (winners.length === 1) {
            winnerMsg = `🏆 ${winners[0].name} wins with ${topScore} pts!`;
        } else {
            winnerMsg = `🤝 It's a tie! ${winners.map(w => w.name).join(' & ')} win with ${topScore} pts!`;
        }
    }
    $('end-winner-msg').textContent = winnerMsg;

    // Final scoreboard
    const fsb = $('final-scoreboard');
    fsb.innerHTML = `
    <div class="final-sb-header">
      <span>Player</span><span>Score</span>
    </div>
  `;
    sorted.forEach((p, i) => {
        const rank = i + 1;
        const isWinner = i === 0;
        const row = document.createElement('div');
        row.className = `final-sb-row${isWinner ? ' winner-row' : ''}`;
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
        row.innerHTML = `
      <span>
        <span class="rank-badge ${rankClass}">${rank}</span>
        <span class="final-sb-name">${p.name}</span>
        ${isWinner ? '<span class="winner-crown">👑</span>' : ''}
      </span>
      <span class="final-sb-score">${p.score}</span>
    `;
        fsb.appendChild(row);
    });

    // Stats (single player or all players)
    const statsEl = $('end-stats');
    if (state.singlePlayer) {
        const p = state.players[0];
        const acc = p.totalPossible > 0 ? Math.round((p.correct / p.totalPossible) * 100) : 0;
        const avg = state.turnsPerPlayer > 0 ? (p.score / state.turnsPerPlayer).toFixed(1) : 0;
        statsEl.innerHTML = `
      <div class="stat-box">
        <div class="stat-label">Accuracy</div>
        <div class="stat-value">${acc}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Avg / Turn</div>
        <div class="stat-value">${avg} pts</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Total Turns</div>
        <div class="stat-value">${state.turnsPerPlayer}</div>
      </div>
    `;
    } else {
        const totalPlayers = state.players.length;
        const topPlayer = sorted[0];
        const avgScore = (state.players.reduce((a, b) => a + b.score, 0) / totalPlayers).toFixed(1);
        statsEl.innerHTML = `
      <div class="stat-box">
        <div class="stat-label">Top Score</div>
        <div class="stat-value">${topPlayer.score}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Avg Score</div>
        <div class="stat-value">${avgScore}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Players</div>
        <div class="stat-value">${totalPlayers}</div>
      </div>
    `;
    }

    showScreen('screen-end');
}

// ─── CONFETTI ────────────────────────────────────────────────
function showConfetti() {
    const container = $('end-confetti');
    container.innerHTML = '';
    const colors = ['#ffffff', '#999999', '#555555', '#ffffff', '#cccccc', '#ffffff', '#888888'];
    for (let i = 0; i < 30; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const dur = 2 + Math.random() * 3;
        const delay = Math.random() * 2;
        const size = 6 + Math.random() * 10;
        piece.style.cssText = `
      left: ${left}vw;
      width: ${size}px; height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
    `;
        container.appendChild(piece);
    }
}

// ─── SETUP SCREEN LOGIC ───────────────────────────────────────
function setupTurnPillLogic(pillsContainerId, customWrapId, customInputId) {
    let selected = null;
    const pillsContainer = $(pillsContainerId);

    pillsContainer.querySelectorAll('.turn-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            pillsContainer.querySelectorAll('.turn-pill').forEach(p => p.classList.remove('selected'));
            pill.classList.add('selected');
            if (pill.dataset.turns === 'custom') {
                $(customWrapId).classList.remove('hidden');
                $(customInputId).focus();
                selected = 'custom';
            } else {
                $(customWrapId).classList.add('hidden');
                selected = parseInt(pill.dataset.turns);
            }
        });
    });

    return {
        getSelected: () => {
            if (selected === 'custom') {
                const v = parseInt($(customInputId).value);
                return (!isNaN(v) && v >= 1 && v <= 100) ? v : null;
            }
            return selected;
        }
    };
}

// ─── SETUP: PLAYER MANAGEMENT ────────────────────────────────
function getPlayers() {
    const inputs = document.querySelectorAll('.player-name-input');
    const names = [];
    inputs.forEach((inp, i) => {
        const name = inp.value.trim() || `Player ${i + 1}`;
        names.push(name);
    });
    // Filter blank if only one player
    return names.filter((n, i) => i === 0 || n.trim() !== `Player ${i + 1}` || inputs[i].value.trim() !== '');
}

function addPlayerRow() {
    const list = $('player-list');
    const count = list.querySelectorAll('.player-input-row').length + 1;
    if (count > 8) { showToast('Maximum 8 players!'); return; }
    const row = document.createElement('div');
    row.className = 'player-input-row';
    row.innerHTML = `
    <input type="text" class="player-name-input" placeholder="Player ${count}" maxlength="16" />
    <button class="btn-remove-player" title="Remove">✕</button>
  `;
    row.querySelector('.btn-remove-player').addEventListener('click', () => {
        if ($('player-list').querySelectorAll('.player-input-row').length > 1) {
            row.remove();
            updatePlayerPlaceholders();
        } else {
            showToast('Need at least 1 player!');
        }
    });
    list.appendChild(row);
}

function updatePlayerPlaceholders() {
    $('player-list').querySelectorAll('.player-name-input').forEach((inp, i) => {
        if (!inp.value.trim()) inp.placeholder = `Player ${i + 1}`;
    });
}

// ─── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // ── HOME ──
    $('btn-single').addEventListener('click', () => showScreen('screen-setup-single'));
    $('btn-multi').addEventListener('click', () => showScreen('screen-setup-multi'));

    // ── SETUP SINGLE ──
    $('back-from-setup-single').addEventListener('click', () => showScreen('screen-home'));
    const singleTurns = setupTurnPillLogic('turn-options', 'custom-input-wrap', 'custom-turns');

    $('btn-start-single').addEventListener('click', () => {
        const turns = singleTurns.getSelected();
        if (!turns) { showToast('Please select a number of turns!'); return; }
        initState(['You'], turns);
        setupTurn();
    });

    // ── SETUP MULTI ──
    $('back-from-setup-multi').addEventListener('click', () => showScreen('screen-home'));
    const multiTurns = setupTurnPillLogic('turn-options-multi', 'custom-input-wrap-multi', 'custom-turns-multi');

    $('btn-add-player').addEventListener('click', addPlayerRow);

    // Initial remove buttons
    $('player-list').querySelectorAll('.btn-remove-player').forEach(btn => {
        btn.addEventListener('click', () => {
            if ($('player-list').querySelectorAll('.player-input-row').length > 1) {
                btn.closest('.player-input-row').remove();
                updatePlayerPlaceholders();
            } else {
                showToast('Need at least 1 player!');
            }
        });
    });

    $('btn-start-multi').addEventListener('click', () => {
        const turns = multiTurns.getSelected();
        if (!turns) { showToast('Please select turns per player!'); return; }
        const inputs = $('player-list').querySelectorAll('.player-name-input');
        const names = [];
        inputs.forEach((inp, i) => {
            const name = inp.value.trim() || `Player ${i + 1}`;
            names.push(name);
        });
        if (names.length < 2) { showToast('Add at least 2 players!'); return; }
        initState(names, turns);
        setupTurn();
    });

    // ── GAME SCREEN ──
    document.querySelectorAll('.pred-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.phase !== 'predict') return;
            togglePrediction(btn);
        });
    });

    $('btn-reveal').addEventListener('click', () => {
        const { color, suit, rank } = state.predictions;
        const anyPred = color.length + suit.length + rank.length;
        if (anyPred === 0) {
            showToast('Make at least one prediction first!');
            return;
        }
        $('btn-reveal').disabled = true;
        doReveal();
    });

    // ── RESULT SCREEN ──
    $('btn-next-turn').addEventListener('click', () => nextTurn());

    // ── QUIT ──
    let quitPending = false;
    let quitTimer = null;
    function quitToHome() {
        if (!quitPending) {
            quitPending = true;
            showToast('Tap Quit again to confirm');
            quitTimer = setTimeout(() => { quitPending = false; }, 2500);
        } else {
            clearTimeout(quitTimer);
            quitPending = false;
            showScreen('screen-home');
        }
    }
    $('btn-quit-game').addEventListener('click', quitToHome);
    $('btn-quit-result').addEventListener('click', quitToHome);

    // ── END SCREEN ──
    $('btn-play-again').addEventListener('click', () => showScreen('screen-home'));
});
