const canvas = document.getElementById('captchaCanvas');
const ctx = canvas.getContext('2d');
let startTime, physicsParams, animationId;
let isRunning = false;
let gameMode = 'projectile'; // or 'dropcatch'
let successCount = 0;
let ballX, ballY, ballVelocity;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const BALL_RADIUS = 15;

function setCanvasSize() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(500, container.clientWidth - 40);
    canvas.width = maxWidth;
    canvas.height = Math.min(300, window.innerHeight * 0.4);
}

window.addEventListener('resize', setCanvasSize);
setCanvasSize();

const timerElement = document.createElement('div');
timerElement.className = 'timer';
timerElement.id = 'timer';
canvas.parentElement.appendChild(timerElement);

async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries > 0) {
            updateStatus('Waking up server... Please wait.', 'neutral');
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
    }
}

function initDropCatch() {
    // Start ball from top with random x position
    ballX = Math.random() * (canvas.width - BALL_RADIUS * 4) + BALL_RADIUS * 2;
    ballY = BALL_RADIUS;
    // Start with very small initial velocity
    ballVelocity = 0.2; // Reduced from 0.5 to 0.2
}

function animateProjectile() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t = (Date.now() - startTime) / 1000;
    
    // Don't process if time has expired
    if (t > 3.0) {
        endGame('Time expired! Try again.', 'error');
        return;
    }

    const vx = physicsParams.velocity * Math.cos(physicsParams.angle);
    const vy = physicsParams.velocity * Math.sin(physicsParams.angle);
    
    // Calculate position with proper physics
    const x = vx * t * (1 - physicsParams.friction * t);
    const rawY = vy * t - 0.5 * physicsParams.gravity * t * t;
    const y = Math.max(0, rawY);

    // Draw ground
    ctx.save();
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.restore();
    
    // Calculate ball position with proper starting height
    const startHeight = 35;
    ballX = canvas.width/2 + x;
    ballY = canvas.height - startHeight - y;

    // Ensure ball doesn't go below the ground
    ballY = Math.min(ballY, canvas.height - startHeight);

    // Draw ball shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY + 3, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();
    ctx.restore();

    // Draw ball
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#dc3545';
    ctx.fill();
    ctx.restore();

    const timeLeft = Math.max(0, 3.0 - t);
    timerElement.textContent = timeLeft.toFixed(1) + 's';

    // Check if ball has effectively stopped
    if (Math.abs(vx * (1 - physicsParams.friction * t)) < 0.1 && y <= 0) {
        endGame('Time expired! Try again.', 'error');
        return;
    }

    animationId = requestAnimationFrame(animateProjectile);
}

function animateDropCatch() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t = (Date.now() - startTime) / 1000;
    
    // Don't process if time has expired
    if (t > 3.0) {
        endGame('Time expired! Try again.', 'error');
        return;
    }
    
    // Draw target zone
    ctx.save();
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.restore();

    // Update ball position with much gentler acceleration
    ballVelocity += 0.08; // Reduced from 0.15 to 0.08
    ballY += ballVelocity;

    // Draw ball
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#dc3545';
    ctx.fill();
    ctx.restore();

    const timeLeft = Math.max(0, 3.0 - t);
    timerElement.textContent = timeLeft.toFixed(1) + 's';

    // End game if ball hits ground
    if (ballY > canvas.height - BALL_RADIUS - 25) {
        endGame('Missed! Try again.', 'error');
        return;
    }

    animationId = requestAnimationFrame(animateDropCatch);
}

function endGame(message, status) {
    isRunning = false;
    cancelAnimationFrame(animationId);
    timerElement.style.display = 'none';
    progressIndicator.classList.remove('show');
    updateStatus(message, status);
    const button = document.getElementById('startButton');
    button.disabled = false;
    button.textContent = 'Start Verification';
    successCount = 0;
}

async function handleClick(e) {
    if (!isRunning) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    if (gameMode === 'projectile') {
        handleProjectileClick(canvasX, canvasY);
    } else {
        handleDropCatchClick(canvasX, canvasY);
    }
}

