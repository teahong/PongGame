const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 10;
const PADDLE_SPEED = 8;
const INITIAL_BALL_SPEED = 7;
const AI_SPEED = 6;
const WINNING_SCORE = 10;

// Colors
const PRIMARY_COLOR = '#00f3ff';
const SECONDARY_COLOR = '#ff00ff';

// Game state
let gameState = 'START'; // START, PLAYING, GAME_OVER
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
    if (bgmOscillator) return;

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
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: PRIMARY_COLOR,
    dy: 0
};

const ai = {
    x: canvas.width - PADDLE_WIDTH,
    y: canvas.height / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: SECONDARY_COLOR,
    dy: 0
};

const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
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
    if (player) {
        player.y = canvas.height / 2 - player.height / 2;
        player.x = 0;
    }
    if (ai) {
        ai.y = canvas.height / 2 - ai.height / 2;
        ai.x = canvas.width - ai.width;
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input handling
const keys = {};
let touchY = null;

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAME_OVER') {
            startGame();
        }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Click/Touch to Start and Control
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const handleStartAction = () => {
    if (gameState === 'START' || gameState === 'GAME_OVER') {
        startGame();
    }
};

startBtn.addEventListener('click', handleStartAction);
restartBtn.addEventListener('click', handleStartAction);

// Also allow clicking anywhere on the overlay for better mobile experience
document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            handleStartAction();
        }
    });
});

// Follow mouse for desktop testing
canvas.addEventListener('mousemove', (e) => {
    if (gameState === 'PLAYING') {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        player.y = mouseY - player.height / 2;
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'START' || gameState === 'GAME_OVER') {
        startGame();
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (gameState === 'PLAYING') {
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const mouseY = touch.clientY - rect.top;
        player.y = mouseY - player.height / 2;
    }
}, { passive: false });

function startGame() {
    gameState = 'PLAYING';
    playerScore = 0;
    aiScore = 0;
    updateScoreboard();
    resetBall();
    startBGM();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speed = INITIAL_BALL_SPEED;
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
    const aiCenter = ai.y + ai.height / 2;
    if (aiCenter < ball.y - 35) {
        ai.y += AI_SPEED;
    } else if (aiCenter > ball.y + 35) {
        ai.y -= AI_SPEED;
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
    // Player
    if (
        ball.x <= player.x + player.width &&
        ball.y + ball.size >= player.y &&
        ball.y <= player.y + player.height
    ) {
        ball.dx *= -1;
        ball.x = player.x + player.width; // Prevent sticking
        increaseBallSpeed();
        soundEffects.paddle();
    }

    // AI
    if (
        ball.x + ball.size >= ai.x &&
        ball.y + ball.size >= ai.y &&
        ball.y <= ai.y + ai.height
    ) {
        ball.dx *= -1;
        ball.x = ai.x - ball.size; // Prevent sticking
        increaseBallSpeed();
        soundEffects.paddle(200);
    }

    // Scoring
    if (ball.x < 0) {
        aiScore++;
        updateScoreboard();
        checkWin();
        resetBall();
        soundEffects.score(300);
    } else if (ball.x > canvas.width) {
        playerScore++;
        updateScoreboard();
        checkWin();
        resetBall();
        soundEffects.score();
    }
}

function increaseBallSpeed() {
    if (ball.speed < 15) {
        ball.speed += 0.5;
        ball.dx = (ball.dx > 0 ? 1 : -1) * ball.speed;
        ball.dy = (ball.dy > 0 ? 1 : -1) * ball.speed;
    }
}

function updateScoreboard() {
    document.getElementById('player-score').innerText = playerScore;
    document.getElementById('ai-score').innerText = aiScore;
}

function checkWin() {
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
        gameState = 'GAME_OVER';
        const winnerText = playerScore >= WINNING_SCORE ? 'YOU WIN' : 'GAME OVER';
        document.getElementById('winner-text').innerText = winnerText;
        document.getElementById('game-over-screen').classList.remove('hidden');
        stopBGM();
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw middle line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    drawRect(player.x, player.y, player.width, player.height, player.color);
    drawRect(ai.x, ai.y, ai.width, ai.height, ai.color);

    // Draw ball
    drawRect(ball.x, ball.y, ball.size, ball.size, ball.color, true);
}

function drawRect(x, y, w, h, color, isBall = false) {
    ctx.fillStyle = color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = color;
    ctx.fillRect(x, y, w, h);

    // Reset shadow for performance if needed, but keeping it for neon effect
    ctx.shadowBlur = 0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start loop
gameLoop();
