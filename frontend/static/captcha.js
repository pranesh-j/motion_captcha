const canvas = document.getElementById('captchaCanvas');
const ctx = canvas.getContext('2d');
let startTime, physicsParams, animationId, timerInterval;
let isRunning = false;

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

function setCanvasSize() {
    canvas.width = 500;
    canvas.height = 300;
}

setCanvasSize();

const timerElement = document.createElement('div');
timerElement.className = 'timer';
timerElement.id = 'timer';
timerElement.style.display = 'none';
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

function animate() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const t = (Date.now() - startTime) / 1000;
    
    const vx = physicsParams.velocity * Math.cos(physicsParams.angle);
    const vy = physicsParams.velocity * Math.sin(physicsParams.angle);
    
    const x = vx * t * (1 - physicsParams.friction * t);
    const y = vy * t - 0.5 * physicsParams.gravity * t * t;

    ctx.save();
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
    ctx.restore();
    
    const ballX = canvas.width/2 + x;
    const ballY = canvas.height - 40 - y;
    const ballRadius = 15;

    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY + 3, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#dc3545';
    ctx.fill();
    ctx.restore();

    const timeLeft = Math.max(0, 3.0 - t);
    timerElement.textContent = timeLeft.toFixed(1) + 's';

    if (t > 3.0) {
        isRunning = false;
        updateStatus('Time expired! Try again.', 'error');
        const button = document.getElementById('startButton');
        button.disabled = false;
        button.textContent = 'Start Verification';
        timerElement.style.display = 'none';
        return;
    }

    if (t < 3) {
        animationId = requestAnimationFrame(animate);
    } else {
        isRunning = false;
        updateStatus('Time expired! Try again.', 'error');
    }
}

async function handleClick(e) {
    if (!isRunning) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const t = (Date.now() - startTime) / 1000;
    
    const vx = physicsParams.velocity * Math.cos(physicsParams.angle);
    const vy = physicsParams.velocity * Math.sin(physicsParams.angle);
    const x = vx * t * (1 - physicsParams.friction * t);
    const y = vy * t - 0.5 * physicsParams.gravity * t * t;

    const ballCanvasX = canvas.width/2 + x;
    const ballCanvasY = canvas.height - 40 - y;

    const distance = Math.sqrt(
        Math.pow(canvasX - ballCanvasX, 2) + 
        Math.pow(canvasY - ballCanvasY, 2)
    );

    if (distance > 30) { 
        console.log('Click too far from ball:', distance);
        updateStatus('Missed! Try clicking closer to the ball.', 'error');
        return;
    }

    const physicsX = canvasX - canvas.width/2;
    const physicsY = canvas.height - 40 - canvasY;

    const data = {
        session_id: physicsParams.session_id,
        click_x: physicsX,
        click_y: physicsY,
        time: t  
    };

    try {
        const response = await fetchWithRetry('/proxy/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        const responseData = await response.json();
        
        isRunning = false;
        cancelAnimationFrame(animationId);
        document.getElementById('timer').style.display = 'none';
        
        if (responseData.valid) {
            updateStatus('Success! You caught the ball.', 'success');
        } else {
            updateStatus('Missed! Try again.', 'error');
        }
        
        const button = document.getElementById('startButton');
        button.disabled = false;
        button.textContent = 'Start Verification';
    } catch (error) {
        console.error('Error:', error);
        updateStatus('Error validating click. Try again.', 'error');
        document.getElementById('timer').style.display = 'none';
        const button = document.getElementById('startButton');
        button.disabled = false;
        button.textContent = 'Start Verification';
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

    timerElement.style.display = 'none';
    updateStatus('Initializing...', 'neutral');

    try {
        const response = await fetchWithRetry('/proxy/generate');
        const data = await response.json();
        
        console.log('Received parameters:', data);
        physicsParams = data;
        startTime = Date.now();
        isRunning = true;
        
        timerElement.style.display = 'block';
        timerElement.textContent = '3.0s';
        
        button.textContent = 'Verification in Progress...';
        updateStatus('', 'neutral');
        
        animate();
    } catch (error) {
        console.error('Error:', error);
        button.disabled = false;
        button.textContent = 'Start Verification';
        updateStatus('Error starting CAPTCHA. Click to try again.', 'error');
    }
}

function updateStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = 'status-message ' + type;
    
    const button = document.getElementById('startButton');
    button.disabled = isRunning;
    button.textContent = isRunning ? 'Verification in Progress...' : 'Start Verification';
}

function warmupServer() {
    fetch('/proxy/generate')
        .then(response => response.ok)
        .catch(error => console.log('Warmup request sent'));
}

canvas.addEventListener('click', handleClick);
document.getElementById('startButton').addEventListener('click', startCaptcha);

// Warmup the server when the page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(warmupServer, 1000);
});