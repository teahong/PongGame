const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const PADDLE_SPEED = 9;
const INITIAL_BALL_SPEED = 7; // Stage 5
const WINNING_SCORE = 5;

// Colors
const PRIMARY_COLOR = '#00f3ff';
const SECONDARY_COLOR = '#ff00ff';
// Stage Data
const STAGES = [
    { name: '1', speed: 6.0, aiRatio: 0.55, errorMargin: 60 },
    { name: '2', speed: 6.3, aiRatio: 0.60, errorMargin: 55 },
    { name: '3', speed: 6.6, aiRatio: 0.65, errorMargin: 50 },
    { name: '4', speed: 6.9, aiRatio: 0.70, errorMargin: 45 },
    { name: '5', speed: 7.2, aiRatio: 0.75, errorMargin: 40 },
    { name: '6', speed: 7.5, aiRatio: 0.80, errorMargin: 35 },
    { name: '7', speed: 7.8, aiRatio: 0.85, errorMargin: 30 },
    { name: '8', speed: 7.9, aiRatio: 0.90, errorMargin: 25 },
    { name: '9', speed: 8.0, aiRatio: 0.93, errorMargin: 20 },
    { name: '10', speed: 8.1, aiRatio: 0.97, errorMargin: 15 }
];

// Game state
let gameState = 'START'; // START, STAGE_SELECT, PLAYING, GAME_OVER
let currentStageIndex = 0;
let unlockedStages = parseInt(localStorage.getItem('pong_unlocked_stages')) || 1;
let playerScore = 0;
let aiScore = 0;

// Audio System using Web Audio API
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let bgmOscillator = null;
let bgmGain = null;

const soundEffects = {
    paddle: (freq = 150) => playTone(freq, 0.1, 'square', 0.1),
    wall: (freq = 400) => playTone(freq, 0.05, 'sine', 0.05),
    score: (freq = 600) => {
        playTone(freq, 0.1, 'sine', 0.1);
        setTimeout(() => playTone(freq * 1.5, 0.15, 'sine', 0.1), 100);
    }
};

function playTone(freq, duration, type, volume) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function startBGM() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (bgmGain) return;

    bgmGain = audioCtx.createGain();
    bgmGain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    bgmGain.connect(audioCtx.destination);

    function playNote(freq, time) {
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.1, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
        osc.connect(g);
        g.connect(bgmGain);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    const notes = [110, 110, 130, 146, 110, 110, 164, 146]; // Bassline
    let step = 0;
    const interval = 0.5;

    const playLoop = () => {
        if (!bgmGain) return;
        const now = audioCtx.currentTime;
        playNote(notes[step], now);
        step = (step + 1) % notes.length;
        setTimeout(playLoop, interval * 1000);
    };
    playLoop();
}

function stopBGM() {
    if (bgmGain) {
        bgmGain.disconnect();
        bgmGain = null;
    }
}

// Game objects
const player = {
    x: 0,
    y: 0,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: PRIMARY_COLOR,
    dy: 0
};

const ai = {
    x: 0,
    y: 0,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: SECONDARY_COLOR,
    dy: 0
};

const ball = {
    x: 0,
    y: 0,
    size: BALL_SIZE,
    speed: INITIAL_BALL_SPEED,
    dx: INITIAL_BALL_SPEED,
    dy: INITIAL_BALL_SPEED,
    color: '#ffffff'
};

