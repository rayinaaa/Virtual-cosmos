import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useCosmosStore } from "../stores/cosmosStore";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export function useSocket() {
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const socket = io(SERVER_URL, {
      transports:           ["websocket", "polling"],
      reconnection:         true,
      reconnectionAttempts: 15,
      reconnectionDelay:    1000,
    });

    useCosmosStore.getState().setSocket(socket);

    socket.on("connect", () => {
      useCosmosStore.getState().setConnected(true);
      console.log("✅ Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      useCosmosStore.getState().setConnected(false);
      console.warn("⚠️ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Connection error:", err.message);
    });

    // Server confirmed join — set self + enter world
    socket.on("user:joined", (data) => {
      console.log("🎉 Joined as", data.username, "at", data.position);
      const store = useCosmosStore.getState();
      store.setSelf({
        userId:      data.userId,
        socketId:    data.socketId,
        username:    data.username,
        avatarColor: data.avatarColor,
        position:    data.position,
      });
      store.setWorldConfig(data.worldSize, data.proximityRadius);
      store.setPhase("cosmos");
    });

    // Full snapshot of all users (fires on join + whenever someone joins/leaves)
    socket.on("users:update", (list) => {
      useCosmosStore.getState().setUsers(list);
    });

    // Incremental position update for one user
    socket.on("user:moved", ({ socketId, position }) => {
      const self = useCosmosStore.getState().self;
      if (self && socketId === self.socketId) return; // ignore own echo
      useCosmosStore.getState().updateUserPosition(socketId, position);
    });

    // Proximity: entered range of another user
    socket.on("proximity:connected", ({ roomId, withUser }) => {
      console.log("🔗 Connected with", withUser.username);
      useCosmosStore.getState().addRoom(roomId, withUser);
    });

    // Proximity: left range of another user
    socket.on("proximity:disconnected", ({ roomId }) => {
      console.log("💔 Disconnected from room", roomId);
      useCosmosStore.getState().removeRoom(roomId);
    });

    // Incoming chat message
    socket.on("chat:message", (data) => {
      useCosmosStore.getState().addMessage(data.roomId, data);
    });

    // Typing indicator from another user
    socket.on("chat:typing", ({ roomId, socketId, username, isTyping }) => {
      useCosmosStore.getState().setTyping(roomId, socketId, username, isTyping);
    });

  }, []);
}
