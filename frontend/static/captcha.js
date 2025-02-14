// Game state variables
let isRunning = false;
let gameMode = '';
let successCount = 0;
let startTime = 0;
let animationId = null;
let ballX = 0;
let ballY = 0;
let ballVelocity = 0;

// Mode tracking for equal distribution
let dropCatchCount = 0;
let projectileCount = 0;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const BALL_RADIUS = 10; // Reduced radius to make it rounder

// Add device detection
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Adjust speeds based on device
const SPEED_MULTIPLIER = isMobile ? 0.35 : 0.85; // Increased speed
const GRAVITY_MULTIPLIER = isMobile ? 0.4 : 0.75; // Increased gravity for faster falling

const canvas = document.getElementById('captchaCanvas');
const ctx = canvas.getContext('2d');

function setCanvasSize() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(400, container.clientWidth - 20); // Reduced max width and padding
    canvas.width = maxWidth;
    canvas.height = Math.min(280, window.innerHeight * 0.35); // Slightly reduced height
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
    ballVelocity = 0.1 * SPEED_MULTIPLIER; // Reduced initial velocity and adjusted for mobile
}

function animateProjectile() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t = (Date.now() - startTime) / 1000;
    
    if (t > 5.0) {
        endGame('Time expired! Try again.', 'error');
        return;
    }

    ctx.save();
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.restore();

    // Adjusted physics for mobile
    const period = isMobile ? 2.5 : 2; // Even slower bounce period
    const amplitude = canvas.height * (isMobile ? 0.4 : 0.5); // Lower bounce height
    const horizontalSpeed = 1.2 * SPEED_MULTIPLIER; // Significantly reduced horizontal speed
    
    const verticalOffset = Math.abs(Math.sin(t * Math.PI / period)) * amplitude;
    ballX = (canvas.width * 0.2) + (t * horizontalSpeed * 60);
    ballY = (canvas.height - 40) - verticalOffset;

    if (ballX > canvas.width * 0.8) {
        endGame('Ball escaped! Try again.', 'error');
        return;
    }

    // Draw ball
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#dc3545';
    ctx.fill();
    ctx.restore();

    const timeLeft = Math.max(0, 5.0 - t);
    timerElement.textContent = timeLeft.toFixed(1) + 's';

    animationId = requestAnimationFrame(animateProjectile);
}

function animateDropCatch() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t = (Date.now() - startTime) / 1000;
    
    // Increased timer from 3.0 to 5.0 seconds
    if (t > 5.0) {
        endGame('Time expired! Try again.', 'error');
        return;
    }
    
    // Draw target zone
    ctx.save();
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.restore();

    // Slower acceleration for mobile
    ballVelocity += (0.05 * GRAVITY_MULTIPLIER);
    ballY += (ballVelocity * SPEED_MULTIPLIER);

    // Draw ball shadow for better visual feedback
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

    const timeLeft = Math.max(0, 5.0 - t); // Updated to 5.0 seconds
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
    
    if (status === 'success') {
        // Create and show the success overlay
        const overlay = document.createElement('div');
        overlay.className = 'success-overlay';
        overlay.innerHTML = `
            <div class="success-message">
                <div class="checkmark">✓</div>
                <h2>Verification Successful!</h2>
                <p>Redirecting...</p>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Wait for a moment to show success message then redirect
        setTimeout(() => {
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return_url');
            if (returnUrl) {
                window.location.href = returnUrl;
            } else {
                window.location.reload();
            }
        }, 2000); // Increased to 2 seconds to show the message
    } else {
        updateStatus(message, status);
    }
    
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
    if (!isRunning) return;

    const distance = Math.sqrt(
        Math.pow(canvasX - ballX, 2) + 
        Math.pow(canvasY - ballY, 2)
    );

    // More forgiving click detection
    if (distance > BALL_RADIUS * 2.2) {
        updateStatus('Missed! Try clicking closer to the ball.', 'error');
        return;
    }

    successCount++;
    updateProgressIndicator(successCount);
    
    if (successCount >= 3) {
        isRunning = false;
        cancelAnimationFrame(animationId);
        endGame('Success! You caught the ball 3 times!', 'success');
    } else {
        // Reset for next bounce cycle
        startTime = Date.now();
        updateStatus('Good! ' + (3 - successCount) + ' more to go!', 'success');
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
    updateProgressIndicator(successCount);
    
    if (successCount >= 3) {
        endGame('Success! You caught the ball 3 times!', 'success');
    } else {
        updateProgressIndicator(successCount);
        initDropCatch();
        updateStatus(`Good catch! ${3 - successCount} more to go.`, 'neutral');
    }
}

async function startCaptcha() {
    const button = document.getElementById('startButton');
    button.disabled = true;
    button.textContent = 'Verifying...';
    
    // Reset game state
    isRunning = false;
    successCount = 0;
    
    // Clear any existing mode indicator
    const modeIndicator = document.getElementById('modeIndicator');
    modeIndicator.style.display = 'none';
    modeIndicator.classList.remove('show');
    
    // Ensure equal probability by using the counts
    if (dropCatchCount === projectileCount) {
        // If counts are equal, use random
        gameMode = Math.random() < 0.5 ? 'projectile' : 'dropcatch';
    } else if (dropCatchCount < projectileCount) {
        // Force dropcatch if it's behind
        gameMode = 'dropcatch';
    } else {
        // Force projectile if it's behind
        gameMode = 'projectile';
    }
    
    // Update counts
    if (gameMode === 'dropcatch') {
        dropCatchCount++;
    } else {
        projectileCount++;
    }
    
    // Show mode indicator first
    modeIndicator.textContent = gameMode === 'dropcatch' ? 'Catch the falling ball!' : 'Click the moving ball!';
    modeIndicator.style.display = 'block';
    
    // Show mode indicator with proper timing
    setTimeout(() => {
        modeIndicator.classList.add('show');
        setTimeout(() => {
            modeIndicator.classList.remove('show');
            setTimeout(() => {
                modeIndicator.style.display = 'none';
                // Start the game only after popup disappears
                isRunning = true;
                startTime = Date.now();
                
                // Initialize based on game mode
                if (gameMode === 'dropcatch') {
                    initDropCatch();
                    animateDropCatch();
                } else {
                    ballX = canvas.width * 0.2;
                    ballY = canvas.height - 40;
                    animateProjectile();
                }
            }, 300);
        }, 1500);
    }, 0);
    
    timerElement.style.display = 'block';
    progressIndicator.classList.add('show');
    updateProgressIndicator(0);
    updateStatus('', 'neutral');
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
    indicator.id = 'modeIndicator';
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