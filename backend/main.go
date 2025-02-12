package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"time"
)

type GameMode string

const (
	ModeBounce GameMode = "bounce"
	ModeDrop   GameMode = "drop"
)

type PhysicsParams struct {
	SessionID  string   `json:"session_id"`
	GameMode   GameMode `json:"game_mode"`
	Gravity    float64  `json:"gravity"`
	Velocity   float64  `json:"velocity"`
	Angle      float64  `json:"angle"`
	Friction   float64  `json:"friction"`
	StartTime  int64    `json:"startTime"`
	CatchCount int      `json:"catch_count"`
}

type ValidationRequest struct {
	SessionID string  `json:"session_id"`
	ClickX    float64 `json:"click_x"`
	ClickY    float64 `json:"click_y"`
	Time      float64 `json:"time"`
}

type ValidationResponse struct {
	Valid      bool   `json:"valid"`
	CatchCount int    `json:"catch_count"`
	Error      string `json:"error,omitempty"`
}

var activeSessions = make(map[string]PhysicsParams)

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func generateHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == "OPTIONS" {
		return
	}

	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())

	// Randomly select game mode
	gameMode := ModeBounce
	if rand.Float64() < 0.5 {
		gameMode = ModeDrop
	}

	params := PhysicsParams{
		SessionID:  sessionID,
		GameMode:   gameMode,
		StartTime:  time.Now().UnixNano(),
		CatchCount: 0,
	}

	switch gameMode {
	case ModeBounce:
		params.Gravity = 200 + rand.Float64()*200   // 200-400
		params.Velocity = 200 + rand.Float64()*100  // 200-300
		params.Angle = 0.7 + rand.Float64()*0.6     // 0.7-1.3 radians
		params.Friction = 0.1 + rand.Float64()*0.05 // 0.1-0.15
	case ModeDrop:
		params.Gravity = 150 + rand.Float64()*100 // 150-250
		params.Velocity = 0
		params.Angle = 0
		params.Friction = 0
	}

	activeSessions[sessionID] = params

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(params)
}

func validateHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == "OPTIONS" {
		return
	}

	var req ValidationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	session, ok := activeSessions[req.SessionID]
	if !ok {
		http.Error(w, "Invalid session", http.StatusBadRequest)
		return
	}

	elapsed := req.Time
	var x, y float64

	switch session.GameMode {
	case ModeBounce:
		vx := session.Velocity * math.Cos(session.Angle)
		vy := session.Velocity * math.Sin(session.Angle)
		x = vx * elapsed * (1 - session.Friction*elapsed)
		y = vy*elapsed - 0.5*session.Gravity*elapsed*elapsed
	case ModeDrop:
		x = 0
		y = -0.5 * session.Gravity * elapsed * elapsed
	}

	distance := math.Sqrt(math.Pow(req.ClickX-x, 2) + math.Pow(req.ClickY-y, 2))
	threshold := 20.0

	isValid := distance <= threshold
	if isValid {
		session.CatchCount++
		activeSessions[req.SessionID] = session
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ValidationResponse{
		Valid:      isValid,
		CatchCount: session.CatchCount,
	})
}

func main() {
	rand.Seed(time.Now().UnixNano())

	http.HandleFunc("/generate", generateHandler)
	http.HandleFunc("/validate", validateHandler)

	port := ":8080"
	log.Printf("Starting server on port %s...", port)
	log.Fatal(http.ListenAndServe(port, nil))
}
