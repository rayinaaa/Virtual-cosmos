require("dotenv").config();
const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const cors     = require("cors");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const app    = express();
const server = http.createServer(app);

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT             = process.env.PORT       || 3001;
const CLIENT_URL       = process.env.CLIENT_URL || "http://localhost:5173";
const MONGO_URI        = process.env.MONGO_URI  || "mongodb://localhost:27017/cosmos";
const PROXIMITY_RADIUS = 150;
const WORLD_WIDTH      = 2400;
const WORLD_HEIGHT     = 1600;

// Cluster spawns: new users spawn near the CENTER so they can find each other easily
const SPAWN_CLUSTERS = [
  { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.5 },  // center
  { x: WORLD_WIDTH * 0.3, y: WORLD_HEIGHT * 0.4 },
  { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT * 0.4 },
  { x: WORLD_WIDTH * 0.3, y: WORLD_HEIGHT * 0.6 },
  { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT * 0.6 },
];
const SPAWN_SCATTER = 200; // px radius around each cluster

const AVATAR_COLORS = [
  "#FF6B9D","#C44DFF","#44D4FF","#44FF91",
  "#FFB144","#FF4466","#44FFEE","#FFEE44",
  "#AA44FF","#FF8844","#44AAFF","#88FF44",
];

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ["GET","POST"], credentials: true },
  pingTimeout:  60000,
  pingInterval: 25000,
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ─── MongoDB (optional) ───────────────────────────────────────────────────────
let UserSession = null;
let ChatMessage = null;

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const UserSessionSchema = new mongoose.Schema({
      userId:      { type: String, required: true, unique: true },
      username:    { type: String, required: true },
      avatarColor: { type: String, required: true },
      position:    { x: { type: Number, default: 400 }, y: { type: Number, default: 300 } },
      lastSeen:    { type: Date, default: Date.now },
    }, { timestamps: true });
    const ChatMessageSchema = new mongoose.Schema({
      roomId:     { type: String, required: true },
      senderId:   { type: String, required: true },
      senderName: { type: String, required: true },
      message:    { type: String, required: true },
      timestamp:  { type: Date, default: Date.now },
    }, { timestamps: true });
    UserSession = mongoose.model("UserSession", UserSessionSchema);
    ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
  })
  .catch((err) => console.warn("⚠️  MongoDB not available, in-memory only:", err.message));

// ─── In-memory state ──────────────────────────────────────────────────────────
const users     = new Map(); // socketId → userState
const chatRooms = new Map(); // roomId   → Set<socketId>

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const makeRoomId = (id1, id2) => [id1, id2].sort().join("__");

function safeUserList() {
  return Array.from(users.values()).map((u) => ({
    userId:      u.userId,
    socketId:    u.socketId,
    username:    u.username,
    avatarColor: u.avatarColor,
    position:    u.position,
  }));
}

function broadcastUserList() {
  io.emit("users:update", safeUserList());
}

// ─── Core proximity logic (extracted so we can call it from join AND move) ────
// Checks user `mover` against ALL other users.
// Fires proximity:connected / proximity:disconnected events as needed.
function checkProximity(mover) {
  const prevConns = new Set(mover.connections);
  const nowNear   = new Set();

  for (const [otherId, other] of users) {
    if (otherId === mover.socketId) continue;
    const d = dist(mover.position, other.position);

    if (d < PROXIMITY_RADIUS) {
      nowNear.add(otherId);

      // ── New connection ──────────────────────────────────────────────────
      if (!prevConns.has(otherId)) {
        const rid = makeRoomId(mover.socketId, otherId);

        mover.connections.add(otherId);
        other.connections.add(mover.socketId);

        if (!chatRooms.has(rid)) chatRooms.set(rid, new Set());
        chatRooms.get(rid).add(mover.socketId);
        chatRooms.get(rid).add(otherId);

        // Join Socket.IO rooms
        const moverSocket = io.sockets.sockets.get(mover.socketId);
        const otherSocket = io.sockets.sockets.get(otherId);
        moverSocket?.join(rid);
        otherSocket?.join(rid);

        // Notify both sides
        moverSocket?.emit("proximity:connected", {
          roomId:   rid,
          withUser: { userId: other.userId, socketId: otherId, username: other.username, avatarColor: other.avatarColor },
        });
        otherSocket?.emit("proximity:connected", {
          roomId:   rid,
          withUser: { userId: mover.userId, socketId: mover.socketId, username: mover.username, avatarColor: mover.avatarColor },
        });

        console.log(`🔗 ${mover.username} ↔ ${other.username} (dist: ${Math.round(d)}px)`);
      }
    }
  }

  // ── Lost connections ──────────────────────────────────────────────────────
  for (const otherId of prevConns) {
    if (!nowNear.has(otherId)) {
      const rid         = makeRoomId(mover.socketId, otherId);
      const other       = users.get(otherId);
      const moverSocket = io.sockets.sockets.get(mover.socketId);
      const otherSocket = io.sockets.sockets.get(otherId);

      mover.connections.delete(otherId);
      if (other) other.connections.delete(mover.socketId);

      moverSocket?.leave(rid);
      otherSocket?.leave(rid);

      moverSocket?.emit("proximity:disconnected", { roomId: rid });
      otherSocket?.emit("proximity:disconnected", { roomId: rid });

      if (other) console.log(`💔 ${mover.username} ↔ ${other.username}`);
    }
  }
}

