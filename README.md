# MotionMatch CAPTCHA

A physics-based CAPTCHA system that challenges users to intercept a bouncing ball within a 3-second window. Built with security and user experience in mind.

## Tech Stack

### Backend
- **Go (Golang)**: Core CAPTCHA logic, session validation
- **Python/Flask**: Frontend serving, rate limiting, proxy to Go backend
- **In-memory storage**: Session management (can be replaced with Redis)

### Frontend
- **Vanilla JavaScript**: No frameworks needed
- **HTML5 Canvas**: For smooth physics animation
- **CSS3**: Modern styling with animations

## Features

- Physics-based ball movement with randomized parameters
- Secure session handling with HMAC signatures
- Rate limiting to prevent abuse
- Visual feedback with animations and sound
- Mobile-friendly design
- Countdown timer
- Click feedback with ripple effect


## Setup

1. Install Go dependencies:
   ```bash
   cd backend/go
   go mod download
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the Go backend:
   ```bash
   cd backend/go
   go run main.go
   ```

4. Start the Flask frontend:
   ```bash
   python app.py
   ```

5. Visit localhost url on your browser

## Security Features

- HMAC-based request signing
- Rate limiting on all endpoints
- Session validation
- Click position verification
- Configurable difficulty parameters

## API Documentation

### Generate CAPTCHA Session
```
GET /proxy/generate
Response: {
    "session_id": string,
    "gravity": float,
    "velocity": float,
    "angle": float,
    "friction": float,
    "signature": string,
    "timestamp": int
}
```

### Validate CAPTCHA Attempt
```
POST /proxy/validate
Request: {
    "session_id": string,
    "x": float,
    "y": float,
    "timestamp": int,
    "signature": string
}
Response: {
    "valid": boolean,
    "error": string (optional)
}
```


