import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 4000;
const app = express();
const server = createServer(app);

const allowedOrigins = [
  "http://localhost",
  "http://localhost:3000",
  "https://flexiyo.web.app",
];

// Set up CORS for both express and socket.io
const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));

const io = new Server(server, { cors: corsOptions });

// Basic health check endpoint
app.get("/", (req, res) => {
  res.send({ message: "The server is live..." });
});

// Socket.IO events
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-rooms", (roomIds, socketId, username) => {
    roomIds.forEach((roomId) => {
      socket.join(roomId);
      console.log(`User ${username} (ID: ${socketId}) joined room: ${roomId}`);
    });
  });

  socket.on("send-message", (currentRoomId, avatar, username, message) => {
    console.log(`Message from ${username} in room ${currentRoomId}: ${message}`);
    socket.broadcast
      .to(currentRoomId)
      .emit("receive-message", avatar, username, message);
      console.log(`Message sent to room ${currentRoomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