// Set canvas size
function resizeCanvas() {
    const container = document.querySelector('.game-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Update paddle positions after resize
    player.y = canvas.height / 2 - player.height / 2;
    player.x = 0;
    ai.y = canvas.height / 2 - ai.height / 2;
    ai.x = canvas.width - ai.width;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input handling
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAME_OVER') {
            handleStartAction();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// UI Elements
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const backBtn = document.getElementById('back-btn');
const stageList = document.getElementById('stage-list');

const handleStartAction = () => {
    if (gameState === 'START') {
        showStageSelect();
    } else if (gameState === 'GAME_OVER') {
        // Restart current or next stage
        startGame(currentStageIndex);
    }
};

startBtn.addEventListener('click', () => {
    showStageSelect();
});

restartBtn.addEventListener('click', () => {
    startGame(currentStageIndex);
});

menuBtn.addEventListener('click', () => {
    showMainMenu();
});

backBtn.addEventListener('click', () => {
    showMainMenu();
});

function showMainMenu() {
    gameState = 'START';
    document.getElementById('start-screen').classList.remove('hidden');
    document.getElementById('stage-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    stopBGM();
}

function showStageSelect() {
    gameState = 'STAGE_SELECT';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('stage-screen').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    renderStageList();
}

function renderStageList() {
    stageList.innerHTML = '';
    STAGES.forEach((stage, index) => {
        const btn = document.createElement('button');
        btn.className = 'stage-btn';
        if (index + 1 > unlockedStages) {
            btn.classList.add('locked');
        } else {
            btn.addEventListener('click', () => startGame(index));
        }
        btn.innerHTML = `<div>Stage</div><div>${stage.name}</div>`;
        stageList.appendChild(btn);
    });
}

function startGame(index) {
    gameState = 'PLAYING';
    currentStageIndex = index;
    playerScore = 0;
    aiScore = 0;
    updateScoreboard();

    // Set stage speed
    ball.speed = STAGES[index].speed;
    resetBall();
    startBGM();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('stage-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

// Follow mouse for desktop testing
canvas.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING') {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        player.y = mouseY - player.height / 2;
    }
});

canvas.addEventListener('touchstart', (e) => {
    if (gameState === 'PLAYING') {
        e.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    if (gameState === 'PLAYING') {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const mouseY = touch.clientY - rect.top;
        player.y = mouseY - player.height / 2;
    }
}, { passive: false });

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    // Keep stage speed but randomize direction
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ball.dy = (Math.random() * 2 - 1) * ball.speed;
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Player movement (Keyboard)
    if (keys['ArrowUp'] || keys['KeyW']) {
        player.y -= PADDLE_SPEED;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
        player.y += PADDLE_SPEED;
    }

    // Clamp player position
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));

    // AI movement
    const stage = STAGES[currentStageIndex];
    const aiCenter = ai.y + ai.height / 2;
    const aiTargetSpeed = ball.speed * stage.aiRatio;

    if (aiCenter < ball.y - stage.errorMargin) {
        ai.y += aiTargetSpeed;
    } else if (aiCenter > ball.y + stage.errorMargin) {
        ai.y -= aiTargetSpeed;
    }
    ai.y = Math.max(0, Math.min(canvas.height - ai.height, ai.y));

    // Ball movement
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision (top/bottom)
    if (ball.y <= 0 || ball.y + ball.size >= canvas.height) {
        ball.dy *= -1;
        soundEffects.wall();
    }

    // Paddle collision
    if (
        ball.x <= player.x + player.width &&
        ball.y + ball.size >= player.y &&
        ball.y <= player.y + player.height
    ) {
        ball.dx *= -1;
        ball.x = player.x + player.width;
        increaseBallSpeed();
        soundEffects.paddle();
    }

    if (
        ball.x + ball.size >= ai.x &&
        ball.y + ball.size >= ai.y &&
        ball.y <= ai.y + ai.height
    ) {
        ball.dx *= -1;
        ball.x = ai.x - ball.size;
        increaseBallSpeed();
        soundEffects.paddle(200);
    }

    // Scoring
    if (ball.x < 0) {
        aiScore++;
        updateScoreboard();
        checkWin();
        if (gameState === 'PLAYING') resetBall();
    } else if (ball.x > canvas.width) {
        playerScore++;
        updateScoreboard();
        checkWin();
        if (gameState === 'PLAYING') resetBall();
    }
}

function increaseBallSpeed() {
    // Subtle increase during the rally
    ball.dx *= 1.05;
    ball.dy *= 1.05;
}

function updateScoreboard() {
    document.getElementById('player-score').innerText = playerScore;
    document.getElementById('ai-score').innerText = aiScore;
}

function checkWin() {
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
        gameState = 'GAME_OVER';
        const isPlayerWin = playerScore >= WINNING_SCORE;
        const winnerText = isPlayerWin ? 'YOU WIN!' : 'GAME OVER';
        document.getElementById('winner-text').innerText = winnerText;

        const unlockMsg = document.getElementById('unlock-msg');
        unlockMsg.innerText = '';

        if (isPlayerWin) {
            if (currentStageIndex + 1 === unlockedStages && unlockedStages < STAGES.length) {
                unlockedStages++;
                localStorage.setItem('pong_unlocked_stages', unlockedStages);
                unlockMsg.innerText = `NEW STAGE UNLOCKED: Stage ${unlockedStages}!`;
            }

            if (currentStageIndex < STAGES.length - 1) {
                restartBtn.innerText = 'NEXT STAGE';
                const nextIndex = currentStageIndex + 1;
                restartBtn.onclick = () => startGame(nextIndex);
            } else {
                restartBtn.innerText = 'REPLAY';
                restartBtn.onclick = () => startGame(currentStageIndex);
            }
        } else {
            restartBtn.innerText = 'TRY AGAIN';
            restartBtn.onclick = () => startGame(currentStageIndex);
        }

        document.getElementById('game-over-screen').classList.remove('hidden');
        stopBGM();
        soundEffects.score(isPlayerWin ? 800 : 200);
    }
}

function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    drawRect(player.x, player.y, player.width, player.height, player.color);
    drawRect(ai.x, ai.y, ai.width, ai.height, ai.color);
    drawRect(ball.x, ball.y, ball.size, ball.size, ball.color, true);
}

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