async function handleProjectileClick(canvasX, canvasY) {
    const t = (Date.now() - startTime) / 1000;
    const distance = Math.sqrt(
        Math.pow(canvasX - ballX, 2) + 
        Math.pow(canvasY - ballY, 2)
    );

    if (distance > BALL_RADIUS * 2) {
        updateStatus('Missed! Try clicking closer to the ball.', 'error');
        return;
    }

    const physicsX = canvasX - canvas.width/2;
    const physicsY = canvas.height - 40 - canvasY;

    try {
        const response = await fetchWithRetry('/proxy/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: physicsParams.session_id,
                click_x: physicsX,
                click_y: physicsY,
                time: t
            })
        });
        const responseData = await response.json();
        
        if (responseData.valid) {
            endGame('Success! You caught the ball.', 'success');
        } else {
            endGame('Missed! Try again.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        endGame('Error validating click. Try again.', 'error');
    }
}

function handleDropCatchClick(canvasX, canvasY) {
    const distance = Math.sqrt(
        Math.pow(canvasX - ballX, 2) + 
        Math.pow(canvasY - ballY, 2)
    );

    if (distance > BALL_RADIUS * 2) {
        endGame('Missed! Try again.', 'error');
        return;
    }

    successCount++;
    if (successCount >= 3) {
        endGame('Success! You caught the ball 3 times!', 'success');
    } else {
        updateProgressIndicator(successCount);
        initDropCatch();
        updateStatus(`Good catch! ${3 - successCount} more to go.`, 'neutral');
    }
}

async function startCaptcha() {
    isRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    const button = document.getElementById('startButton');
    button.disabled = true;
    button.textContent = 'Starting...';

    updateStatus('Initializing...', 'neutral');
    successCount = 0;

    // Randomly choose game mode
    gameMode = Math.random() < 0.5 ? 'projectile' : 'dropcatch';

    try {
        // Show mode indicator first
        await showModeIndicator(gameMode);

        // After mode indicator is done, prepare the game
        if (gameMode === 'projectile') {
            const response = await fetchWithRetry('/proxy/generate');
            const data = await response.json();
            physicsParams = data;
        }
        
        startTime = Date.now();
        isRunning = true;
        timerElement.style.display = 'block';
        button.textContent = 'Verification in Progress...';
        
        if (gameMode === 'projectile') {
            updateStatus('Click the ball before it disappears!', 'neutral');
            animateProjectile();
        } else {
            initDropCatch();
            updateStatus('Catch the falling ball 3 times!', 'neutral');
            animateDropCatch();
        }
    } catch (error) {
        console.error('Error:', error);
        button.disabled = false;
        button.textContent = 'Start Verification';
        updateStatus('Error starting verification. Try again.', 'error');
    }
}

function updateStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status-message ' + type;
}

async function warmupServer() {
    try {
        await fetchWithRetry('/proxy/generate');
    } catch (error) {
        console.error('Error warming up server:', error);
    }
}

function createModeIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'mode-indicator';
    return indicator;
}

function createProgressIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'progress-indicator';
    return indicator;
}

// Add indicators to canvas container
const canvasContainer = canvas.parentElement;
const modeIndicator = createModeIndicator();
const progressIndicator = createProgressIndicator();
canvasContainer.appendChild(modeIndicator);
canvasContainer.appendChild(progressIndicator);

function showModeIndicator(mode) {
    return new Promise(resolve => {
        modeIndicator.innerHTML = mode === 'projectile' ? 
            '<span class="icon">🎯</span>Click the moving ball!' :
            '<span class="icon">🎯</span>Catch the falling ball 3 times!';
        modeIndicator.classList.add('show');
        setTimeout(() => {
            modeIndicator.classList.remove('show');
            setTimeout(resolve, 500); // Add a small delay after fade out
        }, 2000);
    });
}

function updateProgressIndicator(count) {
    if (count > 0) {
        progressIndicator.textContent = `${3 - count} more to go!`;
        progressIndicator.classList.add('show');
        setTimeout(() => {
            progressIndicator.classList.remove('show');
        }, 1500);
    }
}

canvas.addEventListener('click', handleClick);
document.getElementById('startButton').addEventListener('click', startCaptcha);

// Warmup the server when the page loads
warmupServer();