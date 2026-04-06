import { create } from "zustand";

export const useCosmosStore = create((set, get) => ({
  // ── Socket / connection ───────────────────────────────────────────────────
  socket:       null,
  connected:    false,
  setSocket:    (socket)    => set({ socket }),
  setConnected: (connected) => set({ connected }),

  // ── Phase: "login" | "cosmos" ─────────────────────────────────────────────
  phase:    "login",
  setPhase: (phase) => set({ phase }),

  // ── Self ──────────────────────────────────────────────────────────────────
  self: null,
  setSelf: (self) => set({ self }),
  updateSelfPosition: (position) =>
    set((s) => s.self ? { self: { ...s.self, position } } : {}),

  // ── World config ──────────────────────────────────────────────────────────
  worldSize:       { width: 2400, height: 1600 },
  proximityRadius: 150,
  setWorldConfig: (worldSize, proximityRadius) => set({ worldSize, proximityRadius }),

  // ── Other users ───────────────────────────────────────────────────────────
  // Each user: { userId, socketId, username, avatarColor, position }
  users:    [],
  setUsers: (users) => set({ users }),
  updateUserPosition: (socketId, position) =>
    set((s) => ({
      users: s.users.map((u) => u.socketId === socketId ? { ...u, position } : u),
    })),

  // ── Active proximity rooms ─────────────────────────────────────────────────
  // { [roomId]: { withUser: { userId, socketId, username, avatarColor }, messages: [], unread: 0 } }
  activeRooms:  {},
  activeRoomId: null,

  addRoom: (roomId, withUser) =>
    set((s) => ({
      activeRooms:  { ...s.activeRooms, [roomId]: { withUser, messages: [], unread: 0 } },
      activeRoomId: s.activeRoomId ?? roomId,  // auto-open first room
    })),

  removeRoom: (roomId) =>
    set((s) => {
      const next = { ...s.activeRooms };
      delete next[roomId];
      const nextId = s.activeRoomId === roomId
        ? (Object.keys(next)[0] ?? null)
        : s.activeRoomId;
      return { activeRooms: next, activeRoomId: nextId };
    }),

  setActiveRoomId: (roomId) =>
    set((s) => {
      const room = s.activeRooms[roomId];
      if (!room) return {};
      return {
        activeRoomId: roomId,
        activeRooms: { ...s.activeRooms, [roomId]: { ...room, unread: 0 } },
      };
    }),

  addMessage: (roomId, message) =>
    set((s) => {
      const room = s.activeRooms[roomId];
      if (!room) return {};
      const isOpen = s.activeRoomId === roomId;
      return {
        activeRooms: {
          ...s.activeRooms,
          [roomId]: {
            ...room,
            messages: [...room.messages, message].slice(-200),
            unread:   isOpen ? 0 : room.unread + 1,
          },
        },
      };
    }),

  // ── Typing indicators ─────────────────────────────────────────────────────
  // { [roomId]: { [socketId]: username } }
  typingUsers: {},
  setTyping: (roomId, socketId, username, isTyping) =>
    set((s) => {
      const room = { ...(s.typingUsers[roomId] || {}) };
      if (isTyping) room[socketId] = username;
      else delete room[socketId];
      return { typingUsers: { ...s.typingUsers, [roomId]: room } };
    }),

  // ── Helper: get position of a connected user by socketId ──────────────────
  // Used by canvas to draw connection lines without mutating store state
  getConnectedUserPosition: (socketId) => {
    const state = get();
    const user = state.users.find((u) => u.socketId === socketId);
    return user?.position ?? null;
  },
}));