async function dbSaveUser(u) {
  if (!UserSession) return;
  try {
    await UserSession.findOneAndUpdate(
      { userId: u.userId },
      { userId: u.userId, username: u.username, avatarColor: u.avatarColor, position: u.position, lastSeen: new Date() },
      { upsert: true, new: true }
    );
  } catch (_) {}
}

async function dbSaveMsg(rid, senderId, senderName, message) {
  if (!ChatMessage) return;
  try { await ChatMessage.create({ roomId: rid, senderId, senderName, message }); } catch (_) {}
}

// ─── Socket events ────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // ── user:join ──────────────────────────────────────────────────────────────
  socket.on("user:join", async ({ username } = {}) => {
    if (users.has(socket.id)) return; // prevent duplicate join

    const userId      = uuidv4();
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const cleanName   = (username || "").trim().slice(0, 20) || `User_${userId.slice(0, 4)}`;

    // Pick a cluster spawn so users appear near each other
    const cluster = SPAWN_CLUSTERS[Math.floor(Math.random() * SPAWN_CLUSTERS.length)];
    const angle   = Math.random() * Math.PI * 2;
    const radius  = Math.random() * SPAWN_SCATTER;
    const spawnX  = Math.max(20, Math.min(WORLD_WIDTH  - 20, cluster.x + Math.cos(angle) * radius));
    const spawnY  = Math.max(20, Math.min(WORLD_HEIGHT - 20, cluster.y + Math.sin(angle) * radius));

    const user = {
      userId,
      socketId:    socket.id,
      username:    cleanName,
      avatarColor,
      position:    { x: spawnX, y: spawnY },
      connections: new Set(),
    };

    users.set(socket.id, user);
    console.log(`👤 ${cleanName} joined at (${Math.round(spawnX)}, ${Math.round(spawnY)})`);

    // Send world info to the new user
    socket.emit("user:joined", {
      userId,
      socketId:        socket.id,
      username:        cleanName,
      avatarColor,
      position:        user.position,
      worldSize:       { width: WORLD_WIDTH, height: WORLD_HEIGHT },
      proximityRadius: PROXIMITY_RADIUS,
    });

    // Broadcast updated user list to everyone
    broadcastUserList();

    // ── Check proximity immediately on join ──────────────────────────────
    // This handles the case where you walk near someone who's already standing still.
    // Without this, proximity only fires when someone MOVES, so a stationary user
    // would never get connected to a newly joining user near them.
    checkProximity(user);

    await dbSaveUser(user);
  });

  // ── user:move ──────────────────────────────────────────────────────────────
  socket.on("user:move", async ({ x, y } = {}) => {
    const user = users.get(socket.id);
    if (!user) return;
    if (typeof x !== "number" || typeof y !== "number") return;
    if (!isFinite(x) || !isFinite(y)) return;

    user.position = {
      x: Math.max(20, Math.min(WORLD_WIDTH  - 20, x)),
      y: Math.max(20, Math.min(WORLD_HEIGHT - 20, y)),
    };

    // Broadcast position to all clients
    io.emit("user:moved", {
      socketId: socket.id,
      position: user.position,
    });

    // Run proximity check for the moving user
    checkProximity(user);

    if (Math.random() < 0.05) await dbSaveUser(user);
  });

  // ── chat:message ──────────────────────────────────────────────────────────
  socket.on("chat:message", async ({ roomId: rid, message } = {}) => {
    const user = users.get(socket.id);
    if (!user || !rid || !message) return;

    const trimmed = String(message).trim().slice(0, 500);
    if (!trimmed) return;

    const room = chatRooms.get(rid);
    if (!room || !room.has(socket.id)) return; // must be in the room

    const payload = {
      roomId:      rid,
      senderId:    user.userId,
      socketId:    socket.id,
      senderName:  user.username,
      avatarColor: user.avatarColor,
      message:     trimmed,
      timestamp:   Date.now(),
    };

    io.to(rid).emit("chat:message", payload);
    await dbSaveMsg(rid, user.userId, user.username, trimmed);
  });

  // ── chat:typing ───────────────────────────────────────────────────────────
  socket.on("chat:typing", ({ roomId: rid, isTyping } = {}) => {
    const user = users.get(socket.id);
    if (!user || !rid) return;
    socket.to(rid).emit("chat:typing", {
      roomId:   rid,
      socketId: socket.id,
      username: user.username,
      isTyping: !!isTyping,
    });
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    const user = users.get(socket.id);
    if (!user) return;

    for (const otherId of user.connections) {
      const rid   = makeRoomId(socket.id, otherId);
      const other = users.get(otherId);
      if (other) other.connections.delete(socket.id);
      io.to(otherId).emit("proximity:disconnected", { roomId: rid });
    }

    users.delete(socket.id);
    broadcastUserList();
    console.log(`👋 ${user.username} left (${reason})`);
  });
});

// ─── REST ─────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({
  status:  "ok",
  users:   users.size,
  rooms:   chatRooms.size,
  uptime:  Math.round(process.uptime()),
}));

app.get("/api/stats", (_req, res) => res.json({
  activeUsers:     users.size,
  activeRooms:     chatRooms.size,
  worldSize:       { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  proximityRadius: PROXIMITY_RADIUS,
}));

server.listen(PORT, () => console.log(`🚀 Cosmos server → http://localhost:${PORT}`));
