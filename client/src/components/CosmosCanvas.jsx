import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { useCosmosStore } from "../stores/cosmosStore";

const GRID = 80;

export default function CosmosCanvas() {
  const mountRef = useRef(null);
  const pixiRef  = useRef(null);

  useEffect(() => {
    if (pixiRef.current) return; // guard: don't init twice

    // Create canvas imperatively so React never touches it
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;position:absolute;inset:0;";
    mountRef.current.appendChild(canvas);

    const app = new PIXI.Application({
      view:            canvas,
      width:           window.innerWidth,
      height:          window.innerHeight,
      backgroundColor: 0x070b14,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
    });

    // Layer order: background → world decorations → connection lines → avatars
    const bgLayer    = new PIXI.Container();
    const worldLayer = new PIXI.Container();
    const lineLayer  = new PIXI.Container();
    const usersLayer = new PIXI.Container();
    app.stage.addChild(bgLayer, worldLayer, lineLayer, usersLayer);

    // Single reusable Graphics object for connection lines (cleared + redrawn every frame)
    const lineGfx = new PIXI.Graphics();
    lineLayer.addChild(lineGfx);

    const pixi = {
      app, lineGfx,
      layers:     { bgLayer, worldLayer, lineLayer, usersLayer },
      sprites:    {},           // socketId → sprite bundle
      camera:     { x: 0, y: 0 },
      raf:        null,
      worldDrawn: false,
    };
    pixiRef.current = pixi;

    const onResize = () => app.renderer.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);

    const loop = () => {
      const s = useCosmosStore.getState();

      // Build world once after we receive worldSize from server
      if (!pixi.worldDrawn && s.worldSize.width > 0) {
        buildWorld(pixi.layers, s.worldSize);
        pixi.worldDrawn = true;
      }

      if (s.self) {
        updateCamera(pixi, s.self.position, s.worldSize);
        // renderUsers first so positions are updated, then draw lines on top
        renderUsers(pixi, s);
        drawConnectionLines(pixi, s);
      }

      pixi.raf = requestAnimationFrame(loop);
    };
    pixi.raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(pixi.raf);
      Object.values(pixi.sprites).forEach((sp) => sp.container.destroy({ children: true }));
      pixi.sprites    = {};
      pixi.worldDrawn = false;
      app.destroy(true, { children: true }); // true = also removes the canvas element
      pixiRef.current = null;
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World background
// ─────────────────────────────────────────────────────────────────────────────
function buildWorld({ bgLayer, worldLayer }, { width, height }) {
  // Solid dark background
  const bg = new PIXI.Graphics();
  bg.beginFill(0x070b14).drawRect(0, 0, width, height).endFill();
  bgLayer.addChild(bg);

  // Grid
  const grid = new PIXI.Graphics();
  grid.lineStyle(1, 0x1a2a4a, 0.3);
  for (let x = 0; x <= width;  x += GRID) { grid.moveTo(x, 0).lineTo(x, height); }
  for (let y = 0; y <= height; y += GRID) { grid.moveTo(0, y).lineTo(width, y); }
  bgLayer.addChild(grid);

  // Stars
  const stars = new PIXI.Graphics();
  for (let i = 0; i < 350; i++) {
    const sz = Math.random() < 0.15 ? 1.5 : 0.7;
    stars.beginFill(0x8ab4f8, 0.1 + Math.random() * 0.4)
         .drawCircle(Math.random() * width, Math.random() * height, sz)
         .endFill();
  }
  bgLayer.addChild(stars);

  // Nebula glows
  [
    { x: width * 0.2,  y: height * 0.3,  r: 220, c: 0x1a3a7a },
    { x: width * 0.7,  y: height * 0.6,  r: 260, c: 0x2a1a5a },
    { x: width * 0.5,  y: height * 0.14, r: 190, c: 0x0a3a4a },
    { x: width * 0.85, y: height * 0.2,  r: 170, c: 0x1a2a6a },
  ].forEach(({ x, y, r, c }) => {
    const g = new PIXI.Graphics();
    for (let i = 7; i >= 0; i--) {
      g.beginFill(c, 0.055 * (7 - i) / 7).drawCircle(x, y, r * (1 - i / 14)).endFill();
    }
    bgLayer.addChild(g);
  });

  // Meeting zone circles (cluster spawn markers)
  [
    { x: width * 0.5,  y: height * 0.5 },
    { x: width * 0.3,  y: height * 0.4 },
    { x: width * 0.7,  y: height * 0.4 },
    { x: width * 0.3,  y: height * 0.6 },
    { x: width * 0.7,  y: height * 0.6 },
  ].forEach(({ x, y }) => {
    const g = new PIXI.Graphics();
    g.lineStyle(1, 0x4d9fff, 0.12).drawCircle(x, y, 130);
    g.lineStyle(0).beginFill(0x0d1f3a, 0.2).drawCircle(x, y, 110).endFill();
    worldLayer.addChild(g);
  });

  // World border
  const border = new PIXI.Graphics();
  border.lineStyle(2, 0x4d9fff, 0.18).drawRect(0, 0, width, height);
  worldLayer.addChild(border);
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera: smooth lerp toward player center
// ─────────────────────────────────────────────────────────────────────────────
function updateCamera(pixi, pos, worldSize) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const tx = Math.min(0, Math.max(vw - worldSize.width,  vw / 2 - pos.x));
  const ty = Math.min(0, Math.max(vh - worldSize.height, vh / 2 - pos.y));

  pixi.camera.x += (tx - pixi.camera.x) * 0.1;
  pixi.camera.y += (ty - pixi.camera.y) * 0.1;

  const { bgLayer, worldLayer, lineLayer, usersLayer } = pixi.layers;
  bgLayer.x = worldLayer.x = lineLayer.x = usersLayer.x = pixi.camera.x;
  bgLayer.y = worldLayer.y = lineLayer.y = usersLayer.y = pixi.camera.y;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection lines between self and nearby users
// Must run AFTER renderUsers so positions are current
// ─────────────────────────────────────────────────────────────────────────────
function drawConnectionLines(pixi, { self, activeRooms, users }) {
  const g = pixi.lineGfx;
  g.clear();

  const now = Date.now();

  for (const room of Object.values(activeRooms)) {
    const otherId = room.withUser?.socketId;
    if (!otherId) continue;

    // Look up current position from the users array (always up to date)
    const otherUser = users.find((u) => u.socketId === otherId);
    if (!otherUser?.position) continue;

    const alpha = 0.2 + Math.sin(now * 0.004) * 0.1;
    g.lineStyle(1.5, 0x44ff91, alpha);
    g.moveTo(self.position.x, self.position.y);
    g.lineTo(otherUser.position.x, otherUser.position.y);

    // Draw small dot at midpoint
    const mx = (self.position.x + otherUser.position.x) / 2;
    const my = (self.position.y + otherUser.position.y) / 2;
    g.lineStyle(0);
    g.beginFill(0x44ff91, 0.4 + Math.sin(now * 0.006) * 0.2);
    g.drawCircle(mx, my, 3);
    g.endFill();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar sprites
// ─────────────────────────────────────────────────────────────────────────────
function hexNum(hex) {
  return parseInt((hex || "#4d9fff").replace("#", ""), 16);
}

function makeSprite(pixi, socketId, info, isSelf, proximityRadius) {
  const color     = hexNum(info.avatarColor);
  const r         = isSelf ? 20 : 16;
  const container = new PIXI.Container();

  // Proximity detection ring — only shown on the local player
  let ring = null;
  if (isSelf) {
    ring = new PIXI.Graphics();
    ring.beginFill(color, 0.04).drawCircle(0, 0, proximityRadius).endFill();
    ring.lineStyle(1.5, color, 0.35).drawCircle(0, 0, proximityRadius);
    container.addChild(ring);
  }

  // Soft glow halo
  const glow = new PIXI.Graphics();
  glow.beginFill(color, 0.15).drawCircle(0, 0, r + 12).endFill();
  container.addChild(glow);

  // Main circle
  const circle = new PIXI.Graphics();
  circle.lineStyle(isSelf ? 2.5 : 1.5, isSelf ? 0xffffff : color, isSelf ? 0.9 : 0.65)
        .beginFill(color, isSelf ? 0.92 : 0.78)
        .drawCircle(0, 0, r)
        .endFill();
  container.addChild(circle);

  // First letter of username
  const letter = new PIXI.Text((info.username?.[0] || "?").toUpperCase(), {
    fontSize:   isSelf ? 13 : 11,
    fill:       0xffffff,
    fontFamily: "DM Sans, sans-serif",
    fontWeight: "600",
  });
  letter.anchor.set(0.5);
  container.addChild(letter);

  // Name label below avatar
  const label = new PIXI.Text(
    isSelf ? `${info.username} (you)` : info.username,
    {
      fontSize:           11,
      fill:               isSelf ? 0xe8f0ff : 0xa8c4f0,
      fontFamily:         "DM Sans, sans-serif",
      fontWeight:         isSelf ? "600" : "400",
      dropShadow:         true,
      dropShadowBlur:     5,
      dropShadowColor:    0x000000,
      dropShadowAlpha:    0.9,
      dropShadowDistance: 0,
    }
  );
  label.anchor.set(0.5);
  label.y = r + 14;
  container.addChild(label);

  pixi.layers.usersLayer.addChild(container);

  const sp = { container, circle, glow, letter, label, ring, isSelf };
  pixi.sprites[socketId] = sp;
  return sp;
}

function renderUsers(pixi, { users, self, activeRooms, proximityRadius }) {
  const now          = Date.now();
  const connectedIds = new Set(
    Object.values(activeRooms).map((r) => r.withUser?.socketId)
  );

  // Remove sprites for users who have left
  const liveIds = new Set([self.socketId, ...users.map((u) => u.socketId)]);
  for (const id of Object.keys(pixi.sprites)) {
    if (!liveIds.has(id)) {
      pixi.layers.usersLayer.removeChild(pixi.sprites[id].container);
      pixi.sprites[id].container.destroy({ children: true });
      delete pixi.sprites[id];
    }
  }

  // ── Render self ───────────────────────────────────────────────────────────
  const ss = pixi.sprites[self.socketId]
    || makeSprite(pixi, self.socketId, self, true, proximityRadius);

  ss.container.x = self.position.x;
  ss.container.y = self.position.y;

  if (ss.ring) ss.ring.alpha = 0.06 + Math.sin(now * 0.003) * 0.04;
  const bob = Math.sin(now * 0.002) * 1.5;
  ss.circle.y = bob;
  ss.letter.y = bob;

  // ── Render other users ────────────────────────────────────────────────────
  for (const user of users) {
    if (user.socketId === self.socketId) continue;

    const sp = pixi.sprites[user.socketId]
      || makeSprite(pixi, user.socketId, user, false, proximityRadius);

    sp.container.x = user.position.x;
    sp.container.y = user.position.y;

    const near = connectedIds.has(user.socketId);

    // Visual feedback: connected users glow brighter
    sp.glow.alpha        = near ? 0.5 + Math.sin(now * 0.004) * 0.15 : 0.1;
    sp.circle.alpha      = near ? 1 : 0.6;
    sp.label.style.fill  = near ? 0xe8f0ff : 0x4a6a88;

    // Gentle idle bob (offset per user for variety)
    const offset = (user.socketId.charCodeAt(0) + user.socketId.charCodeAt(1)) * 0.25;
    sp.circle.y = Math.sin(now * 0.0018 + offset) * 1.2;
    sp.letter.y = sp.circle.y;
  }
}
