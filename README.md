<<<<<<< HEAD
# 🌌 Cosmos — Proximity-Based Virtual Space

A real-time 2D virtual world where **proximity creates connection**.  
Move close to another user → chat opens automatically.  
Move away → chat closes automatically.

---

## 🚀 Quick Start (3 steps)

### 1. Install
```bash
npm install          # installs concurrently at root
npm run install:all  # installs server + client dependencies
```

### 2. Configure
```bash
# Server config (MongoDB is optional — works without it)
cp server/.env.example server/.env

# Client config
cp client/.env.example client/.env
```

### 3. Run
```bash
npm run dev
```

- **Client** → http://localhost:5173  
- **Server** → http://localhost:3001  
- **Health** → http://localhost:3001/api/health

Open **2 or more browser tabs** at `http://localhost:5173`, enter different names, and move your avatars close together to trigger chat!

---

## 🎮 Controls

| Key | Action |
|---|---|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |
| `Enter` | Send chat message |

---

## ✨ Features

- **2D scrollable world** — 2400×1600 canvas with PixiJS WebGL rendering
- **Real-time multiplayer** — positions sync instantly via Socket.IO
- **Proximity detection** — 150px radius triggers connect/disconnect
- **Auto chat** — panel appears when nearby, disappears when far
- **Multi-chat tabs** — be connected to multiple users simultaneously
- **Typing indicators** — live "is typing…" feedback
- **Minimap** — see all users and your position at a glance
- **Unread badges** — count unread messages per conversation
- **MongoDB optional** — persists sessions and messages when available; runs fully in-memory without it

---

## 📁 Project Structure

```
cosmos/
├── package.json              ← root (concurrently scripts)
├── server/
│   ├── index.js              ← Express + Socket.IO server
│   ├── package.json
│   └── .env.example
└── client/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx           ← React entry (no StrictMode — PixiJS incompatible)
        ├── App.jsx            ← Phase routing: login → cosmos
        ├── index.css          ← global styles + keyframes
        ├── stores/
        │   └── cosmosStore.js ← Zustand global state
        ├── hooks/
        │   ├── useSocket.js   ← Socket.IO lifecycle + all event handlers
        │   └── useMovement.js ← rAF game loop, keyboard input, throttled emit
        └── components/
            ├── LoginScreen.jsx  ← name entry screen
            ├── CosmosCanvas.jsx ← PixiJS world renderer
            ├── ChatPanel.jsx    ← proximity chat UI with tabs
            ├── HUD.jsx          ← stats overlay + connection badges
            └── Minimap.jsx      ← canvas minimap (own rAF loop)
```

---

## 🔌 Socket Event Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `user:join` | `{ username }` | Enter the cosmos |
| `user:move` | `{ x, y }` | Update position (throttled 50ms) |
| `chat:message` | `{ roomId, message }` | Send message |
| `chat:typing` | `{ roomId, isTyping }` | Typing indicator |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user:joined` | `{ userId, socketId, username, avatarColor, position, worldSize, proximityRadius }` | Join confirmed |
| `users:update` | `User[]` | Full user list snapshot |
| `user:moved` | `{ socketId, position }` | Another user moved |
| `proximity:connected` | `{ roomId, withUser }` | Entered proximity zone |
| `proximity:disconnected` | `{ roomId }` | Left proximity zone |
| `chat:message` | `{ roomId, senderId, socketId, senderName, avatarColor, message, timestamp }` | Incoming message |
| `chat:typing` | `{ roomId, socketId, username, isTyping }` | Typing state |

---

## ⚙️ Configuration

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |
| `MONGO_URI` | `mongodb://localhost:27017/cosmos` | Optional |
| `VITE_SERVER_URL` | `http://localhost:3001` | Client socket target |

World and proximity settings are in `server/index.js`:

```js
const PROXIMITY_RADIUS = 150;   // px — range that triggers chat
const WORLD_WIDTH      = 2400;  // world size in px
const WORLD_HEIGHT     = 1600;
```

---

## 🐛 Troubleshooting

**Blank screen after login**
- Make sure the server is running — you should see `🚀 Cosmos server → http://localhost:3001`
- Open browser DevTools → Console; you should see `🎉 user:joined`
- Run from the **root** with `npm run dev`, not from inside `client/` separately

**"Enter Cosmos" button stays greyed out**
- The socket hasn't connected. Verify `server/.env` has `PORT=3001` and `client/.env` has `VITE_SERVER_URL=http://localhost:3001`

**Movement doesn't work**
- Click the canvas area first so it has browser focus
- Don't type in the chat input — WASD is captured by it when focused

**Chat doesn't appear**
- Move your avatar within 150px of another user
- Check server logs for `🔗 User A ↔ User B` to confirm proximity is detected

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Rendering | PixiJS 7 | WebGL-accelerated canvas; handles many animated sprites smoothly |
| State | Zustand | Minimal boilerplate; `getState()` avoids stale closures in rAF loops |
| Realtime | Socket.IO | Rooms, reconnection, and event namespacing out of the box |
| Frontend | React 18 + Vite | Fast HMR; React manages UI overlays, PixiJS owns the canvas |
| Backend | Express + Node.js | Lightweight; in-memory Map is the real-time source of truth |
| Persistence | MongoDB + Mongoose | Optional; server degrades gracefully without it |

---

## 📄 License

MIT
