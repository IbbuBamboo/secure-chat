// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from /public
app.use(express.static(path.join(__dirname, "../public")));

const rooms = {}; // Track users per room

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  // Join Room
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    console.log(`👤 ${userName} joined room: ${roomId}`);

    // Add user to room
    if (!rooms[roomId]) rooms[roomId] = [];
    rooms[roomId].push({ id: socket.id, name: userName });

    // Notify others in the room
    socket.to(roomId).emit("user-joined", {
      id: socket.id,
      name: userName,
    });

    // Send back existing users in the room
    const existingUsers = rooms[roomId].filter(u => u.id !== socket.id);
    socket.emit("existing-users", existingUsers);

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`🔴 ${userName} left room: ${roomId}`);
      rooms[roomId] = rooms[roomId].filter(u => u.id !== socket.id);
      socket.to(roomId).emit("user-left", socket.id);

      // Clean up empty room
      if (rooms[roomId].length === 0) delete rooms[roomId];
    });
  });

  // WebRTC signaling relay
  socket.on("signal", ({ to, ...data }) => {
    io.to(to).emit("signal", { ...data, from: socket.id });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
